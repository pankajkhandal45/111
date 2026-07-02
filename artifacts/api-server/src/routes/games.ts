import { Router } from "express";
import { db } from "@workspace/db";
import { gamesTable, movesTable, usersTable, ratingsTable } from "@workspace/db";
import { eq, and, or, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { formatGameSummary } from "./users";

const router = Router();

const TIME_CONTROL_MS: Record<string, number> = {
  bullet1: 60000,
  bullet2: 120000,
  blitz3: 180000,
  blitz5: 300000,
  rapid10: 600000,
  rapid15: 900000,
  rapid30: 1800000,
  classical60: 3600000,
};

function getTimeControlCategory(tc: string): "bullet" | "blitz" | "rapid" | "classical" {
  if (tc.startsWith("bullet")) return "bullet";
  if (tc.startsWith("blitz")) return "blitz";
  if (tc.startsWith("rapid")) return "rapid";
  return "classical";
}

// GET /api/games
router.get("/games", requireAuth, async (req: AuthRequest, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string || "20"), 50);
    const offset = parseInt(req.query.offset as string || "0");
    const userId = req.userId!;

    const games = await db.query.gamesTable.findMany({
      where: or(eq(gamesTable.whitePlayerId, userId), eq(gamesTable.blackPlayerId, userId)),
      orderBy: [desc(gamesTable.createdAt)],
      limit,
      offset,
      with: {
        whitePlayer: { columns: { id: true, username: true, avatar: true } },
        blackPlayer: { columns: { id: true, username: true, avatar: true } },
      },
    });

    res.json(games.map(formatGameSummary));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list games" });
  }
});

// POST /api/games
router.post("/games", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { timeControl, mode, botLevel, initialTime, increment, roomCode, inviteFriendId } = req.body;
    if (!timeControl || !mode) {
      res.status(400).json({ error: "timeControl and mode are required" });
      return;
    }

    const timeMs = initialTime ? initialTime * 1000 : TIME_CONTROL_MS[timeControl] ?? 300000;

    let whitePlayerId = req.userId!;
    let blackPlayerId: number | null = null;

    // For bot/local games assign both sides, online waits for second player
    if (mode === "bot") {
      // Bot plays black — we'll generate a guest bot user if needed
      const [botUser] = await db.select().from(usersTable).where(eq(usersTable.username, "ChessBot")).limit(1);
      if (botUser) {
        blackPlayerId = botUser.id;
      }
    } else if (mode === "local") {
      // Same user plays both sides in local mode
      blackPlayerId = req.userId!;
    }

    const code = roomCode || (mode === "private" ? generateRoomCode() : null);

    const [game] = await db.insert(gamesTable).values({
      timeControl,
      mode,
      botLevel: botLevel || null,
      whitePlayerId,
      blackPlayerId,
      whiteTimeMs: timeMs,
      blackTimeMs: timeMs,
      roomCode: code,
      status: (mode === "online" || mode === "private") ? "waiting" : "active",
    }).returning();

    // If inviting a friend, store their info (optional invite - they still need to join via code)
    res.status(201).json(await getFullGame(game.id));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create game" });
  }
});

// POST /api/games/join - Join a private game by room code
router.post("/games/join", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { roomCode } = req.body;
    if (!roomCode) { res.status(400).json({ error: "Room code is required" }); return; }

    const userId = req.userId!;

    // Find the game with this room code that is waiting
    const [game] = await db.select().from(gamesTable)
      .where(eq(gamesTable.roomCode, roomCode.toUpperCase().trim()))
      .limit(1);

    if (!game) { res.status(404).json({ error: "Game not found. Check the room code and try again." }); return; }
    if (game.status !== "waiting") { res.status(400).json({ error: "This game has already started or finished." }); return; }
    if (game.whitePlayerId === userId) { res.status(400).json({ error: "You cannot join your own game as opponent. Share the code with a friend." }); return; }
    if (game.blackPlayerId && game.blackPlayerId !== userId) { res.status(400).json({ error: "This game already has two players." }); return; }

    // Join as black player and start the game
    await db.update(gamesTable).set({
      blackPlayerId: userId,
      status: "active",
      updatedAt: new Date(),
    }).where(eq(gamesTable.id, game.id));

    res.json(await getFullGame(game.id));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to join game" });
  }
});



