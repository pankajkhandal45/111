import { Router } from "express";
import { db } from "@workspace/db";
import { puzzlesTable, puzzleAttemptsTable, puzzleStreaksTable, ratingsTable } from "@workspace/db";
import { eq, and, desc, sql, ne } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { formatPuzzle } from "./users";

const router = Router();

const DEFAULT_PUZZLES = [
  {
    fen: "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
    solution: ["Ng5", "d5", "exd5", "Na5"],
    type: "tactical" as const,
    difficulty: "beginner" as const,
    title: "Fork the Queen",
    description: "Find the winning tactic for White.",
  },
  {
    fen: "r2qkb1r/ppp2ppp/2n1pn2/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R w KQkq - 0 6",
    solution: ["d5", "Ne5", "Nxe5", "dxe5"],
    type: "tactical" as const,
    difficulty: "beginner" as const,
    title: "Central Breakthrough",
    description: "Push for central control.",
  },
  {
    fen: "5rk1/pp3ppp/2p5/8/3Pn3/2P1B3/PP3PPP/R4RK1 b - - 0 1",
    solution: ["Nxf2", "Rxf2", "Rxf2"],
    type: "tactical" as const,
    difficulty: "intermediate" as const,
    title: "Sacrifice for Material",
    description: "Black wins material with accurate play.",
  },
  {
    fen: "r1b2rk1/pp2ppbp/2np1np1/q7/3NP3/2N1BP2/PPPQ2PP/R3KB1R w KQ - 0 9",
    solution: ["Nb3", "Qb6", "Be2"],
    type: "tactical" as const,
    difficulty: "intermediate" as const,
    title: "Queen Chase",
    description: "Drive the queen away with tempo.",
  },
  {
    fen: "r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10",
    solution: ["Nd5", "Nxd5", "exd5"],
    type: "tactical" as const,
    difficulty: "advanced" as const,
    title: "Knight Outpost",
    description: "Establish a dominant knight.",
  },
  {
    fen: "2kr3r/ppp1qppp/2n1b3/3p4/3P4/2N1BN2/PPP1QPPP/2KR3R w - - 0 1",
    solution: ["Nb5", "Qb4", "Nd6+", "Kc7", "Nxf7"],
    type: "tactical" as const,
    difficulty: "advanced" as const,
    title: "Knight Invasion",
    description: "White's knight launches a decisive attack.",
  },
  {
    fen: "4k3/8/4K3/4P3/8/8/8/8 w - - 0 1",
    solution: ["Kd6", "Kd8", "e6", "Ke8", "e7", "Kf7", "Kd7"],
    type: "endgame" as const,
    difficulty: "beginner" as const,
    title: "King and Pawn Endgame",
    description: "Escort the pawn to promotion.",
  },
  {
    fen: "8/8/1p6/pPp5/P1P5/8/5K1k/8 b - - 0 1",
    solution: ["Kh3", "Kf3", "b5", "axb5", "a4"],
    type: "endgame" as const,
    difficulty: "intermediate" as const,
    title: "Pawn Breakthrough",
    description: "Find the winning pawn advance.",
  },
  {
    fen: "8/8/8/4k3/R7/8/8/4K3 w - - 0 1",
    solution: ["Ra5+", "Kd4", "Kd2", "Kc4", "Kc2", "Kb4", "Ra1"],
    type: "endgame" as const,
    difficulty: "intermediate" as const,
    title: "Rook vs King",
    description: "Force the king to the edge.",
  },
  {
    fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
    solution: ["Bb5", "a6", "Ba4", "Nf6"],
    type: "tactical" as const,
    difficulty: "beginner" as const,
    title: "Ruy Lopez",
    description: "Play the classic Ruy Lopez opening.",
  },
];

async function autoSeedPuzzles() {
  try {
    for (const puzzle of DEFAULT_PUZZLES) {
      await db.insert(puzzlesTable).values({
        fen: puzzle.fen,
        solution: JSON.stringify(puzzle.solution),
        type: puzzle.type,
        title: puzzle.title,
        description: puzzle.description,
      }).onConflictDoNothing();
    }
  } catch (err) {
    // Ignore if DB is read-only
  }
}

// GET /api/puzzles/daily
router.get("/puzzles/daily", async (req, res) => {
  try {
    let [puzzle] = await db.select().from(puzzlesTable).orderBy(sql`RANDOM()`).limit(1);

    if (!puzzle) {
      await autoSeedPuzzles();
      [puzzle] = await db.select().from(puzzlesTable).orderBy(sql`RANDOM()`).limit(1);
    }

    if (!puzzle) {
      const fallback = DEFAULT_PUZZLES[Math.floor(Math.random() * DEFAULT_PUZZLES.length)];
      res.json(formatPuzzle({
        id: 1,
        fen: fallback.fen,
        solution: fallback.solution,
        type: fallback.type,
        rating: 1200,
        title: fallback.title,
        description: fallback.description,
        isDaily: true,
      }));
      return;
    }

    res.json(formatPuzzle(puzzle));
  } catch (err) {
    req.log.error(err);
    const fallback = DEFAULT_PUZZLES[0];
    res.json(formatPuzzle({
      id: 1,
      fen: fallback.fen,
      solution: fallback.solution,
      type: fallback.type,
      rating: 1200,
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
