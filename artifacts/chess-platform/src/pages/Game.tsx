import React, { useEffect, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { ChessBoard } from '@/components/ChessBoard';
import { GameClock } from '@/components/GameClock';
import { MoveHistory } from '@/components/MoveHistory';
import { useGetGame, useMakeMove, useResignGame, useOfferDraw, getGetGameQueryKey, type Game } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Flag, Handshake } from 'lucide-react';
import { Chess } from 'chess.js';

export default function Game() {
  const { id } = useParams<{ id: string }>();
  const gameId = parseInt(id, 10);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [chess, setChess] = useState(() => new Chess());

  const { data: game, isLoading } = useGetGame(gameId, {
    query: {
      queryKey: getGetGameQueryKey(gameId),
      enabled: !!gameId,
      refetchInterval: (query: any) => ((query.data?.status === 'active') ? 2000 : false)
    }
  });

  const makeMove = useMakeMove();
  const resignGame = useResignGame();
  const offerDraw = useOfferDraw();

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
  }, [game?.fen]);

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
      <div className="lg:col-span-2 flex flex-col items-center justify-center gap-4">
        {/* Opponent Info & Clock */}
        <div className="w-full max-w-[600px] flex justify-between items-end">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-muted rounded-md" />
            <div className="font-semibold text-sm">Opponent</div>
          </div>
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
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-muted rounded-md" />
            <div className="font-semibold text-sm">{user?.username || 'You'}</div>
          </div>
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
              onClick={() => resignGame.mutate({ id: gameId }, {
                onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetGameQueryKey(gameId) })
              })}
              disabled={resignGame.isPending}
            >
              <Flag className="w-4 h-4 mr-2" /> Resign
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
