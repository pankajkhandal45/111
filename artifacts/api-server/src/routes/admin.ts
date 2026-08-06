import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, ratingsTable, gamesTable, puzzlesTable, movesTable } from "@workspace/db";
import { eq, desc, count, and, or, sql, lt, gt } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth";
import type { Response, NextFunction } from "express";

const router = Router();

async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  await requireAuth(req, res, async () => {
    if (req.user?.role !== "admin") {
      res.status(403).json({ error: "Forbidden: admin only" });
      return;
    }
    next();
  });
}

// GET /api/admin/stats
router.get("/admin/stats", requireAdmin, async (req: AuthRequest, res) => {
  try {
    // Auto-abandon stale active games whose last update was >5 minutes ago
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    await db.update(gamesTable)
      .set({ status: "abandoned", resultReason: "abandoned", updatedAt: new Date() })
      .where(and(eq(gamesTable.status, "active"), lt(gamesTable.updatedAt, fiveMinutesAgo)));

    const [totalUsers] = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.isGuest, false));
    const [totalGames] = await db.select({ count: count() }).from(gamesTable);
    const [activeGames] = await db.select({ count: count() }).from(gamesTable).where(
      and(eq(gamesTable.status, "active"), gt(gamesTable.updatedAt, fiveMinutesAgo))
    );
    const [finishedGames] = await db.select({ count: count() }).from(gamesTable).where(eq(gamesTable.status, "finished"));
    const [totalMoves] = await db.select({ count: count() }).from(movesTable);
    const [totalPuzzles] = await db.select({ count: count() }).from(puzzlesTable);
    const [onlineUsers] = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.isOnline, true));

    const recentGames = await db.query.gamesTable.findMany({
      orderBy: [desc(gamesTable.createdAt)],
      limit: 5,
      with: {
        whitePlayer: { columns: { id: true, username: true, avatar: true } },
        blackPlayer: { columns: { id: true, username: true, avatar: true } },
      },
    });

    res.json({
      totalUsers: totalUsers.count,
      totalGames: totalGames.count,
      activeGames: activeGames.count,
      finishedGames: finishedGames.count,
      totalMoves: totalMoves.count,
      totalPuzzles: totalPuzzles.count,
      onlineUsers: onlineUsers.count,
      recentGames: recentGames.map(g => ({
        id: g.id,
        status: g.status,
        result: g.result ?? null,
        mode: g.mode,
        timeControl: g.timeControl,
        whitePlayer: g.whitePlayer ? { id: g.whitePlayer.id, username: g.whitePlayer.username } : null,
        blackPlayer: g.blackPlayer ? { id: g.blackPlayer.id, username: g.blackPlayer.username } : null,
        createdAt: g.createdAt,
      })),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get stats" });
  }
});

// GET /api/admin/users
router.get("/admin/users", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string || "50"), 100);
    const offset = parseInt(req.query.offset as string || "0");

    const users = await db.select({
      id: usersTable.id,
      username: usersTable.username,
      email: usersTable.email,
      role: usersTable.role,
      isGuest: usersTable.isGuest,
      isOnline: usersTable.isOnline,
      avatar: usersTable.avatar,
      country: usersTable.country,
      createdAt: usersTable.createdAt,
      lastSeen: usersTable.lastSeen,
    }).from(usersTable)
      .orderBy(desc(usersTable.createdAt))
      .limit(limit)
      .offset(offset);

    const usersWithRatings = await Promise.all(users.map(async (u) => {
      const [rating] = await db.select().from(ratingsTable).where(eq(ratingsTable.userId, u.id)).limit(1);
      const [gamesCount] = await db.select({ count: count() }).from(gamesTable).where(
        or(eq(gamesTable.whitePlayerId, u.id), eq(gamesTable.blackPlayerId, u.id))
      );
      return {
        ...u,
        ratings: rating ? { bullet: rating.bullet, blitz: rating.blitz, rapid: rating.rapid, classical: rating.classical } : null,
        gamesPlayed: gamesCount.count,
      };
    }));

    const [totalCount] = await db.select({ count: count() }).from(usersTable);

    res.json({ users: usersWithRatings, total: totalCount.count });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get users" });
  }
});

// PATCH /api/admin/users/:id/role
router.patch("/admin/users/:id/role", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const { role } = req.body;
    if (!["user", "admin"].includes(role)) {
      res.status(400).json({ error: "Invalid role" });
      return;
    }
    if (id === req.userId) {
      res.status(400).json({ error: "Cannot change your own role" });
      return;
    }
    const [updated] = await db.update(usersTable)
      .set({ role, updatedAt: new Date() })
      .where(eq(usersTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "User not found" }); return; }
    res.json({ id: updated.id, username: updated.username, role: updated.role });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update role" });
  }
});

// DELETE /api/admin/users/:id
router.delete("/admin/users/:id", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid user ID" });
      return;
    }
    if (id === req.userId) {
      res.status(400).json({ error: "Cannot delete yourself" });
      return;
    }

    // Delete games involving this user first to avoid SQLite foreign key constraint failure
    await db.delete(gamesTable).where(
      or(
        eq(gamesTable.whitePlayerId, id),
        eq(gamesTable.blackPlayerId, id)
      )
    );

    const [deleted] = await db.delete(usersTable).where(eq(usersTable.id, id)).returning();
    if (!deleted) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({ success: true, id });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// GET /api/admin/games
router.get("/admin/games", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string || "20"), 50);
    const offset = parseInt(req.query.offset as string || "0");
    const status = req.query.status as string | undefined;

    const games = await db.query.gamesTable.findMany({
      where: status ? eq(gamesTable.status, status as any) : undefined,
      orderBy: [desc(gamesTable.createdAt)],
      limit,
      offset,
      with: {
        whitePlayer: { columns: { id: true, username: true, avatar: true } },
        blackPlayer: { columns: { id: true, username: true, avatar: true } },
      },
    });

    const [totalCount] = await db.select({ count: count() }).from(gamesTable);

    res.json({
      games: games.map(g => ({
        id: g.id,
        status: g.status,
        result: g.result ?? null,
        resultReason: g.resultReason ?? null,
        mode: g.mode,
        timeControl: g.timeControl,
        botLevel: g.botLevel ?? null,
        whitePlayer: g.whitePlayer ? { id: g.whitePlayer.id, username: g.whitePlayer.username } : null,
        blackPlayer: g.blackPlayer ? { id: g.blackPlayer.id, username: g.blackPlayer.username } : null,
        createdAt: g.createdAt,
      })),
      total: totalCount.count,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get games" });
  }
});

// POST /api/admin/puzzles
router.post("/admin/puzzles", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { fen, solution, type, rating, title, description, isDaily } = req.body;
    if (!fen || !solution || !type) {
      res.status(400).json({ error: "fen, solution, type required" });
      return;
    }
    const [puzzle] = await db.insert(puzzlesTable).values({
      fen,
      solution: JSON.stringify(solution),
      type,
      rating: rating || 1200,
      title: title || "Untitled",
      description: description || null,
      isDaily: isDaily || false,
      dailyDate: isDaily ? new Date().toISOString().split("T")[0] : null,
    }).returning();
    res.status(201).json(puzzle);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create puzzle" });
  }
});

export default router;
