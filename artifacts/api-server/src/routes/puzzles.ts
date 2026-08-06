import { Router } from "express";
import { db } from "@workspace/db";
import { puzzlesTable, puzzleAttemptsTable, puzzleStreaksTable, ratingsTable } from "@workspace/db";
import { eq, and, desc, sql, ne } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { formatPuzzle } from "./users";

const router = Router();

const DEFAULT_PUZZLES = [
  {
    title: "Back-Rank Checkmate",
    description: "Exploit the weak back rank to deliver checkmate.",
    type: "mate1" as const,
    fen: "3r2k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1",
    solution: ["Rxd8#"],
    rating: 1000
  },
  {
    title: "Queen & Rook Battery Checkmate",
    description: "Infiltrate the enemy position with a queen sacrifice sequence.",
    type: "mate2" as const,
    fen: "r1b2rk1/pp3ppp/2p5/8/4Q3/8/PPP2PPP/R3R1K1 w - - 0 1",
    solution: ["Qe8", "Rxe8", "Rxe8#"],
    rating: 1200
  },
  {
    title: "Greek Gift Checkmate",
    description: "Sacrifice the bishop on h7 to force checkmate with the queen.",
    type: "mate2" as const,
    fen: "r1bq1rk1/ppp2ppp/2n1p3/3p4/3P2Q1/2PBP3/PP3PPP/R3K2R w KQ - 0 1",
    solution: ["Bxh7+", "Kxh7", "Qh5#"],
    rating: 1400
  },
  {
    title: "Smothered Checkmate",
    description: "Deliver a classic 1-move smothered checkmate with your knight.",
    type: "mate1" as const,
    fen: "6rk/5ppp/8/4N3/8/8/8/6K1 w - - 0 1",
    solution: ["Nxf7#"],
    rating: 1300
  },
  {
    title: "Greek Gift Attack",
    description: "Sacrifice the bishop on h7 to launch a winning kingside attack.",
    type: "tactical" as const,
    fen: "r1bq1rk1/ppp2ppp/2n1p3/3p4/3P4/2PBPN2/PP3PPP/R2QK2R w KQ - 0 1",
    solution: ["Bxh7+", "Kxh7", "Ng5+"],
    rating: 1450
  },
  {
    title: "Central Queen Pin & Simplification",
    description: "Use the pin to force a favorable queen exchange.",
    type: "tactical" as const,
    fen: "r1b1k2r/pppp1ppp/8/4q3/8/2N5/PPP2PPP/R2QKB1R w KQkq - 0 1",
    solution: ["Qe2", "Qxe2+", "Nxe2"],
    rating: 1100
  },
  {
    title: "Rook Skewer",
    description: "Skewer Black's king and rook along the c-file.",
    type: "tactical" as const,
    fen: "8/8/8/4k3/8/2R5/8/4K3 w - - 0 1",
    solution: ["Rc5+", "Kd6", "Rc8"],
    rating: 1350
  },
  {
    title: "King & Pawn Endgame Escort",
    description: "Use key squares to safely escort your pawn to promotion.",
    type: "endgame" as const,
    fen: "4k3/8/4K3/4P3/8/8/8/8 w - - 0 1",
    solution: ["Kd6", "Kd8", "e6", "Ke8", "e7", "Kf7", "Kd7"],
    rating: 1000
  },
  {
    title: "Rook vs King Endgame Cutoff",
    description: "Cut off the enemy king and force it to the edge of the board.",
    type: "endgame" as const,
    fen: "8/8/8/4k3/R7/8/8/4K3 w - - 0 1",
    solution: ["Ra5+", "Kd4", "Kd2", "Kc4", "Kc2", "Kb4", "Ra1"],
    rating: 1150
  },
  {
    title: "Ruy Lopez Main Line Tactic",
    description: "Develop with tempo and dominate the center.",
    type: "tactical" as const,
    fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
    solution: ["Bb5", "a6", "Ba4", "Nf6"],
    rating: 1050
  }
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
