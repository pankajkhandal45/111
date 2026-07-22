import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, ratingsTable, gamesTable, movesTable, puzzleStreaksTable, puzzlesTable } from "@workspace/db";
import { eq, and, or, desc, count, sql, ne } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { formatUser } from "./auth";

const router = Router();

// GET /api/users/:username
router.get("/users/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const [rating] = await db.select().from(ratingsTable).where(eq(ratingsTable.userId, user.id)).limit(1);
    const ratings = rating
      ? { bullet: rating.bullet, blitz: rating.blitz, rapid: rating.rapid, classical: rating.classical }
      : { bullet: 800, blitz: 800, rapid: 800, classical: 800 };

    // Recent games
    const recentGames = await db.query.gamesTable.findMany({
      where: or(eq(gamesTable.whitePlayerId, user.id), eq(gamesTable.blackPlayerId, user.id)),
      orderBy: [desc(gamesTable.createdAt)],
      limit: 10,
      with: {
        whitePlayer: { columns: { id: true, username: true, avatar: true } },
        blackPlayer: { columns: { id: true, username: true, avatar: true } },
      },
    });

    res.json({
      id: user.id,
      username: user.username,
      isGuest: user.isGuest,
      avatar: user.avatar,
      country: user.country,
      bio: user.bio,
      createdAt: user.createdAt,
      ratings,
      recentGames: recentGames.map(formatGameSummary),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get user profile" });
  }
});

// GET /api/users/:username/stats
router.get("/users/:username/stats", async (req, res) => {
  try {
    const { username } = req.params;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const games = await db.select({
      whitePlayerId: gamesTable.whitePlayerId,
      blackPlayerId: gamesTable.blackPlayerId,
      result: gamesTable.result,
      whiteAccuracy: gamesTable.whiteAccuracy,
      blackAccuracy: gamesTable.blackAccuracy,
    }).from(gamesTable).where(
      and(
        or(eq(gamesTable.whitePlayerId, user.id), eq(gamesTable.blackPlayerId, user.id)),
        eq(gamesTable.status, "finished"),
        ne(gamesTable.mode, "local")
      )
    );

    let wins = 0, losses = 0, draws = 0;
    const accuracies: number[] = [];
    for (const g of games) {
      const isWhite = g.whitePlayerId === user.id;
      if (g.result === "draw") draws++;
      else if ((g.result === "white" && isWhite) || (g.result === "black" && !isWhite)) wins++;
      else losses++;

      const acc = isWhite ? g.whiteAccuracy : g.blackAccuracy;
      if (acc != null) accuracies.push(acc);
    }

    const total = games.length;
    const winRate = total > 0 ? (wins / total) * 100 : 0;
    const avgAccuracy = accuracies.length > 0 ? accuracies.reduce((a, b) => a + b, 0) / accuracies.length : 0;

    const [streak] = await db.select().from(puzzleStreaksTable).where(eq(puzzleStreaksTable.userId, user.id)).limit(1);
    const [rating] = await db.select().from(ratingsTable).where(eq(ratingsTable.userId, user.id)).limit(1);

    res.json({
      totalGames: total,
      wins,
      losses,
      draws,
      winRate: Math.round(winRate * 10) / 10,
      accuracy: Math.round(avgAccuracy * 10) / 10,
      bestRating: rating ? Math.max(rating.bullet, rating.blitz, rating.rapid, rating.classical) : 800,
      currentStreak: streak?.current ?? 0,
      puzzleRating: rating?.puzzleRating ?? 800,
      recentAccuracies: accuracies.slice(-10),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get stats" });
  }
});

// PATCH /api/users/me — update profile (username, bio, country, avatar)
router.patch("/users/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { username, bio, country, avatar } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (bio !== undefined) updates.bio = bio;
    if (country !== undefined) updates.country = country;
    if (avatar !== undefined) updates.avatar = avatar;
    if (username !== undefined) {
      if (username.length < 3 || username.length > 20) {
        res.status(400).json({ error: "Username must be 3-20 characters" });
        return;
      }
      const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, username)).limit(1);
      if (existing.length > 0 && existing[0].id !== req.userId) {
        res.status(400).json({ error: "Username already taken" });
        return;
      }
      updates.username = username;
    }
    const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, req.userId!)).returning();
    res.json(formatUser(updated));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// PATCH /api/users/me/profile (alias)
