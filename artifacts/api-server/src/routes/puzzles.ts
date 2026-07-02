import { Router } from "express";
import { db } from "@workspace/db";
import { puzzlesTable, puzzleAttemptsTable, puzzleStreaksTable, ratingsTable } from "@workspace/db";
import { eq, and, desc, sql, ne } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { formatPuzzle } from "./users";

const router = Router();

// GET /api/puzzles/daily
router.get("/puzzles/daily", async (req, res) => {
  try {
    const puzzles = await db.query.puzzlesTable.findMany();

    if (!puzzles || puzzles.length === 0) {
      res.status(404).json({ error: "No puzzles available" });
      return;
    }

    const puzzle = puzzles[Math.floor(Math.random() * puzzles.length)];
    res.json(formatPuzzle(puzzle));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get daily puzzle" });
  }
});

// GET /api/puzzles/streak
router.get("/puzzles/streak", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [streak] = await db.select().from(puzzleStreaksTable)
      .where(eq(puzzleStreaksTable.userId, req.userId!)).limit(1);
    res.json({
      current: streak?.current ?? 0,
      best: streak?.best ?? 0,
      lastSolvedAt: streak?.lastSolvedAt ?? null,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get streak" });
  }
});

// GET /api/puzzles
router.get("/puzzles", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string || "10"), 50);
    const type = req.query.type as string | undefined;

    const where = type ? eq(puzzlesTable.type, type as any) : undefined;
    const puzzles = await db.query.puzzlesTable.findMany({
      where,
      orderBy: [desc(puzzlesTable.createdAt)],
      limit,
    });

    res.json(puzzles.map(formatPuzzle));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list puzzles" });
  }
});

// POST /api/puzzles/:id/solve
router.post("/puzzles/:id/solve", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const { solved, timeTakenMs } = req.body;
    const userId = req.userId!;

    const [puzzle] = await db.select().from(puzzlesTable).where(eq(puzzlesTable.id, id)).limit(1);
    if (!puzzle) { res.status(404).json({ error: "Puzzle not found" }); return; }

    // Get/update rating
    let [rating] = await db.select().from(ratingsTable).where(eq(ratingsTable.userId, userId)).limit(1);
    if (!rating) {
      await db.insert(ratingsTable).values({ userId });
      [rating] = await db.select().from(ratingsTable).where(eq(ratingsTable.userId, userId)).limit(1);
    }

    const ratingChange = solved ? Math.floor(Math.random() * 20) + 5 : -(Math.floor(Math.random() * 15) + 5);
    const newPuzzleRating = Math.max(400, (rating?.puzzleRating ?? 800) + ratingChange);

    await db.update(ratingsTable).set({ puzzleRating: newPuzzleRating }).where(eq(ratingsTable.userId, userId));

    // Update streak
    let [streak] = await db.select().from(puzzleStreaksTable).where(eq(puzzleStreaksTable.userId, userId)).limit(1);
    let newCurrent = solved ? (streak?.current ?? 0) + 1 : 0;
    let newBest = Math.max(streak?.best ?? 0, newCurrent);

    if (streak) {
      await db.update(puzzleStreaksTable).set({
        current: newCurrent,
        best: newBest,
        lastSolvedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(puzzleStreaksTable.userId, userId));
    } else {
      await db.insert(puzzleStreaksTable).values({
        userId,
        current: newCurrent,
        best: newBest,
        lastSolvedAt: new Date(),
      });
    }

    await db.insert(puzzleAttemptsTable).values({
      userId,
      puzzleId: id,
      solved,
      timeTakenMs,
      ratingChange,
    });

    const solution = typeof puzzle.solution === "string" ? JSON.parse(puzzle.solution) : puzzle.solution;

    res.json({
      solved,
      ratingChange,
      newRating: newPuzzleRating,
      streak: newCurrent,
      correctSolution: solution,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to submit puzzle" });
  }
});

export default router;
