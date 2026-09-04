import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, ratingsTable, gamesTable, friendsTable } from "@workspace/db";
import { eq, or, desc, and, like, ne, inArray } from "drizzle-orm";
import { optionalAuth, type AuthRequest } from "../lib/auth";

const router = Router();

// GET /api/leaderboard (Friends Leaderboard)
router.get("/leaderboard", optionalAuth, async (req: AuthRequest, res) => {
  try {
    const timeControl = (req.query.timeControl as string) || "rapid";
    const limit = Math.min(parseInt(req.query.limit as string || "50"), 100);

    const ratingField = timeControl as "bullet" | "blitz" | "rapid" | "classical";

    // If user is not logged in, return empty list (frontend prompts login)
    if (!req.userId) {
      res.json([]);
      return;
    }

    const currentUserId = req.userId;

    // Fetch all friends for the current user
    const friendRows = await db.select().from(friendsTable)
      .where(or(eq(friendsTable.userId, currentUserId), eq(friendsTable.friendId, currentUserId)));

    const friendIds = friendRows.map(f => f.userId === currentUserId ? f.friendId : f.userId);
    const targetUserIds = Array.from(new Set([currentUserId, ...friendIds]));

    if (targetUserIds.length === 0) {
      res.json([]);
      return;
    }

    const users = await db.select({
      id: usersTable.id,
      username: usersTable.username,
      avatar: usersTable.avatar,
      country: usersTable.country,
      bullet: ratingsTable.bullet,
      blitz: ratingsTable.blitz,
      rapid: ratingsTable.rapid,
      classical: ratingsTable.classical,
    }).from(usersTable)
      .innerJoin(ratingsTable, eq(usersTable.id, ratingsTable.userId))
      .where(inArray(usersTable.id, targetUserIds))
      .orderBy(desc(ratingsTable[ratingField]))
      .limit(limit);

    if (users.length === 0) {
      res.json([]);
      return;
    }

    const userIds = users.map(u => u.id);

    // Fetch all finished games for target users in a SINGLE bulk query
    const finishedGames = await db.select({
      whitePlayerId: gamesTable.whitePlayerId,
      blackPlayerId: gamesTable.blackPlayerId,
      result: gamesTable.result,
    }).from(gamesTable).where(
      and(
        or(
          inArray(gamesTable.whitePlayerId, userIds),
          inArray(gamesTable.blackPlayerId, userIds)
        ),
        eq(gamesTable.status, "finished"),
        ne(gamesTable.mode, "local"),
        like(gamesTable.timeControl, `${timeControl}%`)
      )
    );

    // Aggregate stats per user in memory
    const userStats = new Map<number, { wins: number; losses: number; draws: number; totalGames: number }>();
    for (const id of userIds) {
      userStats.set(id, { wins: 0, losses: 0, draws: 0, totalGames: 0 });
    }

    for (const g of finishedGames) {
      const whiteId = g.whitePlayerId;
      const blackId = g.blackPlayerId;

      if (whiteId && userStats.has(whiteId)) {
        const stats = userStats.get(whiteId)!;
        if (g.result === "draw") stats.draws++;
        else if (g.result === "white") stats.wins++;
        else stats.losses++;
        stats.totalGames++;
      }

      if (blackId && userStats.has(blackId)) {
        const stats = userStats.get(blackId)!;
        if (g.result === "draw") stats.draws++;
        else if (g.result === "black") stats.wins++;
        else stats.losses++;
        stats.totalGames++;
      }
    }

    const rawEntries = users.map((u) => {
      const stats = userStats.get(u.id) || { wins: 0, losses: 0, draws: 0, totalGames: 0 };
      const winRate = stats.totalGames > 0 ? Math.round((stats.wins / stats.totalGames) * 1000) / 10 : 0;

      return {
        userId: u.id,
        username: u.username,
        avatar: u.avatar ?? null,
        country: u.country ?? null,
        rating: (u[ratingField] as number) ?? 800,
        wins: stats.wins,
        losses: stats.losses,
        draws: stats.draws,
        totalGames: stats.totalGames,
        winRate,
      };
    });

    // Sort primarily by rating desc, then winRate desc, then wins desc
    rawEntries.sort((a, b) => {
      if (b.rating !== a.rating) return b.rating - a.rating;
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      return b.wins - a.wins;
    });

    // Assign ranks based on sorted order
    const entries = rawEntries.map((entry, index) => ({
      rank: index + 1,
      ...entry,
    }));

    res.json(entries);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get leaderboard" });
  }
});

export default router;