router.patch("/users/me/profile", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { bio, country, avatar } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (bio !== undefined) updates.bio = bio;
    if (country !== undefined) updates.country = country;
    if (avatar !== undefined) updates.avatar = avatar;
    const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, req.userId!)).returning();
    res.json(formatUser(updated));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// PATCH /api/users/me/password
router.patch("/users/me/password", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "currentPassword and newPassword required" });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: "New password must be at least 6 characters" });
      return;
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    if (!user?.passwordHash) {
      res.status(400).json({ error: "Cannot change password for this account" });
      return;
    }
    const bcrypt = await import("bcrypt");
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }
    const newHash = await bcrypt.hash(newPassword, 10);
    await db.update(usersTable).set({ passwordHash: newHash, updatedAt: new Date() }).where(eq(usersTable.id, req.userId!));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to change password" });
  }
});

// DELETE /api/users/me
router.delete("/users/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    // SQLite doesn't always enforce FK cascades — delete in correct dependency order
    // 1. Delete all games involving this user (since whitePlayerId cannot be null)
    await db.delete(gamesTable)
      .where(or(
        eq(gamesTable.whitePlayerId, userId),
        eq(gamesTable.blackPlayerId, userId)
      ));

    // 2. Delete tables that reference userId with cascade (handled by schema)
    //    friendRequestsTable, friendsTable, notificationsTable, ratingsTable
    //    all have onDelete:"cascade" so they'll auto-delete with the user.
    //    puzzleStreaksTable also has cascade.

    // 3. Delete the user — cascades will clean up the rest
    await db.delete(usersTable).where(eq(usersTable.id, userId));

    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete account" });
  }
});

// GET /api/dashboard
router.get("/dashboard", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const [rating] = await db.select().from(ratingsTable).where(eq(ratingsTable.userId, userId)).limit(1);
    // Always show actual rating; if no row yet, default is 800 (matches DB default)
    const ratings = rating
      ? { bullet: rating.bullet, blitz: rating.blitz, rapid: rating.rapid, classical: rating.classical, puzzleRating: rating.puzzleRating }
      : { bullet: 800, blitz: 800, rapid: 800, classical: 800, puzzleRating: 800 };

    // Recent games
    const recentGames = await db.query.gamesTable.findMany({
      where: and(
        or(eq(gamesTable.whitePlayerId, userId), eq(gamesTable.blackPlayerId, userId)),
        eq(gamesTable.status, "finished")
      ),
      orderBy: [desc(gamesTable.createdAt)],
      limit: 5,
      with: {
        whitePlayer: { columns: { id: true, username: true, avatar: true } },
        blackPlayer: { columns: { id: true, username: true, avatar: true } },
      },
    });

    // Stats (exclude local pass-and-play games from competitive stats)
    const games = await db.select({
      whitePlayerId: gamesTable.whitePlayerId,
      blackPlayerId: gamesTable.blackPlayerId,
      result: gamesTable.result,
      whiteAccuracy: gamesTable.whiteAccuracy,
      blackAccuracy: gamesTable.blackAccuracy,
    }).from(gamesTable).where(
      and(
        or(eq(gamesTable.whitePlayerId, userId), eq(gamesTable.blackPlayerId, userId)),
        eq(gamesTable.status, "finished"),
        ne(gamesTable.mode, "local")
      )
    );
    let wins = 0, losses = 0, draws = 0;
    const accuracies: number[] = [];
    for (const g of games) {
      const isWhite = g.whitePlayerId === userId;
      if (g.result === "draw") draws++;
      else if ((g.result === "white" && isWhite) || (g.result === "black" && !isWhite)) wins++;
      else losses++;
      const acc = isWhite ? g.whiteAccuracy : g.blackAccuracy;
      if (acc != null) accuracies.push(acc);
    }

    const today = new Date().toISOString().split("T")[0];
    let dailyPuzzle = await db.query.puzzlesTable.findFirst({
      where: and(eq(puzzlesTable.isDaily, true), eq(puzzlesTable.dailyDate, today)),
    });
    if (!dailyPuzzle) {
      dailyPuzzle = await db.query.puzzlesTable.findFirst({
        where: eq(puzzlesTable.isDaily, true),
      });
    }
    if (!dailyPuzzle) {
      dailyPuzzle = await db.query.puzzlesTable.findFirst();
    }

    const [streak] = await db.select().from(puzzleStreaksTable).where(eq(puzzleStreaksTable.userId, userId)).limit(1);

    res.json({
      ratings,
      recentGames: recentGames.map(formatGameSummary),
      stats: {
        totalGames: games.length,
        wins,
        losses,
        draws,
        winRate: games.length > 0 ? Math.round((wins / games.length) * 1000) / 10 : 0,
        accuracy: accuracies.length > 0 ? Math.round(accuracies.reduce((a, b) => a + b, 0) / accuracies.length * 10) / 10 : 0,
        bestRating: rating ? Math.max(rating.bullet, rating.blitz, rating.rapid, rating.classical) : 800,
        currentStreak: streak?.current ?? 0,
        puzzleRating: rating?.puzzleRating ?? 800,
        recentAccuracies: accuracies.slice(-10),
      },
      dailyPuzzle: dailyPuzzle ? formatPuzzle(dailyPuzzle) : null,
      unreadNotifications: 0,
      onlineFriends: [],
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get dashboard" });
  }
});

