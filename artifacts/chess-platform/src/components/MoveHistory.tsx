import React, { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { Move } from '@workspace/api-client-react/src/generated/api.schemas';

interface MoveHistoryProps {
  moves?: Move[];
  onMoveClick?: (moveIndex: number) => void;
  activeMoveIndex?: number;
}

export function MoveHistory({ moves = [], onMoveClick, activeMoveIndex }: MoveHistoryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new moves arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [moves.length]);

  // Group moves into pairs (White, Black)
  // moveNumber in DB is 1-based sequential: 1=white's 1st, 2=black's 1st, 3=white's 2nd ...
  const pairedMoves: { pairNumber: number, white?: Move, black?: Move }[] = [];

  moves.forEach(move => {
    const pairNumber = Math.ceil(move.moveNumber / 2);
    const isWhiteMove = move.moveNumber % 2 === 1;

    // Ensure the pair slot exists
    while (pairedMoves.length < pairNumber) {
      pairedMoves.push({ pairNumber: pairedMoves.length + 1 });
    }

    const pair = pairedMoves[pairNumber - 1];
    if (pair) {
      if (isWhiteMove) {
        pair.white = move;
      } else {
        pair.black = move;
      }
    }
  });

  return (
    <div className="flex flex-col h-full bg-card rounded-md border shadow-sm overflow-hidden">
      <div className="px-4 py-2 border-b bg-muted/50 font-semibold text-sm">
        Move History
      </div>
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-2"
      >
        <table className="w-full text-sm text-left">
          <tbody>
            {pairedMoves.map((pair, idx) => (
              <tr key={pair.moveNumber} className={cn(
                "border-b border-border/40 last:border-0",
                idx % 2 === 0 ? "bg-card" : "bg-muted/20"
              )}>
                <td className="py-1 px-2 text-muted-foreground w-8 select-none">
                  {pair.pairNumber}.
                </td>
                <td className="py-1 px-2">
                  {pair.white && (
                    <span 
                      className={cn(
                        "cursor-pointer hover:bg-accent hover:text-accent-foreground px-1 rounded transition-colors",
                        activeMoveIndex === (pair.white.moveNumber - 1) && "bg-primary text-primary-foreground hover:bg-primary/90"
                      )}
                      onClick={() => onMoveClick?.(pair.white!.moveNumber - 1)}
                    >
                      {pair.white.san}
                    </span>
                  )}
                </td>
                <td className="py-1 px-2">
                  {pair.black && (
                    <span 
                      className={cn(
                        "cursor-pointer hover:bg-accent hover:text-accent-foreground px-1 rounded transition-colors",
                        activeMoveIndex === (pair.black.moveNumber - 1) && "bg-primary text-primary-foreground hover:bg-primary/90"
                      )}
                      onClick={() => onMoveClick?.(pair.black!.moveNumber - 1)}
                    >
                      {pair.black.san}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {moves.length === 0 && (
              <tr>
                <td colSpan={3} className="py-4 text-center text-muted-foreground italic">
                  No moves yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
