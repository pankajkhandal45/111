import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "../../lib/db/src/schema/index";
import { puzzlesTable } from "../../lib/db/src/schema/index";

const puzzles = [
  {
    fen: "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
    solution: ["Ng5", "d5", "exd5", "Na5"],
    type: "tactics" as const,
    difficulty: "beginner" as const,
    title: "Fork the Queen",
    description: "Find the winning tactic for White.",
  },
  {
    fen: "r2qkb1r/ppp2ppp/2n1pn2/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R w KQkq - 0 6",
    solution: ["d5", "Ne5", "Nxe5", "dxe5"],
    type: "tactics" as const,
    difficulty: "beginner" as const,
    title: "Central Breakthrough",
    description: "Push for central control.",
  },
  {
    fen: "5rk1/pp3ppp/2p5/8/3Pn3/2P1B3/PP3PPP/R4RK1 b - - 0 1",
    solution: ["Nxf2", "Rxf2", "Rxf2"],
    type: "tactics" as const,
    difficulty: "intermediate" as const,
    title: "Sacrifice for Material",
    description: "Black wins material with accurate play.",
  },
  {
    fen: "r1b2rk1/pp2ppbp/2np1np1/q7/3NP3/2N1BP2/PPPQ2PP/R3KB1R w KQ - 0 9",
    solution: ["Nb3", "Qb6", "Be2"],
    type: "tactics" as const,
    difficulty: "intermediate" as const,
    title: "Queen Chase",
    description: "Drive the queen away with tempo.",
  },
  {
    fen: "r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10",
    solution: ["Nd5", "Nxd5", "exd5"],
    type: "tactics" as const,
    difficulty: "advanced" as const,
    title: "Knight Outpost",
    description: "Establish a dominant knight.",
  },
  {
    fen: "2kr3r/ppp1qppp/2n1b3/3p4/3P4/2N1BN2/PPP1QPPP/2KR3R w - - 0 1",
    solution: ["Nb5", "Qb4", "Nd6+", "Kc7", "Nxf7"],
    type: "tactics" as const,
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
    type: "opening" as const,
    difficulty: "beginner" as const,
    title: "Ruy Lopez",
    description: "Play the classic Ruy Lopez opening.",
  },
];

async function seed() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("Missing DATABASE_URL");
    process.exit(1);
  }

  const client = createClient({
    url,
    ...(process.env.DATABASE_AUTH_TOKEN ? { authToken: process.env.DATABASE_AUTH_TOKEN } : {}),
  });

  const db = drizzle(client, { schema });

  console.log("Seeding puzzles...");

  for (const puzzle of puzzles) {
    await db.insert(puzzlesTable).values({
      fen: puzzle.fen,
      solution: JSON.stringify(puzzle.solution),
      type: puzzle.type,
      difficulty: puzzle.difficulty,
      title: puzzle.title,
      description: puzzle.description,
    }).onConflictDoNothing();
    console.log(`✓ Added: ${puzzle.title}`);
  }

  console.log(`\nDone! ${puzzles.length} puzzles seeded.`);
  process.exit(0);
}

seed().catch(console.error);
