import React from 'react';
import { NavBar } from './NavBar';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'wouter';
import { useHeartbeat } from '@/hooks/useHeartbeat';

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  useHeartbeat();

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground font-sans">
      <NavBar />
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