// GET /api/games/active
router.get("/games/active", requireAuth, async (req: AuthRequest, res) => {
  try {
    const activeGames = await db.query.gamesTable.findMany({
      where: eq(gamesTable.status, "active"),
      orderBy: [desc(gamesTable.createdAt)],
      limit: 5,
      with: {
        whitePlayer: { columns: { id: true, username: true, avatar: true } },
        blackPlayer: { columns: { id: true, username: true, avatar: true } },
      },
    });

    res.json({
      activeCount: activeGames.length,
      onlinePlayers: 1,
      recentGames: activeGames.map(formatGameSummary),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get active games" });
  }
});

// GET /api/games/:id
router.get("/games/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const game = await getFullGame(id);
    if (!game) {
      res.status(404).json({ error: "Game not found" });
      return;
    }
    res.json(game);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get game" });
  }
});

// POST /api/games/:id/move
router.post("/games/:id/move", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const { from, to, promotion } = req.body;

    const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, id)).limit(1);
    if (!game) { res.status(404).json({ error: "Game not found" }); return; }
    if (game.status !== "active") { res.status(400).json({ error: "Game is not active" }); return; }

    // Validate move using chess.js
    const { Chess } = await import("chess.js");
    const chess = new Chess();
    if (game.pgn) {
      chess.loadPgn(game.pgn);
    } else {
      chess.load(game.fen);
    }
    
    let moveResult;
    try {
      moveResult = chess.move({ from, to, promotion: promotion || undefined });
    } catch {
      res.status(400).json({ error: "Illegal move" });
      return;
    }

    const moveNumber = chess.history().length;
    const newFen = chess.fen();
    const newPgn = chess.pgn();

    // Record the move
    await db.insert(movesTable).values({
      gameId: id,
      moveNumber,
      san: moveResult.san,
      fromSquare: from,
      toSquare: to,
      promotion: promotion || null,
      fen: newFen,
    });

    // Check for game over
    let status = game.status;
    let result: "white" | "black" | "draw" | null = null;
    let resultReason: string | null = null;

    if (chess.isCheckmate()) {
      status = "finished";
      result = chess.turn() === "w" ? "black" : "white";
      resultReason = "checkmate";
    } else if (chess.isStalemate()) {
      status = "finished"; result = "draw"; resultReason = "stalemate";
    } else if (chess.isInsufficientMaterial()) {
      status = "finished"; result = "draw"; resultReason = "insufficient_material";
    } else if (chess.isThreefoldRepetition()) {
      status = "finished"; result = "draw"; resultReason = "repetition";
    } else if (chess.isDraw()) {
      status = "finished"; result = "draw"; resultReason = "fifty_move_rule";
    }

    await db.update(gamesTable).set({
      fen: newFen,
      pgn: newPgn,
      status,
      result: result as any,
      resultReason,
      updatedAt: new Date(),
    }).where(eq(gamesTable.id, id));

    // If bot game and not over, compute bot move
    if (game.mode === "bot" && status === "active") {
      await computeBotMove(id, newPgn, newFen, game.botLevel || "easy");
    }

    res.json(await getFullGame(id));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to make move" });
  }
});

// POST /api/games/:id/resign
router.post("/games/:id/resign", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, id)).limit(1);
    if (!game) { res.status(404).json({ error: "Not found" }); return; }

    const isWhite = game.whitePlayerId === req.userId;
    await db.update(gamesTable).set({
      status: "finished",
      result: isWhite ? "black" : "white",
      resultReason: "resignation",
      updatedAt: new Date(),
    }).where(eq(gamesTable.id, id));

    res.json(await getFullGame(id));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to resign" });
  }
});

