import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, ratingsTable, gamesTable } from "@workspace/db";
import { eq, or, desc, and, like } from "drizzle-orm";

const router = Router();

// GET /api/leaderboard
router.get("/leaderboard", async (req, res) => {
  try {
    const timeControl = (req.query.timeControl as string) || "blitz";
    const limit = Math.min(parseInt(req.query.limit as string || "50"), 100);

    const ratingField = timeControl as "bullet" | "blitz" | "rapid" | "classical";

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
      .where(eq(usersTable.isGuest, false))
      .orderBy(desc(ratingsTable[ratingField]))
      .limit(limit);

    // Get wins/losses/draws for each user
    const entries = await Promise.all(users.map(async (u, i) => {
      const games = await db.select().from(gamesTable).where(
        and(
          or(eq(gamesTable.whitePlayerId, u.id), eq(gamesTable.blackPlayerId, u.id)),
          eq(gamesTable.status, "finished"),
          like(gamesTable.timeControl, `${timeControl}%`)
        )
      ).limit(100);

      let wins = 0, losses = 0, draws = 0;
      for (const g of games) {
        const isWhite = g.whitePlayerId === u.id;
        if (g.result === "draw") draws++;
        else if ((g.result === "white" && isWhite) || (g.result === "black" && !isWhite)) wins++;
        else losses++;
      }

      return {
        rank: i + 1,
        userId: u.id,
        username: u.username,
        avatar: u.avatar ?? null,
        country: u.country ?? null,
        rating: u[ratingField] as number,
        wins,
        losses,
        draws,
        winRate: games.length > 0 ? Math.round((wins / games.length) * 1000) / 10 : 0,
      };
    }));

    res.json(entries);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get leaderboard" });
  }
});

export default router;
