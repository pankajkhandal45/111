import React, { useState, useEffect, useCallback } from 'react';
import { useGetDailyPuzzle, useListPuzzles, useSolvePuzzle, useGetPuzzleStreak } from '@workspace/api-client-react';
import { ChessBoard } from '@/components/ChessBoard';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, Flame, Lightbulb, Trophy, Target, Zap, Crown, CheckCircle2, RotateCcw, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Chess } from 'chess.js';

export default function Puzzles() {
  const [selectedType, setSelectedType] = useState<'mate1' | 'mate2' | 'mate3' | 'all'>('mate1');
  const [puzzleIndex, setPuzzleIndex] = useState(0);

  const { data: dailyPuzzle, isLoading: isDailyLoading, refetch: refetchDaily } = useGetDailyPuzzle();
  const { data: categoryPuzzles, isLoading: isCategoryLoading, refetch: refetchCategory } = useListPuzzles({
    type: selectedType === 'all' ? undefined : selectedType,
    limit: 20,
  });

  const { data: streak } = useGetPuzzleStreak();
  const solvePuzzle = useSolvePuzzle();
  const { toast } = useToast();

  const puzzle = React.useMemo(() => {
    if (selectedType === 'all') return dailyPuzzle;
    if (!categoryPuzzles || categoryPuzzles.length === 0) return null;
    return categoryPuzzles[puzzleIndex % categoryPuzzles.length];
  }, [selectedType, dailyPuzzle, categoryPuzzles, puzzleIndex]);

  const isLoading = selectedType === 'all' ? isDailyLoading : isCategoryLoading;

  const [chess] = useState(() => new Chess());
  const [currentFen, setCurrentFen] = useState('');
  const [moveIndex, setMoveIndex] = useState(0);
  const [solved, setSolved] = useState(false);
  const [failed, setFailed] = useState(false);
  const [startTime, setStartTime] = useState(Date.now());
  const [hintSquare, setHintSquare] = useState<string | null>(null);
  const [hintTargetSquare, setHintTargetSquare] = useState<string | null>(null);
  const [hintText, setHintText] = useState<string | null>(null);
  const [hintLevel, setHintLevel] = useState<number>(0);

  const resetBoard = useCallback((fenStr: string) => {
    try {
      chess.load(fenStr);
      setCurrentFen(chess.fen());
      setMoveIndex(0);
      setSolved(false);
      setFailed(false);
      setHintSquare(null);
      setHintTargetSquare(null);
      setHintText(null);
      setHintLevel(0);
      setStartTime(Date.now());
    } catch { /* ignore */ }
  }, [chess]);

  useEffect(() => {
    if (puzzle?.fen) {
      resetBoard(puzzle.fen);
    }
  }, [puzzle?.fen, resetBoard]);

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
          setHintSquare(null);
          setHintTargetSquare(null);
          setHintText(null);

          const isCheckmate = chess.isCheckmate();
          const isFinalMove = nextIndex >= puzzle.solution.length;

          if (isCheckmate || isFinalMove) {
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
            toast({ 
              title: "🎉 CHECKMATE DELIVERED!", 
              description: "Great job! You solved the checkmate puzzle.",
              className: "bg-emerald-500 text-white font-bold"
            });
          } else {
            // Opponent's forced move response
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

                  if (chess.isCheckmate() || afterOppIndex >= puzzle.solution.length) {
                    setSolved(true);
                    solvePuzzle.mutate({
                      id: puzzle.id,
                      data: {
                        moves: puzzle.solution,
                        solved: true,
                        timeTakenMs: Date.now() - startTime
                      }
                    });
                    toast({ 
                      title: "🎉 CHECKMATE DELIVERED!", 
                      description: "Splendid! Puzzle solved successfully.",
                      className: "bg-emerald-500 text-white font-bold"
                    });
                  }
                }
              } catch { /* ignore */ }
            }, 450);
          }
        } else {
          // Revert incorrect move cleanly
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
          toast({ 
            title: "❌ Incorrect Move", 
            description: "That move does not lead to checkmate. Try again!", 
            variant: "destructive" 
          });
        }
      }
    } catch {
      // Invalid chess move
    }
  };

  const handleGetHint = () => {
    if (!puzzle || solved || failed) return;
    const expectedMoveStr = puzzle.solution[moveIndex];
    if (!expectedMoveStr) return;

    const legalMoves = chess.moves({ verbose: true });
    const cleanExpected = expectedMoveStr.trim().replace(/[+#]/g, '');

    let matched = legalMoves.find(m =>
      m.san === expectedMoveStr ||
      m.san.replace(/[+#]/g, '') === cleanExpected ||
      m.lan === expectedMoveStr ||
      `${m.from}${m.to}` === cleanExpected ||
      `${m.from}${m.to}${m.promotion || ''}` === cleanExpected
    );

    const pieceNames: Record<string, string> = {
      p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King'
    };

    if (matched) {
      const pName = pieceNames[matched.piece] || 'Piece';
      const fromUpper = matched.from.toUpperCase();
      const toUpper = matched.to.toUpperCase();

      if (hintLevel === 0) {
        setHintSquare(matched.from);
        setHintTargetSquare(null);
        setHintLevel(1);
        setHintText(`💡 Level 1 Hint: Move your ${pName} from square ${fromUpper}`);
        toast({ title: "💡 Level 1 Hint", description: `Highlighting ${pName} on ${fromUpper}` });
      } else {
        setHintSquare(matched.from);
        setHintTargetSquare(matched.to);
        setHintLevel(2);
        setHintText(`💡 Level 2 Hint: Move ${pName} ${fromUpper} → ${toUpper} (${matched.san})`);
        toast({ title: "💡 Level 2 Full Hint", description: `Play ${fromUpper} → ${toUpper} (${matched.san})` });
      }
    } else {
      setHintText(`💡 Hint: Play move ${expectedMoveStr}`);
      toast({ title: "💡 Hint", description: `Play move ${expectedMoveStr}` });
    }
  };

  const handleNextPuzzle = () => {
    setPuzzleIndex((prev) => prev + 1);
    if (selectedType === 'all') refetchDaily();
    else refetchCategory();
  };

  const currentTurnText = chess.turn() === 'w' ? 'White' : 'Black';

  return (
    <div className="max-w-5xl mx-auto py-6 sm:py-8 px-3 sm:px-4 space-y-6 w-full overflow-hidden">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 text-xs font-semibold">
            <Trophy className="w-3.5 h-3.5" /> Checkmate Challenge Arena
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Chess Puzzles</h1>
          <p className="text-xs text-muted-foreground">Find the winning moves to force checkmate</p>
        </div>

        {/* Streak & Stats Pill */}
        {streak && (
          <div className="flex items-center gap-3 bg-card/60 p-2.5 rounded-xl border border-border/50 text-xs font-semibold">
            <div className="flex items-center gap-1.5 text-orange-500">
              <Flame className="w-4 h-4 fill-orange-500/20" />
              <span>Current Streak: <strong>{streak.current}</strong></span>
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="text-muted-foreground">Best: <strong>{streak.best}</strong></div>
          </div>
        )}
      </div>

      {/* ── Checkmate Category Tabs ── */}
      <Tabs 
        value={selectedType} 
        onValueChange={(val) => {
          setSelectedType(val as any);
          setPuzzleIndex(0);
        }} 
        className="w-full space-y-6"
      >
        <TabsList className="grid grid-cols-4 w-full bg-muted/40 p-1 rounded-xl sm:rounded-2xl border border-border/50">
          <TabsTrigger value="mate1" className="rounded-lg sm:rounded-xl font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1 sm:gap-2 py-2 px-1">
            <Target className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" /> <span className="truncate">Mate in 1</span>
          </TabsTrigger>
          <TabsTrigger value="mate2" className="rounded-lg sm:rounded-xl font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1 sm:gap-2 py-2 px-1">
            <Zap className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" /> <span className="truncate">Mate in 2</span>
          </TabsTrigger>
          <TabsTrigger value="mate3" className="rounded-lg sm:rounded-xl font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1 sm:gap-2 py-2 px-1">
            <Crown className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" /> <span className="truncate">Mate in 3</span>
          </TabsTrigger>
          <TabsTrigger value="all" className="rounded-lg sm:rounded-xl font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1 sm:gap-2 py-2 px-1">
            <Trophy className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" /> <span className="truncate">All Puzzles</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* ── Main Puzzle Layout ── */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground font-semibold">Loading checkmate puzzle...</p>
        </div>
      ) : !puzzle ? (
        <Card className="p-8 text-center text-muted-foreground">No puzzles found for this category.</Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 items-start">
          {/* Board Container */}
          <div className="md:col-span-2 flex justify-center w-full">
            <ChessBoard 
              fen={currentFen} 
              onMove={handleMove}
              disabled={solved || failed}
              hintSquare={hintSquare}
              hintTargetSquare={hintTargetSquare}
            />
          </div>

          {/* Puzzle Info & Actions Panel */}
          <div className="space-y-4">
            <Card className="border-border/50 shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="pb-3 border-b border-border/40 bg-card/50">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="font-mono text-xs px-2.5 py-0.5 uppercase tracking-wider font-extrabold border-primary/30 text-primary">
                    {puzzle.type === 'mate1' && '♟️ Mate in 1'}
                    {puzzle.type === 'mate2' && '⚔️ Mate in 2'}
                    {puzzle.type === 'mate3' && '👑 Mate in 3'}
                    {puzzle.type !== 'mate1' && puzzle.type !== 'mate2' && puzzle.type !== 'mate3' && '🏆 Checkmate'}
                  </Badge>
                  <span className="text-xs font-mono font-bold text-muted-foreground">Rating: {puzzle.rating || 1200} Elo</span>
                </div>
                <CardTitle className="text-lg font-black tracking-tight mt-2">{puzzle.title || 'Checkmate Puzzle'}</CardTitle>
                <p className="text-xs text-muted-foreground">{puzzle.description || 'Find the sequence of moves that leads to checkmate.'}</p>
              </CardHeader>

              <CardContent className="pt-4 space-y-4">
                {/* Objective Card */}
                <div className="p-3 bg-muted/40 rounded-xl border border-border/40 text-xs flex items-center gap-2.5">
                  <span className={`w-3 h-3 rounded-full ${chess.turn() === 'w' ? 'bg-white border border-slate-900 shadow-sm' : 'bg-slate-950 border border-slate-400'}`} />
                  <span className="font-bold text-foreground">
                    {currentTurnText} to move and force checkmate!
                  </span>
                </div>

                {/* Status Banners */}
                {solved && (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm font-black flex items-center gap-2.5 animate-pulse">
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-500" />
                    <div>
                      <div>🎉 CHECKMATE DELIVERED!</div>
                      <div className="text-[11px] font-medium opacity-90">Puzzle completed successfully!</div>
                    </div>
                  </div>
                )}

                {failed && (
                  <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-600 dark:text-rose-400 text-xs sm:text-sm font-bold flex items-center gap-2.5">
                    <RotateCcw className="w-5 h-5 flex-shrink-0 text-rose-500" />
                    <div>
                      <div>❌ Incorrect Move</div>
                      <div className="text-[11px] font-normal opacity-90">That move does not deliver checkmate.</div>
                    </div>
                  </div>
                )}

                {/* Hint Display Box */}
                {hintText && !solved && !failed && (
                  <div className="p-3.5 bg-amber-500/15 border border-amber-500/40 rounded-xl text-amber-700 dark:text-amber-300 text-xs font-bold flex items-start gap-2.5 shadow-sm animate-pulse">
                    <Lightbulb className="w-4 h-4 flex-shrink-0 text-amber-500 mt-0.5" />
                    <span>{hintText}</span>
                  </div>
                )}

                {/* Active Action Controls */}
                {!solved && !failed && (
                  <Button 
                    variant="outline" 
                    onClick={handleGetHint} 
                    className="w-full font-bold border-amber-400/50 hover:bg-amber-400/10 text-amber-500 h-10 rounded-xl text-xs"
                  >
                    <Lightbulb className="w-4 h-4 mr-2 text-amber-400 fill-amber-400/20" /> 
                    {hintLevel === 0 ? "Get Hint (Level 1)" : "Get Full Move (Level 2)"}
                  </Button>
                )}

                {/* Completion / Retry Action Controls */}
                {(solved || failed) && (
                  <div className="pt-2 border-t border-border/40 flex flex-col gap-2.5">
                    {failed && (
                      <Button 
                        variant="outline"
                        onClick={() => {
                          if (puzzle?.fen) resetBoard(puzzle.fen);
                        }} 
                        className="w-full h-10 rounded-xl font-bold text-xs"
                      >
                        <RotateCcw className="w-4 h-4 mr-2" /> Try Again
                      </Button>
                    )}
                    <Button 
                      onClick={handleNextPuzzle} 
                      className="w-full h-10 rounded-xl font-black text-xs"
                    >
                      Next Puzzle <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
