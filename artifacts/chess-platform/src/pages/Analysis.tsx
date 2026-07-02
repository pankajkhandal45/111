import React, { useEffect, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { ChessBoard } from '@/components/ChessBoard';
import { MoveHistory } from '@/components/MoveHistory';
import { EvalBar } from '@/components/EvalBar';
import { useGetGame, useGetGameAnalysis } from '@workspace/api-client-react';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Chess } from 'chess.js';

export default function Analysis() {
  const { id } = useParams<{ id: string }>();
  const gameId = parseInt(id, 10);
  const [, setLocation] = useLocation();

  const { data: game, isLoading: isGameLoading } = useGetGame(gameId, { query: { enabled: !!gameId } });
  const { data: analysis, isLoading: isAnalysisLoading } = useGetGameAnalysis(gameId, { query: { enabled: !!gameId } });

  const [activeMoveIndex, setActiveMoveIndex] = useState<number>(-1);
  const [chess] = useState(() => new Chess());
  const [currentFen, setCurrentFen] = useState<string>('');

  useEffect(() => {
    if (game?.pgn) {
      chess.loadPgn(game.pgn);
      setActiveMoveIndex(chess.history().length - 1);
    }
  }, [game?.pgn, chess]);

  useEffect(() => {
    if (!game?.moves || game.moves.length === 0 || activeMoveIndex < 0) {
      setCurrentFen(game?.fen || '');
      return;
    }
    const tempChess = new Chess();
    const maxIndex = Math.min(activeMoveIndex, game.moves.length - 1);
    for (let i = 0; i <= maxIndex; i++) {
      try {
        tempChess.move(game.moves[i].san);
      } catch {
        break;
      }
    }
    setCurrentFen(tempChess.fen());
  }, [activeMoveIndex, game]);

  if (isGameLoading || isAnalysisLoading || !game) {
    return <div className="flex justify-center p-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const currentMoveAnalysis = activeMoveIndex >= 0 && analysis?.moveAnalysis 
    ? analysis.moveAnalysis[activeMoveIndex] 
    : undefined;

  const evaluation = currentMoveAnalysis?.evaluation || 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 flex items-center justify-center gap-4">
        <EvalBar evaluation={evaluation} />
        <div className="w-full max-w-[600px] space-y-4">
          <div className="flex justify-between items-center">
            <Button variant="ghost" onClick={() => setLocation('/')}><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
            {analysis?.opening && <div className="font-medium text-sm text-muted-foreground">{analysis.opening}</div>}
          </div>
          
          <ChessBoard 
            fen={currentFen}
            disabled={true}
          />
          
          <div className="flex justify-center gap-2 mt-4">
            <Button variant="outline" onClick={() => setActiveMoveIndex(-1)} disabled={activeMoveIndex === -1}>|&lt;</Button>
            <Button variant="outline" onClick={() => setActiveMoveIndex(Math.max(-1, activeMoveIndex - 1))} disabled={activeMoveIndex === -1}>&lt;</Button>
            <Button variant="outline" onClick={() => setActiveMoveIndex(Math.min((game.moves?.length || 0) - 1, activeMoveIndex + 1))} disabled={activeMoveIndex === (game.moves?.length || 0) - 1}>&gt;</Button>
            <Button variant="outline" onClick={() => setActiveMoveIndex((game.moves?.length || 0) - 1)} disabled={activeMoveIndex === (game.moves?.length || 0) - 1}>&gt;|</Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 h-[calc(100vh-100px)]">
        {analysis && (
          <Card>
            <CardContent className="p-4 grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{analysis.accuracy.white.toFixed(1)}</div>
                <div className="text-xs text-muted-foreground">White Accuracy</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-black dark:text-gray-300">{analysis.accuracy.black.toFixed(1)}</div>
                <div className="text-xs text-muted-foreground">Black Accuracy</div>
              </div>
            </CardContent>
          </Card>
        )}
        <div className="flex-1 min-h-[300px]">
          <MoveHistory 
            moves={game.moves} 
            activeMoveIndex={activeMoveIndex}
            onMoveClick={setActiveMoveIndex} 
          />
        </div>
      </div>
    </div>
  );
}
