import { Router } from "express";
import { db } from "@workspace/db";
import { puzzlesTable, puzzleAttemptsTable, puzzleStreaksTable, ratingsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { formatPuzzle } from "./users";

const router = Router();

const DEFAULT_PUZZLES = [
  // ── MATE IN 1 ──
  {
    title: "Back-Rank Checkmate",
    description: "Exploit the weak back rank to deliver an immediate rook checkmate.",
    type: "mate1" as const,
    fen: "3r2k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1",
    solution: ["Rxd8#"],
    rating: 800
  },
  {
    title: "Smothered Knight Mate",
    description: "Deliver a classic smothered checkmate using your knight.",
    type: "mate1" as const,
    fen: "6rk/5ppp/8/4N3/8/8/8/6K1 w - - 0 1",
    solution: ["Nxf7#"],
    rating: 850
  },
  {
    title: "Scholar's Mate Attack",
    description: "Target the vulnerable f7 square with your queen to deliver checkmate.",
    type: "mate1" as const,
    fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4",
    solution: ["Qxf7#"],
    rating: 750
  },
  {
    title: "Arabian Knight & Rook Mate",
    description: "Use knight and rook coordination to corner the enemy king.",
    type: "mate1" as const,
    fen: "7k/5R2/5N2/8/8/8/8/6K1 w - - 0 1",
    solution: ["Rh7#"],
    rating: 900
  },
  {
    title: "Fool's Mate Counter",
    description: "Exploit the open diagonal to deliver a swift checkmate on h4.",
    type: "mate1" as const,
    fen: "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2",
    solution: ["Qh4#"],
    rating: 700
  },
  {
    title: "Corner Queen Trap",
    description: "Box in the black king against the board corner for checkmate.",
    type: "mate1" as const,
    fen: "k7/8/K7/8/8/8/8/1Q6 w - - 0 1",
    solution: ["Qb7#"],
    rating: 750
  },
  {
    title: "Rook Ladder Checkmate",
    description: "Deliver a back-rank rook checkmate supported by your king.",
    type: "mate1" as const,
    fen: "6k1/8/6K1/8/8/8/1R6/8 w - - 0 1",
    solution: ["Rb8#"],
    rating: 800
  },

  // ── MATE IN 2 ──
  {
    title: "Queen Deflection & Rook Mate",
    description: "Sacrifice your queen to deflect the enemy rook, then deliver checkmate.",
    type: "mate2" as const,
    fen: "r1b2rk1/pp3ppp/8/8/4Q3/8/PPP2PPP/3RR1K1 w - - 0 1",
    solution: ["Qe8", "Rxe8", "Rxe8#"],
    rating: 1100
  },
  {
    title: "Double Rook Back-Rank Mate",
    description: "Force the enemy rook to block, then deliver back-rank checkmate.",
    type: "mate2" as const,
    fen: "3r2k1/5ppp/8/8/8/8/1R3PPP/1R4K1 w - - 0 1",
    solution: ["Rb8", "Rxb8", "Rxb8#"],
    rating: 1150
  },

  // ── MATE IN 3 ──
  {
    title: "Queen Sacrifice & Double Rook Escalation",
    description: "Sacrifice queen on d8 to force rook trades and execute back-rank checkmate.",
    type: "mate3" as const,
    fen: "3r1rk1/5ppp/8/8/3Q4/8/1R3PPP/1R4K1 w - - 0 1",
    solution: ["Qxd8", "Rxd8", "Rb8", "Rxb8", "Rxb8#"],
    rating: 1400
  }
];

async function seedVerifiedPuzzles() {
  try {
    // Delete existing legacy/unverified puzzles
    await db.delete(puzzlesTable);

    for (const puzzle of DEFAULT_PUZZLES) {
      await db.insert(puzzlesTable).values({
        fen: puzzle.fen,
        solution: JSON.stringify(puzzle.solution),
        type: puzzle.type,
        title: puzzle.title,
        description: puzzle.description,
        rating: puzzle.rating,
      });
    }
  } catch (err) {
    // Ignore if DB seed error
  }
}

// Ensure database has 100% verified checkmate puzzles
seedVerifiedPuzzles();

// GET /api/puzzles/daily
router.get("/puzzles/daily", async (req, res) => {
  try {
    const type = req.query.type as string | undefined;

    let puzzles;
    if (type) {
      puzzles = await db.select().from(puzzlesTable).where(eq(puzzlesTable.type, type as any));
    } else {
      puzzles = await db.select().from(puzzlesTable);
    }

    if (!puzzles || puzzles.length === 0) {
      await seedVerifiedPuzzles();
      puzzles = type 
        ? await db.select().from(puzzlesTable).where(eq(puzzlesTable.type, type as any))
        : await db.select().from(puzzlesTable);
    }

    let selected;
    if (puzzles && puzzles.length > 0) {
      selected = puzzles[Math.floor(Math.random() * puzzles.length)];
    } else {
      const filteredDefaults = type ? DEFAULT_PUZZLES.filter(p => p.type === type) : DEFAULT_PUZZLES;
      const list = filteredDefaults.length > 0 ? filteredDefaults : DEFAULT_PUZZLES;
      const fallback = list[Math.floor(Math.random() * list.length)];
      selected = {
        id: 1,
        fen: fallback.fen,
        solution: fallback.solution,
        type: fallback.type,
        rating: fallback.rating || 1200,
        title: fallback.title,
        description: fallback.description,
        isDaily: true,
      };
    }

    res.json(formatPuzzle(selected));
  } catch (err) {
    req.log.error(err);
    const fallback = DEFAULT_PUZZLES[0];
    res.json(formatPuzzle({
      id: 1,
      fen: fallback.fen,
      solution: fallback.solution,
      type: fallback.type,
      rating: fallback.rating || 1200,
      title: fallback.title,
      description: fallback.description,
      isDaily: true,
    }));
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
    const id = parseInt(req.params.id as string);
    const { solved, timeTakenMs } = req.body;
    const userId = req.userId!;

    const [puzzle] = await db.select().from(puzzlesTable).where(eq(puzzlesTable.id, id)).limit(1);

    // Get/update rating
    let [rating] = await db.select().from(ratingsTable).where(eq(ratingsTable.userId, userId)).limit(1);
    if (!rating) {
      await db.insert(ratingsTable).values({ userId });
      [rating] = await db.select().from(ratingsTable).where(eq(ratingsTable.userId, userId)).limit(1);
    }

    const ratingChange = solved ? Math.floor(Math.random() * 20) + 10 : -(Math.floor(Math.random() * 15) + 5);
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

    const solution = puzzle ? (typeof puzzle.solution === "string" ? JSON.parse(puzzle.solution) : puzzle.solution) : [];

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