// GET /api/notifications
router.get("/notifications", requireAuth, async (req: AuthRequest, res) => {
  const { notificationsTable } = await import("@workspace/db");
  const notifs = await db.select().from(notificationsTable)
    .where(eq(notificationsTable.userId, req.userId!))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(50);
  res.json(notifs.map(n => ({
    id: n.id,
    type: n.type,
    message: n.message,
    isRead: n.isRead,
    data: n.data ? JSON.parse(n.data) : {},
    createdAt: n.createdAt,
  })));
});

// POST /api/notifications/:id/read
router.post("/notifications/:id/read", requireAuth, async (req: AuthRequest, res) => {
  const { notificationsTable } = await import("@workspace/db");
  const id = parseInt(req.params.id);
  await db.update(notificationsTable).set({ isRead: true })
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, req.userId!)));
  res.json({ success: true });
});

export function formatGameSummary(game: any) {
  const ratings: Record<string, number> = { bullet1: 0, bullet2: 0, blitz3: 0, blitz5: 0, rapid10: 0, rapid15: 0, rapid30: 0, classical60: 0 };
  return {
    id: game.id,
    status: game.status,
    result: game.result ?? null,
    resultReason: game.resultReason ?? null,
    timeControl: game.timeControl,
    mode: game.mode,
    whitePlayer: game.whitePlayer ? {
      id: game.whitePlayer.id,
      username: game.whitePlayer.username,
      avatar: game.whitePlayer.avatar ?? null,
      rating: null,
    } : null,
    blackPlayer: game.blackPlayer ? {
      id: game.blackPlayer.id,
      username: game.blackPlayer.username,
      avatar: game.blackPlayer.avatar ?? null,
      rating: null,
    } : null,
    accuracy: game.whiteAccuracy ?? null,
    opening: game.opening ?? null,
    createdAt: game.createdAt,
  };
}

export function formatPuzzle(p: any) {
  return {
    id: p.id,
    fen: p.fen,
    solution: typeof p.solution === "string" ? JSON.parse(p.solution) : p.solution,
    type: p.type,
    rating: p.rating,
    title: p.title,
    description: p.description ?? null,
    isDaily: p.isDaily,
  };
}

export default router;
