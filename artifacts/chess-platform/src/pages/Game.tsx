import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { ChessBoard } from '@/components/ChessBoard';
import { GameClock } from '@/components/GameClock';
import { MoveHistory } from '@/components/MoveHistory';
import { useGetGame, useMakeMove, useResignGame, useOfferDraw, getGetGameQueryKey, type Game } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Flag, Handshake, Home, Trophy, Minus } from 'lucide-react';
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
            {isDraw ? '🤝 Draw!' : isMeWinner ? '🎉 Aap Jeete!' : '😔 Aap Hare!'}
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
            <Home className="w-4 h-4 mr-2" /> Home par jaao
          </Button>
          <Button variant="outline" className="w-full" onClick={onClose}>
            Board dekhna jaari rakho
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
          <h3 className="text-lg font-bold">Resign karna chahte ho?</h3>
          <p className="text-muted-foreground text-sm mt-1">Resign karne par aap hare maane jaoge.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={isPending}>Nahi</Button>
          <Button variant="destructive" className="flex-1" onClick={onConfirm} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Haan, Resign'}
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
  const prevStatusRef = useRef<string | undefined>(undefined);

  // Polling as fallback only — SSE handles real-time updates
  // Also poll during 'waiting' so host detects join if SSE isn't connected yet
  const { data: game, isLoading } = useGetGame(gameId, {
    query: {
      queryKey: getGetGameQueryKey(gameId),
      enabled: !!gameId,
      refetchInterval: (query: any) => {
        const status = query.state.data?.status;
        if (status === 'active') return 30000;   // 30s fallback when playing
        if (status === 'waiting') return 3000;   // 3s fallback while waiting for opponent
        return false;
      },
    }
  });

  const makeMove = useMakeMove();
  const resignGame = useResignGame();
  const offerDraw = useOfferDraw();

  // ── SSE: real-time game updates ──────────────────────────────────────────

  useEffect(() => {
    if (!gameId) return;

    const token = localStorage.getItem('chess_token');
    // EventSource doesn't support custom headers, so pass token as query param
    const url = `/api/games/${gameId}/events${token ? `?token=${encodeURIComponent(token)}` : ''}`;

    const es = new EventSource(url);
    sseRef.current = es;

    es.onmessage = (event) => {
      try {
        const updatedGame = JSON.parse(event.data);
        // Directly update React Query cache — no refetch needed
        queryClient.setQueryData(getGetGameQueryKey(gameId), updatedGame);
      } catch { /* ignore malformed data */ }
    };

    es.onerror = () => {
      // SSE connection lost — close and let polling fallback take over
      es.close();
      sseRef.current = null;
    };

    return () => {
      es.close();
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
  const isPlaying = isWhite || isBlack;
  const playerColor = isWhite ? 'white' : 'black';
  const myTurn = (chess.turn() === 'w' && isWhite) || (chess.turn() === 'b' && isBlack);

  const handleMove = (from: string, to: string, promotion?: string) => {
    if (!myTurn || game.status !== 'active') return;

    // Local validation
    try {
      const moveResult = chess.move({ from, to, promotion: promotion || 'q' });
      if (moveResult) {
        // Update local state speculatively
        setChess(new Chess(chess.fen()));
        
        makeMove.mutate(
          { id: gameId, data: { from, to, promotion } },
          {
            onSuccess: () => {
              queryClient.invalidateQueries({ queryKey: getGetGameQueryKey(gameId) });
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

  const flipped = isBlack;
  const bottomColor = flipped ? 'black' : 'white';
  const topColor = flipped ? 'white' : 'black';
  const bottomTime = flipped ? (game.blackTimeMs || 0) : (game.whiteTimeMs || 0);
  const topTime = flipped ? (game.whiteTimeMs || 0) : (game.blackTimeMs || 0);

  const isBottomTurn = game.status === 'active' && chess.turn() === bottomColor.charAt(0);
  const isTopTurn = game.status === 'active' && chess.turn() === topColor.charAt(0);

  // Derive player objects for display (top = opponent, bottom = me)
  const whitePlayer = (game as any).whitePlayer;
  const blackPlayer = (game as any).blackPlayer;
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

  // Derive last move from game history for highlighting
  const lastMove = (() => {
    if (!game.moves || game.moves.length === 0) return undefined;
    try {
      const tempChess = new Chess(game.fen);
      const history = tempChess.history({ verbose: true });
      if (history.length > 0) {
        const last = history[history.length - 1];
        return { from: last.from, to: last.to };
      }
    } catch (e) {
      // ignore
    }
    return undefined;
  })();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-100px)]">
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
