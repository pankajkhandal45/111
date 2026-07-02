import React, { useState, useEffect } from 'react';
import { useGetDailyPuzzle, useSolvePuzzle, useGetPuzzleStreak } from '@workspace/api-client-react';
import { ChessBoard } from '@/components/ChessBoard';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Flame } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Chess } from 'chess.js';

export default function Puzzles() {
  const { data: puzzle, isLoading, refetch } = useGetDailyPuzzle();
  const { data: streak } = useGetPuzzleStreak();
  const solvePuzzle = useSolvePuzzle();
  const { toast } = useToast();

  const [chess] = useState(() => new Chess());
  const [currentFen, setCurrentFen] = useState('');
  const [moveIndex, setMoveIndex] = useState(0);
  const [solved, setSolved] = useState(false);
  const [failed, setFailed] = useState(false);
  const [startTime] = useState(Date.now());

  useEffect(() => {
    if (puzzle?.fen) {
      chess.load(puzzle.fen);
      setCurrentFen(chess.fen());
      setMoveIndex(0);
      setSolved(false);
      setFailed(false);
    }
  }, [puzzle?.fen, chess]);

  const handleMove = (from: string, to: string, promotion?: string) => {
    if (solved || failed || !puzzle) return;

    try {
      const moveResult = chess.move({ from, to, promotion: promotion || 'q' });
      if (moveResult) {
        setCurrentFen(chess.fen());

        const expectedMove = puzzle.solution[moveIndex];

        if (moveResult.lan === expectedMove || moveResult.san === expectedMove) {
          // Player's move is correct — advance index by 1
          const nextIndex = moveIndex + 1;

          if (nextIndex >= puzzle.solution.length) {
            // All moves done — puzzle solved!
            setSolved(true);
            setMoveIndex(nextIndex);
            solvePuzzle.mutate({
              id: puzzle.id,
              data: {
                moves: puzzle.solution,
                solved: true,
                timeTakenMs: Date.now() - startTime
              }
            });
            toast({ title: "Puzzle Solved!", description: "Great job." });
          } else {
            // Opponent's reply is next — play it automatically after a short delay
            setMoveIndex(nextIndex);
            setTimeout(() => {
              const opponentMove = puzzle.solution[nextIndex];
              chess.move(opponentMove);
              setCurrentFen(chess.fen());
              setMoveIndex(nextIndex + 1);
            }, 500);
          }
        } else {
          // Wrong move
          setFailed(true);
          solvePuzzle.mutate({
            id: puzzle.id,
            data: {
              moves: puzzle.solution.slice(0, moveIndex),
              solved: false,
              timeTakenMs: Date.now() - startTime
            }
          });
          toast({ title: "Incorrect move", description: "Try again.", variant: "destructive" });
        }
      }
    } catch (e) {
      // invalid move
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-24"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!puzzle) {
    return <div className="text-center p-24">No puzzles available</div>;
  }

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 flex justify-center">
          <ChessBoard 
            fen={currentFen} 
            onMove={handleMove}
            disabled={solved || failed}
          />
        </div>
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span>Daily Puzzle</span>
                {streak && (
                  <span className="flex items-center text-orange-500 text-sm">
                    <Flame className="w-4 h-4 mr-1" /> {streak.current}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg mb-4">Find the best move for {chess.turn() === 'w' ? 'White' : 'Black'}.</div>
              {solved && <div className="text-green-500 font-bold mb-4">Puzzle Solved!</div>}
              {failed && <div className="text-red-500 font-bold mb-4">Incorrect.</div>}
              
              {(solved || failed) && (
                <div className="mt-4 pt-4 border-t flex flex-col gap-2">
                  {failed && (
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setFailed(false);
                        if (puzzle?.fen) {
                          chess.load(puzzle.fen);
                          setCurrentFen(chess.fen());
                          setMoveIndex(0);
                        }
                      }} 
                      className="w-full"
                    >
                      Try Again
                    </Button>
                  )}
                  <Button 
                    onClick={() => {
                      setSolved(false);
                      setFailed(false);
                      if (puzzle?.fen) {
                        chess.load(puzzle.fen);
                        setCurrentFen(chess.fen());
                        setMoveIndex(0);
                      }
                      refetch();
                    }} 
                    className="w-full"
                  >
                    Next Puzzle
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
