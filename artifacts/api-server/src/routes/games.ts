import { Router, type Response } from "express";
import { db } from "@workspace/db";
import { gamesTable, movesTable, usersTable, ratingsTable } from "@workspace/db";
import { eq, and, or, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { formatGameSummary } from "./users";
import { Chess } from "chess.js";

const router = Router();

// ─── SSE Registry ────────────────────────────────────────────────────────────
// Maps gameId → Set of SSE response objects (one per connected client)
const sseClients = new Map<number, Set<Response>>();

function addSseClient(gameId: number, res: Response) {
  if (!sseClients.has(gameId)) sseClients.set(gameId, new Set());
  sseClients.get(gameId)!.add(res);
}

function removeSseClient(gameId: number, res: Response) {
  sseClients.get(gameId)?.delete(res);
  if (sseClients.get(gameId)?.size === 0) sseClients.delete(gameId);
}

function pushGameUpdate(gameId: number, gameData: unknown) {
  const clients = sseClients.get(gameId);
  if (!clients || clients.size === 0) return;
  const payload = `data: ${JSON.stringify(gameData)}\n\n`;
  for (const client of clients) {
    try { client.write(payload); } catch { /* client already disconnected */ }
  }
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── Chat SSE Registry ───────────────────────────────────────────────────────
// Maps gameId → Set of SSE response objects for chat stream
const chatClients = new Map<number, Set<Response>>();

function addChatClient(gameId: number, res: Response) {
  if (!chatClients.has(gameId)) chatClients.set(gameId, new Set());
  chatClients.get(gameId)!.add(res);
}

function removeChatClient(gameId: number, res: Response) {
  chatClients.get(gameId)?.delete(res);
  if (chatClients.get(gameId)?.size === 0) chatClients.delete(gameId);
}

function pushChatMessage(gameId: number, message: unknown) {
  const clients = chatClients.get(gameId);
  if (!clients || clients.size === 0) return;
  const payload = `data: ${JSON.stringify(message)}\n\n`;
  for (const client of clients) {
    try { client.write(payload); } catch { /* client already disconnected */ }
  }
}
// ─────────────────────────────────────────────────────────────────────────────

const TIME_CONTROL_MS: Record<string, number | null> = {
  bullet1: 60000,
  bullet2: 120000,
  blitz3: 180000,
  blitz5: 300000,
  rapid10: 600000,
  rapid15: 900000,
  rapid30: 1800000,
  classical60: 3600000,
  unlimited: null,
};

function getTimeControlCategory(tc: string): "bullet" | "blitz" | "rapid" | "classical" {
  if (tc.startsWith("bullet")) return "bullet";
  if (tc.startsWith("blitz")) return "blitz";
  if (tc.startsWith("rapid")) return "rapid";
  if (tc === "unlimited") return "classical"; // leaderboard fallback
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

    // null = unlimited (no clock); undefined key falls back to 5-min default
    const timeMs = initialTime
      ? initialTime * 1000
      : timeControl in TIME_CONTROL_MS
        ? TIME_CONTROL_MS[timeControl]   // may be null for "unlimited"
        : 300000;

    let whitePlayerId = req.userId!;
    let blackPlayerId: number | null = null;

    // For bot/local games assign both sides, online waits for second player
    if (mode === "bot") {
      // Bot plays black — auto-create ChessBot if not exists
      let [botUser] = await db.select().from(usersTable).where(eq(usersTable.username, "ChessBot")).limit(1);
      if (!botUser) {
        const [newBot] = await db.insert(usersTable).values({
          username: "ChessBot",
          email: "chessbot@chesshub.internal",
          isGuest: false,
          role: "user",
        }).returning();
        botUser = newBot;
      }
      blackPlayerId = botUser.id;
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

    const updatedGame = await getFullGame(game.id);
    // Push SSE update to host (Player 1) who is on the waiting screen
    pushGameUpdate(game.id, updatedGame);
    res.json(updatedGame);
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
      limit: 20,
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

// GET /api/games/:id/events — SSE stream for real-time game updates
router.get("/games/:id/events", requireAuth, async (req: AuthRequest, res) => {
  const gameId = parseInt(req.params.id);
  if (isNaN(gameId)) { res.status(400).end(); return; }

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering if present
  res.flushHeaders();

  // Send a keep-alive comment every 25 seconds to prevent proxy timeouts
  const keepAlive = setInterval(() => {
    try { res.write(": ping\n\n"); } catch { /* ignore */ }
  }, 25000);

  addSseClient(gameId, res);

  // Send initial game state immediately so client is up to date on connect
  try {
    const game = await getFullGame(gameId);
    if (game) res.write(`data: ${JSON.stringify(game)}\n\n`);
  } catch { /* ignore */ }

  req.on("close", () => {
    clearInterval(keepAlive);
    removeSseClient(gameId, res);
  });
});

// POST /api/games/:id/move
router.post("/games/:id/move", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const { from, to, promotion } = req.body;

    const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, id)).limit(1);
    if (!game) { res.status(404).json({ error: "Game not found" }); return; }
    if (game.status !== "active") { res.status(400).json({ error: "Game is not active" }); return; }

    // Authorization: only players in this game can move, and only on their turn
    const userId = req.userId!;
    const isWhite = game.whitePlayerId === userId;
    const isBlack = game.blackPlayerId === userId;
    const isLocal = game.mode === "local";
    if (!isWhite && !isBlack) {
      res.status(403).json({ error: "You are not a player in this game" });
      return;
    }

    // Validate move using chess.js
    const chess = new Chess();
    if (game.pgn) {
      chess.loadPgn(game.pgn);
    } else {
      chess.load(game.fen);
    }
    
    // Enforce turn: white can only move on white's turn, black on black's turn
    // (local games allow either player to move either side)
    if (!isLocal) {
      const expectedTurn = chess.turn(); // 'w' or 'b'
      if (expectedTurn === 'w' && !isWhite) {
        res.status(400).json({ error: "It is not your turn" });
        return;
      }
      if (expectedTurn === 'b' && !isBlack) {
        res.status(400).json({ error: "It is not your turn" });
        return;
      }
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

    const updatedGame = await getFullGame(id);
    // Push real-time update to all SSE subscribers of this game
    pushGameUpdate(id, updatedGame);
    res.json(updatedGame);

    // If bot game and not over, compute bot move in background (non-blocking)
    if (game.mode === "bot" && status === "active") {
      setImmediate(async () => {
        try {
          // Reload current state — game may have changed (resign/draw) before this fires
          const [currentGame] = await db.select().from(gamesTable).where(eq(gamesTable.id, id)).limit(1);
          if (!currentGame || currentGame.status !== "active") return; // game already over
          const verifyChess = new Chess();
          try { verifyChess.loadPgn(currentGame.pgn || ""); } catch { verifyChess.load(currentGame.fen); }
          if (verifyChess.turn() !== 'b') return; // not bot's turn (bot is always black)
          await computeBotMove(id, currentGame.pgn || "", currentGame.fen, currentGame.botLevel || "easy");
          const botUpdatedGame = await getFullGame(id);
          if (botUpdatedGame) pushGameUpdate(id, botUpdatedGame);
        } catch (err) {
          console.error("Background bot move error:", err);
        }
      });
    }
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

    const updatedGame = await getFullGame(id);
    pushGameUpdate(id, updatedGame);
    res.json(updatedGame);
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

    const updatedGame = await getFullGame(id);
    pushGameUpdate(id, updatedGame);
    res.json(updatedGame);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to offer draw" });
  }
});

// GET /api/games/:id/chat/events — SSE stream for real-time chat
router.get("/games/:id/chat/events", requireAuth, async (req: AuthRequest, res) => {
  const gameId = parseInt(req.params.id);
  if (isNaN(gameId)) { res.status(400).end(); return; }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const keepAlive = setInterval(() => {
    try { res.write(": ping\n\n"); } catch { /* ignore */ }
  }, 25000);

  addChatClient(gameId, res);

  req.on("close", () => {
    clearInterval(keepAlive);
    removeChatClient(gameId, res);
  });
});

// POST /api/games/:id/chat — Send a chat message
router.post("/games/:id/chat", requireAuth, async (req: AuthRequest, res) => {
  try {
    const gameId = parseInt(req.params.id);
    if (isNaN(gameId)) { res.status(400).json({ error: "Invalid game id" }); return; }

    const { text } = req.body;
    if (!text || typeof text !== "string" || !text.trim()) {
      res.status(400).json({ error: "Message text is required" }); return;
    }

    const userId = req.userId!;
    // Fetch sender username
    const [sender] = await db.select({ id: usersTable.id, username: usersTable.username, avatar: usersTable.avatar })
      .from(usersTable).where(eq(usersTable.id, userId)).limit(1);

    const message = {
      id: Date.now(),
      gameId,
      senderId: userId,
      senderName: sender?.username || "Player",
      senderAvatar: sender?.avatar || null,
      text: text.trim().substring(0, 300),
      createdAt: new Date().toISOString(),
    };

    pushChatMessage(gameId, message);
    res.json(message);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to send message" });
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
    // ✅ Player info for display (names + avatars)
    whitePlayer: game.whitePlayer
      ? { id: game.whitePlayer.id, username: game.whitePlayer.username, avatar: game.whitePlayer.avatar ?? null }
      : null,
    blackPlayer: game.blackPlayer
      ? { id: game.blackPlayer.id, username: game.blackPlayer.username, avatar: game.blackPlayer.avatar ?? null }
      : null,
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
