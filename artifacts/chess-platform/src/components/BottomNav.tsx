import React from 'react';
import { Link, useLocation } from 'wouter';
import { Home, Play, Puzzle, Trophy, User, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export function BottomNav() {
  const [location] = useLocation();
  const { user } = useAuth();

  const navItems = [
    { href: '/', icon: Home, label: 'Home' },
    { href: '/play', icon: Play, label: 'Play' },
    { href: '/puzzles', icon: Puzzle, label: 'Puzzles' },
    { href: '/friends', icon: Users, label: 'Friends' },
    { href: '/leaderboard', icon: Trophy, label: 'Rank' },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur border-t border-border pb-safe">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = location === item.href || (item.href !== '/' && location.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link 
              key={item.label} 
              href={item.href} 
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'fill-primary/20' : ''}`} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
