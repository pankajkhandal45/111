import React, { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { Move } from '@workspace/api-client-react/src/generated/api.schemas';

interface MoveHistoryProps {
  moves?: Move[];
  onMoveClick?: (moveIndex: number) => void;
  activeMoveIndex?: number;
}

export function MoveHistory({ moves = [], onMoveClick, activeMoveIndex }: MoveHistoryProps) {
  const [open, setOpen] = React.useState(true);
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

  moves.forEach((move, idx) => {
    const moveNum = move.moveNumber ?? (idx + 1);
    const pairNumber = Math.ceil(moveNum / 2);
    const isWhiteMove = moveNum % 2 === 1;

    // Ensure the pair slot exists
    while (pairedMoves.length < pairNumber) {
      pairedMoves.push({ pairNumber: pairedMoves.length + 1 });
    }

    const pair = pairedMoves[pairNumber - 1];
    if (pair) {
      const normalizedMove = { ...move, moveNumber: moveNum };
      if (isWhiteMove) {
        pair.white = normalizedMove;
      } else {
        pair.black = normalizedMove;
      }
    }
  });

  return (
    <div className="flex flex-col bg-card rounded-md border shadow-sm overflow-hidden">
      {/* ── Collapsible Header ── */}
      <button
        className="flex items-center justify-between px-4 py-2.5 bg-muted/50 hover:bg-muted transition-colors cursor-pointer w-full text-left border-b"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Move History</span>
          {!open && moves.length > 0 && (
            <span className="bg-primary text-primary-foreground text-xs rounded-full px-1.5 py-0.5 font-bold leading-none">
              {moves.length}
            </span>
          )}
        </div>
        <span
          className="text-xs text-muted-foreground transition-transform duration-200"
          style={{ display: 'inline-block', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
        >
          ▼
        </span>
      </button>

      {/* ── Move Table ── */}
      {open && (
        <div className="relative">
          {/* Scroll container — fixed height, always scrollable */}
          <div
            ref={scrollRef}
            className="overflow-y-auto p-2"
            style={{
              height: '260px',
              scrollbarWidth: 'thin',
              scrollbarColor: 'hsl(var(--border)) transparent',
            }}
          >
            <table className="w-full text-sm text-left">
              <tbody>
                {pairedMoves.map((pair, idx) => (
                  <tr key={pair.pairNumber} className={cn(
                    "border-b border-border/40 last:border-0",
                    idx % 2 === 0 ? "bg-card" : "bg-muted/20"
                  )}>
                    <td className="py-1 px-2 text-muted-foreground w-8 select-none font-mono text-xs">
                      {pair.pairNumber}.
                    </td>
                    <td className="py-1 px-2">
                      {pair.white && (
                        <span
                          className={cn(
                            "cursor-pointer hover:bg-accent hover:text-accent-foreground px-1.5 py-0.5 rounded transition-colors font-medium",
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
                            "cursor-pointer hover:bg-accent hover:text-accent-foreground px-1.5 py-0.5 rounded transition-colors font-medium",
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
                    <td colSpan={3} className="py-8 text-center text-muted-foreground italic text-xs">
                      No moves yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Bottom fade — hints that more moves are below */}
          {pairedMoves.length > 7 && (
            <div
              className="absolute bottom-0 left-0 right-0 h-6 pointer-events-none"
              style={{
                background: 'linear-gradient(to bottom, transparent, hsl(var(--card)))',
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
