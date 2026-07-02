import { createClient } from "@libsql/client";
import { Chess } from "chess.js";

const client = createClient({ url: "file:../../sqlite.db" });

async function seed() {
  const puzzles = [];
  
  // Hard Puzzle 1: Queen Sacrifice Mate in 2
  const c1 = new Chess();
  c1.clear();
  c1.put({ type: 'k', color: 'b' }, 'h8');
  c1.put({ type: 'p', color: 'b' }, 'g7');
  c1.put({ type: 'p', color: 'b' }, 'h7');
  c1.put({ type: 'r', color: 'b' }, 'f8');
  c1.put({ type: 'q', color: 'w' }, 'h5');
  c1.put({ type: 'r', color: 'w' }, 'f1');
  c1.put({ type: 'r', color: 'w' }, 'g1');
  c1.put({ type: 'k', color: 'w' }, 'a1'); 
  puzzles.push({
    fen: c1.fen(),
    solution: '["Qxh7+", "Kxh7", "Rh1#"]',
    type: "mate2",
    title: "Sacrifice for the Win",
    description: "A classic Queen sacrifice."
  });

  // Hard Puzzle 2: Smothered Mate in 3
  const c2 = new Chess();
  c2.clear();
  c2.put({ type: 'k', color: 'b' }, 'g8');
  c2.put({ type: 'p', color: 'b' }, 'h7');
  c2.put({ type: 'r', color: 'b' }, 'f8');
  c2.put({ type: 'q', color: 'w' }, 'd5');
  c2.put({ type: 'n', color: 'w' }, 'f7');
  c2.put({ type: 'k', color: 'w' }, 'h1');
  puzzles.push({
    fen: c2.fen(),
    solution: '["Nh6+", "Kh8", "Qg8+", "Rxg8", "Nf7#"]',
    type: "mate3",
    title: "Smothered Mate Sequence",
    description: "Force the king into a corner."
  });

  // Hard Puzzle 3: Boden's Mate Setup
  const c3 = new Chess();
  c3.clear();
  c3.put({ type: 'k', color: 'b' }, 'c8');
  c3.put({ type: 'p', color: 'b' }, 'b7');
  c3.put({ type: 'p', color: 'b' }, 'd7');
  c3.put({ type: 'r', color: 'b' }, 'd8');
  c3.put({ type: 'q', color: 'w' }, 'a4');
  c3.put({ type: 'n', color: 'b' }, 'c6');
  c3.put({ type: 'b', color: 'w' }, 'f4');
  c3.put({ type: 'b', color: 'w' }, 'a6');
  c3.put({ type: 'k', color: 'w' }, 'h1');
  puzzles.push({
    fen: c3.fen(),
    solution: '["Qxc6+", "bxc6", "Ba6#"]',
    type: "mate2",
    title: "Boden's Mate Setup",
    description: "Double bishop power."
  });

  for (const p of puzzles) {
    await client.execute({
      sql: "INSERT INTO puzzles (fen, solution, type, title, description, rating, is_daily, created_at) VALUES (?, ?, ?, ?, ?, 2000, 1, ?)",
      args: [p.fen, p.solution, p.type, p.title, p.description, Date.now()]
    });
  }
  console.log(`Inserted ${puzzles.length} hard puzzles.`);
}
seed();
