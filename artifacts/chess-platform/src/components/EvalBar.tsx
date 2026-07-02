import React from 'react';
import { cn } from '@/lib/utils';

interface EvalBarProps {
  evaluation: number; // centipawns. + is white advantage, - is black advantage
  flipped?: boolean;
}

export function EvalBar({ evaluation, flipped = false }: EvalBarProps) {
  // Cap at +/- 1000 centipawns (10.0 pawns)
  const cappedEval = Math.max(-1000, Math.min(1000, evaluation));
  
  // Convert to pawns for display
  const displayEval = (Math.abs(cappedEval) / 100).toFixed(1);
  const isWhiteAdvantage = cappedEval > 0;
  
  // Calculate height percentage (50% is equal)
  // Non-linear mapping to make small advantages more visible
  const calcHeight = (val: number) => {
    // 0 -> 50%
    // 100 (1 pawn) -> ~60%
    // 300 (3 pawns) -> ~75%
    // 1000 (10 pawns) -> ~95%
    const normalized = Math.min(1, Math.max(-1, val / 1000));
    return 50 + (Math.sign(normalized) * Math.pow(Math.abs(normalized), 0.5) * 45);
  };
  
  const whiteHeightPct = calcHeight(cappedEval);
  const blackHeightPct = 100 - whiteHeightPct;

  return (
    <div className="w-6 sm:w-8 h-full bg-gray-800 rounded-sm overflow-hidden flex flex-col relative select-none">
      {/* White bar (top or bottom depending on flip) */}
      <div 
        className={cn(
          "w-full bg-white transition-all duration-500 ease-in-out absolute left-0 right-0",
          flipped ? "bottom-0" : "top-0"
        )}
        style={{ height: `${whiteHeightPct}%` }}
      />
      
      {/* Black bar */}
      <div 
        className={cn(
          "w-full bg-gray-800 transition-all duration-500 ease-in-out absolute left-0 right-0",
          flipped ? "top-0" : "bottom-0"
        )}
        style={{ height: `${blackHeightPct}%` }}
      />
      
      {/* Eval Text */}
      <div className={cn(
        "absolute w-full text-center text-[10px] sm:text-xs font-semibold px-1 py-1 z-10",
        isWhiteAdvantage 
          ? (flipped ? "bottom-0 text-black" : "top-0 text-black")
          : (flipped ? "top-0 text-white" : "bottom-0 text-white")
      )}>
        {displayEval}
      </div>
    </div>
  );
}
