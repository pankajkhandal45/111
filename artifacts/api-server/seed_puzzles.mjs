import { createClient } from "@libsql/client";

const client = createClient({ url: "file:../../sqlite.db" });

async function seed() {
  const puzzles = [
    {
      fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 3",
      solution: '["Qxf7#"]',
      type: "mate1",
      title: "Scholar's Mate",
      description: "Find the mate in 1."
    },
    {
      fen: "rnbqkbnr/ppppp2p/5p2/6p1/4P3/3P4/PPP2PPP/RNBQKBNR w KQkq - 0 3",
      solution: '["Qh5#"]',
      type: "mate1",
      title: "Fool's Mate",
      description: "Find the fastest mate."
    },
    {
      fen: "6k1/1R6/6K1/8/8/8/8/8 w - - 0 1",
      solution: '["Rb8#"]',
      type: "mate1",
      title: "Back Rank Mate",
      description: "Deliver the final blow."
    },
    {
      fen: "8/1R6/8/8/8/8/6K1/6k1 b - - 0 1",
      solution: '["Kh1", "Rb1#"]',
      type: "mate2",
      title: "Mate in 2",
      description: "Find the mate sequence."
    },
    {
      fen: "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 6 5",
      solution: '["O-O"]',
      type: "tactical",
      title: "Castle",
      description: "King safety first."
    }
  ];

  for (const p of puzzles) {
    await client.execute({
      sql: "INSERT INTO puzzles (fen, solution, type, title, description, rating, is_daily, created_at) VALUES (?, ?, ?, ?, ?, 1000, 1, ?)",
      args: [p.fen, p.solution, p.type, p.title, p.description, Date.now()]
    });
  }
  console.log("Puzzles inserted.");
}
seed();
