import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Chess, Square, PieceSymbol, Color, Move } from 'chess.js';

interface ChessBoardProps {
  fen: string;
  onMove?: (from: string, to: string, promotion?: string) => void;
  flipped?: boolean;
  legalMoves?: string[];
  lastMove?: { from: string; to: string };
  disabled?: boolean;
  rotateTopPieces?: boolean;
  hintSquare?: string | null;
  hintTargetSquare?: string | null;
}

const PIECE_SYMBOLS: Record<Color, Record<PieceSymbol, string>> = {
  w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔' },
  b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' }
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

const DEFAULT_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export function ChessBoard({ 
  fen, 
  onMove, 
  flipped = false, 
  lastMove, 
  disabled = false, 
  rotateTopPieces = false, 
  hintSquare = null, 
  hintTargetSquare = null 
}: ChessBoardProps) {
  const [chess, setChess] = useState(() => {
    const c = new Chess();
    if (fen && fen.trim()) {
      try { c.load(fen); } catch { /* use default */ }
    }
    return c;
  });
  
  // Update internal chess state when fen changes from props
  useEffect(() => {
    const safeFen = fen && fen.trim() ? fen : DEFAULT_FEN;
    try {
      const newChess = new Chess(safeFen);
      setChess(newChess);
      setSelectedSquare(null);
      setValidMoves([]);
    } catch (e) {
      // Invalid FEN, keep current state
    }
  }, [fen]);

  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [validMoves, setValidMoves] = useState<Move[]>([]);
  const [promotionMove, setPromotionMove] = useState<{from: string, to: string} | null>(null);

  const board = chess.board();

  // Handle square click
  const handleSquareClick = (square: string) => {
    if (disabled || promotionMove) return;

    if (selectedSquare) {
      // Check if clicking on a valid move destination
      const move = validMoves.find(m => m.to === square);
      
      if (move) {
        // Check for promotion
        if (move.flags.includes('p')) {
          setPromotionMove({ from: selectedSquare, to: square });
          return;
        }

        // Execute normal move
        if (onMove) {
          onMove(selectedSquare, square);
        }
        setSelectedSquare(null);
        setValidMoves([]);
      } else {
        // Clicked elsewhere
        const piece = chess.get(square as Square);
        if (piece && piece.color === chess.turn()) {
          // Select own piece
          setSelectedSquare(square);
          setValidMoves(chess.moves({ square: square as Square, verbose: true }));
        } else {
          // Deselect
          setSelectedSquare(null);
          setValidMoves([]);
        }
      }
    } else {
      // No piece selected, try to select one
      const piece = chess.get(square as Square);
      if (piece && piece.color === chess.turn()) {
        setSelectedSquare(square);
        setValidMoves(chess.moves({ square: square as Square, verbose: true }));
      }
    }
  };

  const handlePromotion = (promotionPiece: string) => {
    if (promotionMove && onMove) {
      onMove(promotionMove.from, promotionMove.to, promotionPiece);
    }
    setPromotionMove(null);
    setSelectedSquare(null);
    setValidMoves([]);
  };

  const displayRanks = flipped ? [...RANKS].reverse() : RANKS;
  const displayFiles = flipped ? [...FILES].reverse() : FILES;

  // Check if king is in check
  const inCheck = chess.isCheck();
  const turn = chess.turn();
  const kingSquare = (() => {
    if (!inCheck) return null;
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const p = board[r][f];
        if (p && p.type === 'k' && p.color === turn) {
          return `${FILES[f]}${8 - r}`;
        }
      }
    }
    return null;
  })();

  return (
    <div className="relative w-full max-w-[600px] aspect-square rounded-xl overflow-hidden shadow-xl select-none touch-none border-2 border-border/60">
      <div className="absolute inset-0 grid grid-cols-8 grid-rows-8">
        {displayRanks.map((rank, rIdx) => 
          displayFiles.map((file, fIdx) => {
            const square = `${file}${rank}` as Square;
            const isDark = (rIdx + fIdx) % 2 !== 0;
            const piece = chess.get(square);
            
            const isSelected = selectedSquare === square;
            const isLastMove = lastMove?.from === square || lastMove?.to === square;
            const isValidMove = validMoves.some(m => m.to === square);
            const isKingInCheck = inCheck && square === kingSquare;
            const isHintSource = hintSquare === square;
            const isHintTarget = hintTargetSquare === square;
            
            return (
              <div 
                key={square}
                onClick={() => handleSquareClick(square)}
                className={cn(
                  "relative flex items-center justify-center w-full h-full transition-colors",
                  isDark ? "bg-[#5D7E5D] text-[#ECEED5]" : "bg-[#ECEED5] text-[#5D7E5D]",
                  isLastMove && "bg-yellow-400/40 dark:bg-yellow-500/40",
                  isSelected && "bg-yellow-400/70 dark:bg-yellow-500/70 shadow-inner",
                  isHintSource && "!bg-amber-400 !text-black animate-pulse ring-4 ring-amber-500 z-10 font-bold",
                  isHintTarget && "!bg-emerald-400 !text-black animate-pulse ring-4 ring-emerald-500 z-10 font-bold",
                  isKingInCheck && "!bg-red-500 text-white animate-pulse"
                )}
              >
                {/* Coordinates */}
                {fIdx === 0 && (
                  <span className="absolute top-1 left-1 text-[10px] sm:text-xs font-bold opacity-80 pointer-events-none">
                    {rank}
                  </span>
                )}
                {rIdx === 7 && (
                  <span className="absolute bottom-0.5 right-1 text-[10px] sm:text-xs font-bold opacity-80 pointer-events-none">
                    {file}
                  </span>
                )}

                {/* Valid Move Indicator */}
                {isValidMove && !piece && (
                  <div className="absolute w-1/3 h-1/3 rounded-full bg-black/25 z-10 pointer-events-none" />
                )}
                {isValidMove && piece && (
                  <div className="absolute inset-0 border-[5px] border-black/30 rounded-full z-10 pointer-events-none" />
                )}

                {/* Piece */}
                {piece && (
                  <div 
                    className={cn(
                      "relative z-20 text-[2.5rem] sm:text-[3.8rem] leading-none filter drop-shadow-sm transition-transform duration-150 ease-in-out cursor-pointer",
                      piece.color === 'w' ? "text-white" : "text-black",
                      "drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]",
                      rotateTopPieces && piece.color === (flipped ? 'w' : 'b') ? "rotate-180" : ""
                    )}
                  >
                    {PIECE_SYMBOLS[piece.color][piece.type]}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Promotion Dialog Overlay */}
      {promotionMove && (
        <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-card p-4 rounded-xl shadow-2xl flex gap-2 border border-border">
            {['q', 'r', 'b', 'n'].map(p => (
              <button
                key={p}
                onClick={(e) => {
                  e.stopPropagation();
                  handlePromotion(p);
                }}
                className="w-14 h-14 bg-muted hover:bg-accent rounded-lg flex items-center justify-center text-3xl transition-transform hover:scale-105"
              >
                <span className={cn(
                  chess.turn() === 'w' ? "text-white" : "text-black",
                  "drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]"
                )}>
                  {PIECE_SYMBOLS[chess.turn()][p as PieceSymbol]}
                </span>
              </button>
            ))}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setPromotionMove(null);
                setSelectedSquare(null);
              }}
              className="absolute top-2 right-2 text-muted-foreground hover:text-foreground text-xl font-bold"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
