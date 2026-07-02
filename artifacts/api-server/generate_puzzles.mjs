import { createClient } from "@libsql/client";
import { Chess } from "chess.js";

const client = createClient({ url: "file:../../sqlite.db" });

async function seed() {
  const puzzles = [];
  
  // Back rank mates (White to move)
  for(let file of ['a','b','c','d','e']) {
    const chess = new Chess();
    chess.clear();
    chess.put({ type: 'k', color: 'b' }, 'g8');
    chess.put({ type: 'p', color: 'b' }, 'f7');
    chess.put({ type: 'p', color: 'b' }, 'g7');
    chess.put({ type: 'p', color: 'b' }, 'h7');
    chess.put({ type: 'k', color: 'w' }, 'g1');
    chess.put({ type: 'r', color: 'w' }, file + '1');
    
    // Validate if Mate is possible
    const move = file + '8';
    
    puzzles.push({
      fen: chess.fen(),
      solution: `["R${move}#"]`,
      type: "mate1",
      title: "Back Rank Mate",
      description: "Find the mate in 1."
    });
  }

  // Back rank mates (Black to move)
  for(let file of ['a','b','c','d','e']) {
    const chess = new Chess();
    chess.clear();
    chess.put({ type: 'k', color: 'w' }, 'g1');
    chess.put({ type: 'p', color: 'w' }, 'f2');
    chess.put({ type: 'p', color: 'w' }, 'g2');
    chess.put({ type: 'p', color: 'w' }, 'h2');
    chess.put({ type: 'k', color: 'b' }, 'g8');
    chess.put({ type: 'q', color: 'b' }, file + '8');
    // Set turn to black
    const fenTokens = chess.fen().split(' ');
    fenTokens[1] = 'b';
    const fen = fenTokens.join(' ');
    
    puzzles.push({
      fen: fen,
      solution: `["Q${file}1#"]`,
      type: "mate1",
      title: "Back Rank Mate",
      description: "Find the mate in 1."
    });
  }

  // Ladder Mates
  const ladderFiles = ['a','b','c','d'];
  for(let file1 of ladderFiles) {
    const file2 = String.fromCharCode(file1.charCodeAt(0) + 1);
    const chess = new Chess();
    chess.clear();
    chess.put({ type: 'k', color: 'b' }, 'h8');
    chess.put({ type: 'r', color: 'w' }, file1 + '7');
    chess.put({ type: 'r', color: 'w' }, file2 + '6');
    chess.put({ type: 'k', color: 'w' }, 'a1');
    
    puzzles.push({
      fen: chess.fen(),
      solution: `["R${file2}8#"]`,
      type: "mate1",
      title: "Ladder Mate",
      description: "Climb the ladder."
    });
  }

  // Smothered Mates
  const chess3 = new Chess();
  chess3.clear();
  chess3.put({ type: 'k', color: 'b' }, 'h8');
  chess3.put({ type: 'p', color: 'b' }, 'g7');
  chess3.put({ type: 'p', color: 'b' }, 'h7');
  chess3.put({ type: 'r', color: 'b' }, 'g8');
  chess3.put({ type: 'k', color: 'w' }, 'g1');
  chess3.put({ type: 'n', color: 'w' }, 'f5');
  puzzles.push({
    fen: chess3.fen(),
    solution: '["Nf7#"]',
    type: "mate1",
    title: "Smothered Mate",
    description: "Knight delivery."
  });

  for (const p of puzzles) {
    await client.execute({
      sql: "INSERT INTO puzzles (fen, solution, type, title, description, rating, is_daily, created_at) VALUES (?, ?, ?, ?, ?, 1000, 1, ?)",
      args: [p.fen, p.solution, p.type, p.title, p.description, Date.now()]
    });
  }
  console.log(`Successfully generated and inserted ${puzzles.length} new unique puzzles!`);
}
seed();
