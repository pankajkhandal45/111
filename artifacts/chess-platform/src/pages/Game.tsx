import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { ChessBoard } from '@/components/ChessBoard';
import { GameClock } from '@/components/GameClock';
import { MoveHistory } from '@/components/MoveHistory';
import { useGetGame, useMakeMove, useResignGame, useOfferDraw, getGetGameQueryKey, getBaseUrl, type Game } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Flag, Handshake, Home, Trophy, Minus, ArrowUpDown } from 'lucide-react';
import { Chess } from 'chess.js';

// ── Game Over Modal ───────────────────────────────────────────────────────────
function GameOverModal({ game, currentUserId, onClose }: {
  game: any;
  currentUserId?: number;
  onClose: () => void;
}) {
  const [, setLocation] = useLocation();

  const isDraw = game.result === 'draw';
  const winnerIsWhite = game.result === 'white';
  const whitePlayer = game.whitePlayer;
  const blackPlayer = game.blackPlayer;
  const winnerPlayer = isDraw ? null : (winnerIsWhite ? whitePlayer : blackPlayer);
  const loserPlayer  = isDraw ? null : (winnerIsWhite ? blackPlayer : whitePlayer);
  const isMeWinner   = winnerPlayer?.id === currentUserId;

  const reasonMap: Record<string, string> = {
    checkmate:             'Checkmate',
    resignation:           'Resign kar diya',
    stalemate:             'Stalemate',
    insufficient_material: 'Insufficient material',
    repetition:            'Threefold repetition',
    fifty_move_rule:       '50-move rule',
    agreement:             'Mutual agreement',
    timeout:               'Time khatam',
  };
  const reason = reasonMap[game.resultReason ?? ''] || game.resultReason || '';

  function PlayerCard({ player, isWinner, label }: { player: any; isWinner: boolean; label?: string }) {
    const name = player?.username || '?';
    const initials = name.substring(0, 2).toUpperCase();
    return (
      <div className="flex flex-col items-center gap-2" style={{ opacity: isDraw ? 1 : (isWinner ? 1 : 0.55) }}>
        <div className="relative">
          <Avatar
            className="h-16 w-16 border-4 transition-all"
            style={{
              borderColor: isDraw
                ? 'hsl(var(--muted-foreground))'
                : isWinner
                  ? '#f59e0b'   // gold for winner
                  : '#6b7280',  // grey for loser
              boxShadow: isWinner && !isDraw ? '0 0 18px rgba(245,158,11,0.5)' : 'none',
            }}
          >
            <AvatarImage src={player?.avatar || undefined} alt={name} />
            <AvatarFallback className="text-xl font-bold">{initials}</AvatarFallback>
          </Avatar>

          {/* Trophy badge on winner */}
          {isWinner && !isDraw && (
            <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: '#f59e0b' }}>
              <Trophy className="w-3.5 h-3.5 text-white" />
            </div>
          )}
        </div>

        <div className="text-center">
          <p className="font-bold text-sm leading-tight max-w-[80px] truncate">{name}</p>
          {label && (
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold mt-0.5 inline-block"
              style={{
                background: isDraw ? 'hsl(var(--muted))' : isWinner ? '#f59e0b20' : '#ef444420',
                color: isDraw ? 'hsl(var(--muted-foreground))' : isWinner ? '#f59e0b' : '#ef4444',
              }}>
              {label}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(8px)' }}>
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-7 flex flex-col items-center gap-5"
        style={{ animation: 'fadeInScale .25s ease' }}>

        {/* Headline */}
        <div className="text-center">
          <h2 className="text-2xl font-extrabold tracking-tight">
            {isDraw ? '🤝 Draw!' : isMeWinner ? '🎉 You Win!' : '😔 You Lose!'}
          </h2>
          <p className="text-muted-foreground text-xs mt-1">{reason}</p>
        </div>

        {/* Both Players */}
        <div className="flex items-center justify-center gap-4 w-full">
          {/* White Player */}
          <PlayerCard
            player={whitePlayer}
            isWinner={!isDraw && winnerIsWhite}
            label={isDraw ? 'Draw' : (winnerIsWhite ? 'Winner' : 'Loser')}
          />

          {/* VS divider */}
          <div className="flex flex-col items-center gap-1">
            <div className="text-2xl font-black text-muted-foreground/50">vs</div>
          </div>

          {/* Black Player */}
          <PlayerCard
            player={blackPlayer}
            isWinner={!isDraw && !winnerIsWhite}
            label={isDraw ? 'Draw' : (!winnerIsWhite ? 'Winner' : 'Loser')}
          />
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 w-full">
          <Button className="w-full" onClick={() => setLocation('/')}>
            <Home className="w-4 h-4 mr-2" /> Home
          </Button>
          <Button variant="outline" className="w-full" onClick={onClose}>
            Analyse Board
          </Button>
        </div>
      </div>

      <style>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.88); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

// ── Resign Confirm Dialog ─────────────────────────────────────────────────────
function ResignConfirmDialog({ onConfirm, onCancel, isPending }: {
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-xs p-6 flex flex-col gap-4"
        style={{ animation: 'fadeInScale .2s ease' }}>
        <div className="text-center">
          <Flag className="w-10 h-10 text-destructive mx-auto mb-2" />
          <h3 className="text-lg font-bold">Resign?</h3>
          <p className="text-muted-foreground text-sm mt-1">Resigning will result in a loss.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={isPending}>No</Button>
          <Button variant="destructive" className="flex-1" onClick={onConfirm} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Yes, Resign'}
          </Button>
        </div>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

export default function Game() {
  const { id } = useParams<{ id: string }>();
  const gameId = parseInt(id, 10);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [chess, setChess] = useState(() => new Chess());
  const sseRef = useRef<EventSource | null>(null);
  const [showGameOver, setShowGameOver] = useState(false);
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const [rotatePieces, setRotatePieces] = useState(false);
  const prevStatusRef = useRef<string | undefined>(undefined);

  // Polling fallback — 2s for active games so moves never lag more than 2s
  const { data: game, isLoading } = useGetGame(gameId, {
    query: {
      queryKey: getGetGameQueryKey(gameId),
      enabled: !!gameId,
      refetchInterval: (query: any) => {
        const status = query.state.data?.status;
        if (status === 'active') return 2000;    // 2s fallback when playing
        if (status === 'waiting') return 2000;   // 2s fallback while waiting for opponent
        return false;
      },
    }
  });

  const makeMove = useMakeMove();
  const resignGame = useResignGame();
  const offerDraw = useOfferDraw();

  // ── SSE: real-time game updates with auto-reconnect ──────────────────────
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!gameId) return;
    let cancelled = false;

    function connect() {
      if (cancelled) return;
      const token = localStorage.getItem('chess_token');
      const qs = token ? `?token=${encodeURIComponent(token)}` : '';

      // If a base URL is configured (e.g. Vercel → Render.com), use an absolute
      // URL so the SSE stream goes directly to the API server instead of through
      // Vercel's edge proxy, which cannot hold long-lived streaming connections.
      const base = getBaseUrl();
      const url = base
        ? `${base}/games/${gameId}/events${qs}`       // absolute: baseUrl already includes /api
        : `/api/games/${gameId}/events${qs}`;          // relative: Vite/Replit proxy handles /api

      const es = new EventSource(url);
      sseRef.current = es;

      es.onmessage = (event) => {
        try {
          const updatedGame = JSON.parse(event.data);
          queryClient.setQueryData(getGetGameQueryKey(gameId), updatedGame);
        } catch { /* ignore malformed data */ }
      };

      es.onerror = () => {
        es.close();
        sseRef.current = null;
        // Auto-reconnect after 3 seconds
        if (!cancelled) {
          reconnectTimerRef.current = setTimeout(connect, 3000);
        }
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      sseRef.current?.close();
      sseRef.current = null;
    };
  }, [gameId, queryClient]);
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (game?.fen) {
      const newChess = new Chess();
      try {
        newChess.load(game.fen);
        setChess(newChess);
      } catch (e) {
        console.error("Invalid FEN from server", game.fen);
      }
    }
    // Auto-show game over popup when game finishes
    if (game?.status === 'finished' && prevStatusRef.current !== 'finished') {
      setShowGameOver(true);
    }
    prevStatusRef.current = game?.status;
  }, [game?.fen, game?.status]);

  if (isLoading || !game) {
    return <div className="flex justify-center items-center h-[60vh]"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }


  // Waiting lobby for private matches
  if (game.status === 'waiting') {
    const shareLink = `${window.location.origin}/play?join=${game.roomCode}`;
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
        <div className="text-center space-y-2">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-bold">Waiting for your friend...</h2>
          <p className="text-muted-foreground">Share the room code or link so they can join.</p>
        </div>
        {game.roomCode && (
          <div className="bg-muted rounded-xl p-8 text-center space-y-4 max-w-sm w-full">
            <p className="text-sm text-muted-foreground">Room Code</p>
            <div className="text-5xl font-mono font-bold tracking-widest text-primary">{game.roomCode}</div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                navigator.clipboard.writeText(shareLink);
              }}
            >
              Copy Invite Link
            </Button>
            <p className="text-xs text-muted-foreground break-all">{shareLink}</p>
          </div>
        )}
      </div>
    );
  }

  const isWhite = user?.id === game.whitePlayerId;
  const isBlack = user?.id === game.blackPlayerId;
  const isLocal = game.mode === 'local';
  const isPlaying = isWhite || isBlack;
  const playerColor = isWhite ? 'white' : 'black';
  const myTurn = (chess.turn() === 'w' && isWhite) || (chess.turn() === 'b' && isBlack) || isLocal;

  const isBot = game.mode === 'bot';

  // ── Client-side bot logic (instant, no server round-trip) ────────────────
  useEffect(() => {
    if (!isBot || game.status !== 'active') return;
    // Bot plays black (index 1 in chess.js turn = 'b')
    if (chess.turn() !== 'b') return;
    if (chess.isGameOver()) return;

    const botLevel = (game as any).botLevel || 'intermediate';

    const timer = setTimeout(() => {
      const moves = chess.moves({ verbose: true });
      if (moves.length === 0) return;

      let selectedMove;

      if (botLevel === 'beginner') {
        // Random move
        selectedMove = moves[Math.floor(Math.random() * moves.length)];
      } else if (botLevel === 'easy') {
        // Mostly random with slight preference for captures
        const captures = moves.filter(m => m.flags.includes('c'));
        selectedMove = captures.length > 0 && Math.random() > 0.5
          ? captures[Math.floor(Math.random() * captures.length)]
          : moves[Math.floor(Math.random() * moves.length)];
      } else {
        // Minimax depth based on level
        const depth = botLevel === 'intermediate' ? 2
          : botLevel === 'advanced' ? 3
          : botLevel === 'expert' ? 4
          : botLevel === 'master' ? 4
          : 5;

        const pieceValues: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

        const evaluate = (c: Chess) => {
          let score = 0;
          const board = c.board();
          for (const row of board) {
            for (const sq of row) {
              if (!sq) continue;
              const val = pieceValues[sq.type] || 0;
              score += sq.color === 'b' ? val : -val;
            }
          }
          return score;
        };

        const minimax = (c: Chess, d: number, alpha: number, beta: number, maximizing: boolean): number => {
          if (d === 0 || c.isGameOver()) return evaluate(c);
          const legalMoves = c.moves({ verbose: true });
          if (maximizing) {
            let best = -Infinity;
            for (const m of legalMoves) {
              c.move(m);
              best = Math.max(best, minimax(c, d - 1, alpha, beta, false));
              c.undo();
              alpha = Math.max(alpha, best);
              if (beta <= alpha) break;
            }
            return best;
          } else {
            let best = Infinity;
            for (const m of legalMoves) {
              c.move(m);
              best = Math.min(best, minimax(c, d - 1, alpha, beta, true));
              c.undo();
              beta = Math.min(beta, best);
              if (beta <= alpha) break;
            }
            return best;
          }
        };

        let bestScore = -Infinity;
        let bestMove = moves[0];
        const shuffled = [...moves].sort(() => Math.random() - 0.5);
        for (const m of shuffled) {
          chess.move(m);
          const score = minimax(chess, depth - 1, -Infinity, Infinity, false);
          chess.undo();
          if (score > bestScore) { bestScore = score; bestMove = m; }
        }
        selectedMove = bestMove;
      }

      // Make bot move via API so it's saved to DB
      makeMove.mutate(
        { id: gameId, data: { from: selectedMove.from, to: selectedMove.to, promotion: selectedMove.promotion } },
        {
          onSuccess: (updatedGame) => {
            queryClient.setQueryData(getGetGameQueryKey(gameId), updatedGame);
          }
        }
      );
    }, 300); // small delay so it feels natural

    return () => clearTimeout(timer);
  }, [chess.fen(), isBot, game.status]);
  // ─────────────────────────────────────────────────────────────────────────

  const handleMove = (from: string, to: string, promotion?: string) => {
    if (!myTurn || game.status !== 'active') return;
    // Block if bot is thinking (bot plays black)
    if (isBot && chess.turn() === 'b') return;

    // Local validation
    try {
      const moveResult = chess.move({ from, to, promotion: promotion || 'q' });
      if (moveResult) {
        // Update local state speculatively
        setChess(new Chess(chess.fen()));

        makeMove.mutate(
          { id: gameId, data: { from, to, promotion } },
          {
            onSuccess: (updatedGame) => {
              // Server already returned the full updated game — set cache directly,
              // no second GET request needed.
              queryClient.setQueryData(getGetGameQueryKey(gameId), updatedGame);
            },
            onError: () => {
              // Revert on error
              const reverted = new Chess();
              reverted.load(game.fen);
              setChess(reverted);
            }
          }
        );
      }
    } catch (e) {
      // Invalid move
    }
  };

  // For local play, randomize who gets White (who moves first) based on the game ID.
  const flipped = isLocal ? (game.id % 2 === 1) : isBlack;
  const bottomColor = flipped ? 'black' : 'white';
  const topColor = flipped ? 'white' : 'black';
  const bottomTime = flipped ? (game.blackTimeMs || 0) : (game.whiteTimeMs || 0);
  const topTime = flipped ? (game.whiteTimeMs || 0) : (game.blackTimeMs || 0);

  const isBottomTurn = game.status === 'active' && chess.turn() === bottomColor.charAt(0);
  const isTopTurn = game.status === 'active' && chess.turn() === topColor.charAt(0);

  // Derive player objects for display (top = opponent, bottom = me)
  const whitePlayer = { ...(game as any).whitePlayer };
  const blackPlayer = { ...(game as any).blackPlayer };
  
  if (isLocal) {
    if (flipped) {
      whitePlayer.username = 'Player 2';
      whitePlayer.avatar = null;
    } else {
      blackPlayer.username = 'Player 2';
      blackPlayer.avatar = null;
    }
  }

  const bottomPlayer = flipped ? blackPlayer : whitePlayer;
  const topPlayer    = flipped ? whitePlayer : blackPlayer;

  function PlayerInfo({ player, color, isActive }: { player: any; color: string; isActive: boolean }) {
    const name = player?.username || (color === 'white' ? 'White' : 'Black');
    const initials = name.substring(0, 2).toUpperCase();
    return (
      <div className="flex items-center gap-2">
        <div className="relative">
          <Avatar className="h-8 w-8 border-2" style={{ borderColor: isActive ? 'hsl(var(--primary))' : 'transparent' }}>
            <AvatarImage src={player?.avatar || undefined} alt={name} />
            <AvatarFallback className="text-xs font-bold">{initials}</AvatarFallback>
          </Avatar>
          {/* color indicator dot */}
          <span
            className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background"
            style={{ background: color === 'white' ? '#f5f5f0' : '#1a1a1a', boxShadow: '0 0 0 1px #888' }}
          />
        </div>
        <div>
          <div className="font-semibold text-sm leading-tight">{name}</div>
          {isActive && <div className="text-xs text-primary">thinking…</div>}
        </div>
      </div>
    );
  }

  // Derive last move from game moves array for highlighting
  const lastMove = (() => {
    if (!game.moves || game.moves.length === 0) return undefined;
    const last = game.moves[game.moves.length - 1];
    return last ? { from: last.from, to: last.to } : undefined;
  })();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-20 md:pb-0 lg:h-[calc(100vh-100px)]">
      {/* ── Game Over Modal ── */}
      {showGameOver && game?.status === 'finished' && (
        <GameOverModal
          game={game}
          currentUserId={user?.id}
          onClose={() => setShowGameOver(false)}
        />
      )}

      {/* ── Resign Confirm ── */}
      {showResignConfirm && (
        <ResignConfirmDialog
          isPending={resignGame.isPending}
          onCancel={() => setShowResignConfirm(false)}
          onConfirm={() => {
            resignGame.mutate({ id: gameId }, {
              onSuccess: () => {
                setShowResignConfirm(false);
                queryClient.invalidateQueries({ queryKey: getGetGameQueryKey(gameId) });
              }
            });
          }}
        />
      )}

      <div className="lg:col-span-2 flex flex-col items-center justify-center gap-4">
        {/* Opponent Info & Clock */}
        <div className="w-full max-w-[600px] flex justify-between items-end">
          <PlayerInfo player={topPlayer} color={topColor} isActive={isTopTurn} />
          <GameClock
            timeMs={topTime}
            isActive={isTopTurn}
            color={topColor}
          />
        </div>

        <ChessBoard
          fen={chess.fen()}
          onMove={handleMove}
          flipped={flipped}
          disabled={!myTurn || game.status !== 'active'}
          lastMove={lastMove}
          rotateTopPieces={isLocal && rotatePieces}
        />

        {/* Player Info & Clock */}
        <div className="w-full max-w-[600px] flex justify-between items-start">
          <PlayerInfo player={bottomPlayer} color={bottomColor} isActive={isBottomTurn} />
          <GameClock
            timeMs={bottomTime}
            isActive={isBottomTurn}
            color={bottomColor}
          />
        </div>
      </div>

      <div className="flex flex-col gap-4 h-full">
        <div className="flex-1 min-h-[300px]">
          <MoveHistory moves={game.moves} />
        </div>

        {game.status === 'active' && isPlaying && (
          <div className="flex flex-col gap-2">
            {isLocal && (
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => setRotatePieces(!rotatePieces)}
              >
                <ArrowUpDown className="w-4 h-4 mr-2" /> Rotate Opponent Pieces
              </Button>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => offerDraw.mutate({ id: gameId }, {
                  onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetGameQueryKey(gameId) })
                })}
                disabled={offerDraw.isPending}
              >
                <Handshake className="w-4 h-4 mr-2" /> Draw
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => setShowResignConfirm(true)}
              >
                <Flag className="w-4 h-4 mr-2" /> Resign
              </Button>
            </div>
          </div>
        )}

        {/* Finished banner to re-open modal */}
        {game.status === 'finished' && !showGameOver && (
          <Button variant="outline" className="w-full" onClick={() => setShowGameOver(true)}>
            <Trophy className="w-4 h-4 mr-2" /> Result dekhna
          </Button>
        )}
      </div>
    </div>
  );
}
