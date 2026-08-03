import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface ActiveGameContextType {
  isGameActive: boolean;
  setIsGameActive: (active: boolean) => void;
  setOnLeaveCallback: (cb: (() => Promise<void> | void) | null) => void;
  confirmNavigation: (targetPath: string) => void;
}

const ActiveGameContext = createContext<ActiveGameContextType>({
  isGameActive: false,
  setIsGameActive: () => {},
  setOnLeaveCallback: () => {},
  confirmNavigation: () => {},
});

export const useActiveGame = () => useContext(ActiveGameContext);

export function ActiveGameProvider({ children }: { children: React.ReactNode }) {
  const [isGameActive, setIsGameActive] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const onLeaveCallbackRef = useRef<(() => Promise<void> | void) | null>(null);
  const [, setLocation] = useLocation();

  const setOnLeaveCallback = (cb: (() => Promise<void> | void) | null) => {
    onLeaveCallbackRef.current = cb;
  };

  const confirmNavigation = (targetPath: string) => {
    if (isGameActive) {
      setPendingPath(targetPath);
    } else {
      setLocation(targetPath);
    }
  };

  // 1. Browser Tab Close / Refresh Protection (beforeunload)
  useEffect(() => {
    if (!isGameActive) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isGameActive]);

  // 2. Browser Back / Forward Button Protection (popstate)
  useEffect(() => {
    if (!isGameActive) return;

    // Push dummy state to prevent instant back navigation
    window.history.pushState(null, '', window.location.href);

    const handlePopState = () => {
      window.history.pushState(null, '', window.location.href);
      setPendingPath('BACK');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isGameActive]);

  // 3. Intercept all Link / <a> / Navigation Clicks globally when game is active
  useEffect(() => {
    if (!isGameActive) return;

    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const anchor = target.closest('a') || target.closest('[data-nav-href]');
      if (!anchor) return;

      const href = anchor.getAttribute('href') || anchor.getAttribute('data-nav-href');
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

      const currentPath = window.location.pathname;
      if (href !== currentPath && !href.endsWith(currentPath)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setPendingPath(href);
      }
    };

    document.addEventListener('click', handleGlobalClick, true);
    return () => document.removeEventListener('click', handleGlobalClick, true);
  }, [isGameActive]);

  const handleConfirmLeave = async () => {
    setIsLeaving(true);
    try {
      if (onLeaveCallbackRef.current) {
        await onLeaveCallbackRef.current();
      }
    } catch { /* ignore */ }

    const target = pendingPath;
    setIsGameActive(false);
    setPendingPath(null);
    setIsLeaving(false);

    if (target === 'BACK') {
      window.history.go(-2);
    } else if (target) {
      setLocation(target);
    }
  };

  const handleCancelLeave = () => {
    setPendingPath(null);
  };

  return (
    <ActiveGameContext.Provider value={{ isGameActive, setIsGameActive, setOnLeaveCallback, confirmNavigation }}>
      {children}

      {/* ── Leave Game Confirmation Popup ── */}
      {pendingPath && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
        >
          <div
            className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col items-center gap-4 text-center"
            style={{ animation: 'fadeInScale 0.2s ease' }}
          >
            <div className="w-12 h-12 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 mb-1">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xl font-bold tracking-tight text-foreground">
                Do you want to quit the game?
              </h3>
              <p className="text-muted-foreground text-xs leading-relaxed">
                You are currently in an active game. If you leave, your game will be resigned.
              </p>
            </div>

            <div className="flex flex-col gap-2 w-full pt-2">
              <Button
                variant="destructive"
                className="w-full font-semibold"
                onClick={handleConfirmLeave}
                disabled={isLeaving}
              >
                {isLeaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Yes, Quit Game
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleCancelLeave}
                disabled={isLeaving}
              >
                No, Continue Game
              </Button>
            </div>
          </div>

          <style>{`
            @keyframes fadeInScale {
              from { opacity: 0; transform: scale(0.92); }
              to   { opacity: 1; transform: scale(1); }
            }
          `}</style>
        </div>
      )}
    </ActiveGameContext.Provider>
  );
}