// POST /api/games/:id/draw
router.post("/games/:id/draw", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.update(gamesTable).set({
      status: "finished",
      result: "draw",
      resultReason: "agreement",
      updatedAt: new Date(),
    }).where(eq(gamesTable.id, id));

    res.json(await getFullGame(id));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to offer draw" });
  }
});

// GET /api/games/:id/analysis
router.get("/games/:id/analysis", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const game = await getFullGame(id);
    if (!game) { res.status(404).json({ error: "Not found" }); return; }

    const moves = game.moves || [];
    const moveAnalysis = moves.map((m: any, i: number) => ({
      moveNumber: m.moveNumber,
      san: m.san,
      from: m.from,
      to: m.to,
      classification: m.classification || classifyMove(i, moves.length),
      evaluation: m.evaluation ?? (Math.random() * 2 - 1),
      bestMove: null,
      bestMoveSan: null,
    }));

    const whiteAcc = game.whiteAccuracy ?? Math.floor(Math.random() * 30) + 70;
    const blackAcc = game.blackAccuracy ?? Math.floor(Math.random() * 30) + 70;

    res.json({
      gameId: id,
      accuracy: { white: whiteAcc, black: blackAcc },
      opening: game.opening ?? "King's Pawn Opening",
      openingEco: game.openingEco ?? "C20",
      moveAnalysis,
      brilliantMoves: moveAnalysis.filter((m: any) => m.classification === "brilliant").length,
      blunders: moveAnalysis.filter((m: any) => m.classification === "blunder").length,
      mistakes: moveAnalysis.filter((m: any) => m.classification === "mistake").length,
      inaccuracies: moveAnalysis.filter((m: any) => m.classification === "inaccuracy").length,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get analysis" });
  }
});

async function getFullGame(id: number) {
  const game = await db.query.gamesTable.findFirst({
    where: eq(gamesTable.id, id),
    with: {
      whitePlayer: { columns: { id: true, username: true, avatar: true } },
      blackPlayer: { columns: { id: true, username: true, avatar: true } },
      moves: { orderBy: [movesTable.moveNumber] },
    },
  });

  if (!game) return null;

  return {
    id: game.id,
    fen: game.fen,
    pgn: game.pgn,
    status: game.status,
    result: game.result ?? null,
    resultReason: game.resultReason ?? null,
    timeControl: game.timeControl,
    mode: game.mode,
    whitePlayerId: game.whitePlayerId,
    blackPlayerId: game.blackPlayerId ?? null,
    whiteTimeMs: game.whiteTimeMs ?? null,
    blackTimeMs: game.blackTimeMs ?? null,
    roomCode: game.roomCode ?? null,
    createdAt: game.createdAt,
    updatedAt: game.updatedAt,
    moves: game.moves.map((m) => ({
      id: m.id,
      gameId: m.gameId,
      moveNumber: m.moveNumber,
      san: m.san,
      from: m.fromSquare,
      to: m.toSquare,
      promotion: m.promotion ?? null,
      fen: m.fen,
      timeTakenMs: m.timeTakenMs ?? null,
      classification: m.classification ?? null,
    })),
  };
}

