import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface GameClockProps {
  timeMs: number;
  isActive: boolean;
  color: 'white' | 'black';
}

export function GameClock({ timeMs, isActive, color }: GameClockProps) {
  const [timeLeft, setTimeLeft] = useState(timeMs);

  useEffect(() => {
    setTimeLeft(timeMs);
  }, [timeMs]);

  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 100)); // Update every 100ms
    }, 100);

    return () => clearInterval(interval);
  }, [isActive]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    if (ms < 10000 && ms > 0) { // Under 10 seconds, show tenths
      const tenths = Math.floor((ms % 1000) / 100);
      return `${minutes}:${seconds.toString().padStart(2, '0')}.${tenths}`;
    }
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const isLowTime = timeLeft > 0 && timeLeft <= 30000; // Under 30 seconds

  return (
    <div className={cn(
      "px-4 py-2 rounded-md font-mono text-2xl font-bold shadow-sm flex items-center justify-center min-w-[120px]",
      color === 'white' 
        ? "bg-white text-black border border-gray-200" 
        : "bg-gray-900 text-white border border-gray-800",
      isActive && "ring-2 ring-primary ring-offset-2",
      isLowTime && "text-red-500 bg-red-50 dark:bg-red-950/20 border-red-500",
      timeLeft === 0 && "opacity-50 line-through"
    )}>
      {formatTime(timeLeft)}
    </div>
  );
}
