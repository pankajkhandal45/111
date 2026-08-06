import React, { useState, useEffect } from 'react';
import { useGetDailyPuzzle, useSolvePuzzle, useGetPuzzleStreak } from '@workspace/api-client-react';
import { ChessBoard } from '@/components/ChessBoard';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Flame, Lightbulb } from 'lucide-react';
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
  const [hintSquare, setHintSquare] = useState<string | null>(null);
  const [hintText, setHintText] = useState<string | null>(null);

  useEffect(() => {
    if (puzzle?.fen) {
      chess.load(puzzle.fen);
      setCurrentFen(chess.fen());
      setMoveIndex(0);
      setSolved(false);
      setFailed(false);
      setHintSquare(null);
      setHintText(null);
    }
  }, [puzzle?.fen, chess]);

  const isMoveMatch = (moveResult: any, expected: string) => {
    if (!moveResult || !expected) return false;
    const cleanExpected = expected.trim().replace(/[+#]/g, '');
    const cleanSan = moveResult.san.replace(/[+#]/g, '');
    const lan = moveResult.lan || `${moveResult.from}${moveResult.to}`;
    const uci = `${moveResult.from}${moveResult.to}${moveResult.promotion || ''}`;

    return (
      moveResult.san === expected ||
      moveResult.lan === expected ||
      cleanSan === cleanExpected ||
      lan === cleanExpected ||
      uci === cleanExpected
    );
  };

  const handleMove = (from: string, to: string, promotion?: string) => {
    if (solved || failed || !puzzle) return;

    try {
      const expectedMove = puzzle.solution[moveIndex];
      const moveResult = chess.move({ from, to, promotion: promotion || 'q' });

      if (moveResult) {
        if (isMoveMatch(moveResult, expectedMove)) {
          setCurrentFen(chess.fen());
          const nextIndex = moveIndex + 1;

          if (nextIndex >= puzzle.solution.length) {
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
            toast({ title: "Puzzle Solved!", description: "Great job!" });
          } else {
            // Opponent's reply is next
            setMoveIndex(nextIndex);
            setTimeout(() => {
              try {
                const oppMoveStr = puzzle.solution[nextIndex];
                let oppResult = null;
                try {
                  oppResult = chess.move(oppMoveStr);
                } catch {
                  const legalMoves = chess.moves({ verbose: true });
                  const cleanOpp = oppMoveStr.replace(/[+#]/g, '');
                  const found = legalMoves.find(m => m.san === oppMoveStr || m.san.replace(/[+#]/g, '') === cleanOpp || m.lan === oppMoveStr);
                  if (found) {
                    oppResult = chess.move(found.san);
                  }
                }

                if (oppResult) {
                  setCurrentFen(chess.fen());
                  const afterOppIndex = nextIndex + 1;
                  setMoveIndex(afterOppIndex);

                  if (afterOppIndex >= puzzle.solution.length) {
                    setSolved(true);
                    solvePuzzle.mutate({
                      id: puzzle.id,
                      data: {
                        moves: puzzle.solution,
                        solved: true,
                        timeTakenMs: Date.now() - startTime
                      }
                    });
                    toast({ title: "Puzzle Solved!", description: "Great job!" });
                  }
                }
              } catch { /* ignore */ }
            }, 400);
          }
        } else {
          // Revert wrong move on the board so user can try again easily
          chess.undo();
          setCurrentFen(chess.fen());
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

  const handleGetHint = () => {
    if (!puzzle || solved || failed) return;
    const expectedMoveStr = puzzle.solution[moveIndex];
    if (!expectedMoveStr) return;

    const legalMoves = chess.moves({ verbose: true });
    const cleanExpected = expectedMoveStr.trim().replace(/[+#]/g, '');
    const matched = legalMoves.find(m =>
      m.san === expectedMoveStr ||
      m.san.replace(/[+#]/g, '') === cleanExpected ||
      m.lan === expectedMoveStr ||
      `${m.from}${m.to}` === cleanExpected
    );

    if (matched) {
      setHintSquare(matched.from);
      const pieceNames: Record<string, string> = {
        p: 'Pawn',
        n: 'Knight',
        b: 'Bishop',
        r: 'Rook',
        q: 'Queen',
        k: 'King'
      };
      const pName = pieceNames[matched.piece] || 'Piece';
      const msg = `Move ${pName} on ${matched.from.toUpperCase()} (towards ${matched.to.toUpperCase()})`;
      setHintText(msg);
      toast({
        title: "💡 Hint Available",
        description: msg,
        duration: 5000,
      });
    } else {
      const msg = `Try move starting with: ${expectedMoveStr.substring(0, 2)}`;
      setHintText(msg);
      toast({
        title: "💡 Hint Available",
        description: msg,
        duration: 5000,
      });
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
            hintSquare={hintSquare}
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
            <CardContent className="space-y-4">
              <div className="text-lg">Find the best move for {chess.turn() === 'w' ? 'White' : 'Black'}.</div>
              
              {solved && <div className="text-green-500 font-bold">🎉 Puzzle Solved!</div>}
              {failed && <div className="text-red-500 font-bold">❌ Incorrect move.</div>}

              {/* Hint Display Box */}
              {hintText && !solved && !failed && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-600 dark:text-amber-400 text-sm font-semibold flex items-center gap-2 animate-pulse">
                  <Lightbulb className="w-4 h-4 flex-shrink-0" />
                  <span>{hintText}</span>
                </div>
              )}

              {/* Hint Button when playing */}
              {!solved && !failed && (
                <Button 
                  variant="outline" 
                  onClick={handleGetHint} 
                  className="w-full font-semibold border-amber-400/40 hover:bg-amber-400/10 text-amber-500"
                >
                  <Lightbulb className="w-4 h-4 mr-2 text-amber-400 fill-amber-400/20" /> Get Hint
                </Button>
              )}
              
              {(solved || failed) && (
                <div className="pt-2 border-t flex flex-col gap-2">
                  {failed && (
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setFailed(false);
                        setHintSquare(null);
                        setHintText(null);
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
                      setHintSquare(null);
                      setHintText(null);
                      if (puzzle?.fen) {
                        chess.load(puzzle.fen);
                        setCurrentFen(chess.fen());
                        setMoveIndex(0);
                      }
                      refetch();
                    }} 
                    className="w-full font-bold"
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