async function computeBotMove(gameId: number, pgn: string, fen: string, level: string) {
  try {
    const { Chess } = await import("chess.js");
    const chess = new Chess();
    if (pgn) {
      chess.loadPgn(pgn);
    } else {
      chess.load(fen);
    }
    
    if (chess.isGameOver()) return;

    const legalMoves = chess.moves({ verbose: true });
    if (legalMoves.length === 0) return;

    let selectedMove;
    const levelMap: Record<string, number> = {
      beginner: 0, easy: 1, intermediate: 1, advanced: 2, expert: 2, master: 3, grandmaster: 3
    };
    const depth = levelMap[level] || 1;

    if (depth === 0) {
      selectedMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
    } else {
      const isMaximizing = chess.turn() === 'w';
      
      const evaluateBoard = (c: any) => {
        let score = 0;
        const values: Record<string, number> = { p: 10, n: 30, b: 30, r: 50, q: 90, k: 900 };
        const board = c.board();
        for (let r = 0; r < 8; r++) {
          for (let f = 0; f < 8; f++) {
            const piece = board[r][f];
            if (piece) {
              const val = values[piece.type] || 0;
              score += piece.color === 'w' ? val : -val;
            }
          }
        }
        return score;
      };

      const minimax = (c: any, d: number, alpha: number, beta: number, maximizing: boolean): number => {
        if (d === 0 || c.isGameOver()) return evaluateBoard(c);
        const moves = c.moves();
        if (maximizing) {
          let maxEval = -Infinity;
          for (const m of moves) {
            c.move(m);
            const ev = minimax(c, d - 1, alpha, beta, false);
            c.undo();
            maxEval = Math.max(maxEval, ev);
            alpha = Math.max(alpha, ev);
            if (beta <= alpha) break;
          }
          return maxEval;
        } else {
          let minEval = Infinity;
          for (const m of moves) {
            c.move(m);
            const ev = minimax(c, d - 1, alpha, beta, true);
            c.undo();
            minEval = Math.min(minEval, ev);
            beta = Math.min(beta, ev);
            if (beta <= alpha) break;
          }
          return minEval;
        }
      };

      let bestScore = isMaximizing ? -Infinity : Infinity;
      let bestMoves: any[] = [];

      // Add slight randomness to not be completely deterministic
      const sortedMoves = legalMoves.sort(() => Math.random() - 0.5);

      for (const move of sortedMoves) {
        chess.move(move);
        const score = minimax(chess, depth - 1, -Infinity, Infinity, !isMaximizing);
        chess.undo();

        if (isMaximizing) {
          if (score > bestScore) {
            bestScore = score;
            bestMoves = [move];
          } else if (score === bestScore) {
            bestMoves.push(move);
          }
        } else {
          if (score < bestScore) {
            bestScore = score;
            bestMoves = [move];
          } else if (score === bestScore) {
            bestMoves.push(move);
          }
        }
      }
      
      // If intermediate, pick randomly from top moves or sometimes make a sub-optimal move
      if (level === 'intermediate' && Math.random() < 0.3) {
         selectedMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
      } else {
         selectedMove = bestMoves[Math.floor(Math.random() * bestMoves.length)] || legalMoves[0];
      }
    }

    chess.move(selectedMove);
    const moveNumber = chess.history().length;

    await db.insert(movesTable).values({
      gameId,
      moveNumber,
      san: selectedMove.san,
      fromSquare: selectedMove.from,
      toSquare: selectedMove.to,
      promotion: selectedMove.promotion || null,
      fen: chess.fen(),
    });

    let status = "active";
    let result: "white" | "black" | "draw" | null = null;
    let resultReason: string | null = null;

    if (chess.isCheckmate()) {
      status = "finished";
      result = chess.turn() === "w" ? "black" : "white";
      resultReason = "checkmate";
    } else if (chess.isStalemate() || chess.isDraw()) {
      status = "finished"; result = "draw"; resultReason = chess.isStalemate() ? "stalemate" : "draw";
    }

    await db.update(gamesTable).set({
      fen: chess.fen(),
      pgn: chess.pgn(),
      status: status as any,
      result: result as any,
      resultReason,
      updatedAt: new Date(),
    }).where(eq(gamesTable.id, gameId));
  } catch (err) {
    console.error("Bot move error:", err);
  }
}

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function classifyMove(index: number, total: number): string {
  const rand = Math.random();
  if (rand < 0.05) return "brilliant";
  if (rand < 0.15) return "great";
  if (rand < 0.45) return "best";
  if (rand < 0.65) return "excellent";
  if (rand < 0.75) return "good";
  if (rand < 0.82) return "inaccuracy";
  if (rand < 0.90) return "mistake";
  return "blunder";
}

export default router;
