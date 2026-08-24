import React, { useState } from 'react';
import { useGetLeaderboard } from '@workspace/api-client-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { Trophy, Loader2, Search, Crown, Flame, Zap, Clock, Medal, Swords, Target } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

export default function Leaderboard() {
  const [activeTab, setActiveTab] = useState<'bullet' | 'blitz' | 'rapid' | 'classical'>('rapid');
  const [searchQuery, setSearchQuery] = useState('');
  const { user } = useAuth();

  return (
    <div className="max-w-5xl mx-auto py-6 md:py-10 px-4 space-y-8">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 text-xs font-semibold">
            <Crown className="w-3.5 h-3.5" /> Hall of Fame
          </div>
          <h1 className="text-3xl font-black tracking-tight">Global Leaderboard</h1>
          <p className="text-xs text-muted-foreground">Top ranked chess players across all time controls</p>
        </div>

        {/* Live Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search player..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="left-3 pl-9 h-10 rounded-xl text-xs bg-card/60"
          />
        </div>
      </div>

      {/* ── Category Tabs ── */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="w-full space-y-6">
        <TabsList className="w-full justify-start bg-muted/40 p-1.5 rounded-2xl border border-border/50">
          <TabsTrigger value="rapid" className="rounded-xl font-bold text-xs flex items-center gap-2 py-2 px-4">
            <Clock className="w-4 h-4 text-emerald-500" /> Rapid
          </TabsTrigger>
          <TabsTrigger value="blitz" className="rounded-xl font-bold text-xs flex items-center gap-2 py-2 px-4">
            <Zap className="w-4 h-4 text-amber-500" /> Blitz
          </TabsTrigger>
          <TabsTrigger value="bullet" className="rounded-xl font-bold text-xs flex items-center gap-2 py-2 px-4">
            <Flame className="w-4 h-4 text-rose-500" /> Bullet
          </TabsTrigger>
          <TabsTrigger value="classical" className="rounded-xl font-bold text-xs flex items-center gap-2 py-2 px-4">
            <Trophy className="w-4 h-4 text-blue-500" /> Classical
          </TabsTrigger>
        </TabsList>

        <LeaderboardView timeControl={activeTab} searchQuery={searchQuery} currentUser={user} />
      </Tabs>
    </div>
  );
}

function LeaderboardView({ 
  timeControl, 
  searchQuery, 
  currentUser 
}: { 
  timeControl: 'bullet' | 'blitz' | 'rapid' | 'classical';
  searchQuery: string;
  currentUser: any;
}) {
  // Query with staleTime = 60s for instant 0ms tab switching
  const { data: leaderboard, isLoading } = useGetLeaderboard(
    { timeControl, limit: 50 },
    {
      query: {
        queryKey: ['/api/leaderboard', { timeControl, limit: 50 }],
        staleTime: 60_000,
        gcTime: 300_000,
        refetchOnWindowFocus: false,
      }
    }
  );

  const filteredEntries = React.useMemo(() => {
    if (!leaderboard) return [];
    if (!searchQuery.trim()) return leaderboard;
    return leaderboard.filter(e => e.username.toLowerCase().includes(searchQuery.toLowerCase().trim()));
  }, [leaderboard, searchQuery]);

  const topThree = React.useMemo(() => {
    if (!leaderboard || leaderboard.length < 3) return [];
    return [leaderboard[1], leaderboard[0], leaderboard[2]]; // Order: 2nd, 1st, 3rd for podium
  }, [leaderboard]);

  const userRankEntry = React.useMemo(() => {
    if (!currentUser || !leaderboard) return null;
    return leaderboard.find(e => e.userId === currentUser.id);
  }, [currentUser, leaderboard]);

  if (isLoading && !leaderboard) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4 h-40 bg-muted/20 animate-pulse rounded-2xl" />
        <div className="h-64 bg-muted/20 animate-pulse rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Top 3 Winners Podium (Only when no search query) ── */}
      {!searchQuery && topThree.length === 3 && (
        <div className="grid grid-cols-3 gap-3 md:gap-6 pt-4 items-end max-w-2xl mx-auto">
          {/* 2nd Place (Silver) */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.1 }}
            className="flex flex-col items-center"
          >
            <Link href={`/profile/${topThree[0].username}`} className="group flex flex-col items-center">
              <div className="relative mb-2">
                <Avatar className="h-14 w-14 border-2 border-slate-300 shadow-md group-hover:scale-105 transition-transform">
                  <AvatarImage src={topThree[0].avatar || undefined} />
                  <AvatarFallback>{topThree[0].username.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-slate-300 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full shadow">
                  #2
                </span>
              </div>
              <div className="text-center">
                <div className="font-extrabold text-xs truncate max-w-[100px] group-hover:text-primary transition-colors">{topThree[0].username}</div>
                <div className="text-xs font-mono font-bold text-slate-400">{topThree[0].rating}</div>
              </div>
            </Link>
            <div className="w-full bg-gradient-to-t from-slate-500/20 to-slate-500/5 border-t-2 border-slate-400 rounded-t-xl h-24 mt-3 flex items-center justify-center font-bold text-slate-400 text-sm">
              🥈 2nd
            </div>
          </motion.div>

          {/* 1st Place (Gold) */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0 }}
            className="flex flex-col items-center"
          >
            <Link href={`/profile/${topThree[1].username}`} className="group flex flex-col items-center">
              <Crown className="w-6 h-6 text-amber-400 mb-1 animate-bounce" />
              <div className="relative mb-2">
                <Avatar className="h-20 w-20 border-4 border-amber-400 shadow-xl ring-4 ring-amber-400/20 group-hover:scale-105 transition-transform">
                  <AvatarImage src={topThree[1].avatar || undefined} />
                  <AvatarFallback>{topThree[1].username.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-amber-400 text-black text-xs font-black px-2.5 py-0.5 rounded-full shadow">
                  #1
                </span>
              </div>
              <div className="text-center">
                <div className="font-extrabold text-sm truncate max-w-[120px] group-hover:text-primary transition-colors">{topThree[1].username}</div>
                <div className="text-sm font-mono font-black text-amber-400">{topThree[1].rating}</div>
              </div>
            </Link>
            <div className="w-full bg-gradient-to-t from-amber-500/30 to-amber-500/5 border-t-2 border-amber-400 rounded-t-xl h-32 mt-3 flex items-center justify-center font-black text-amber-400 text-base">
              🥇 1st
            </div>
          </motion.div>

          {/* 3rd Place (Bronze) */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.2 }}
            className="flex flex-col items-center"
          >
            <Link href={`/profile/${topThree[2].username}`} className="group flex flex-col items-center">
              <div className="relative mb-2">
                <Avatar className="h-14 w-14 border-2 border-amber-700 shadow-md group-hover:scale-105 transition-transform">
                  <AvatarImage src={topThree[2].avatar || undefined} />
                  <AvatarFallback>{topThree[2].username.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-amber-700 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow">
                  #3
                </span>
              </div>
              <div className="text-center">
                <div className="font-extrabold text-xs truncate max-w-[100px] group-hover:text-primary transition-colors">{topThree[2].username}</div>
                <div className="text-xs font-mono font-bold text-amber-600">{topThree[2].rating}</div>
              </div>
            </Link>
            <div className="w-full bg-gradient-to-t from-amber-800/20 to-amber-800/5 border-t-2 border-amber-700 rounded-t-xl h-20 mt-3 flex items-center justify-center font-bold text-amber-600 text-sm">
              🥉 3rd
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Logged-in User Rank Banner ── */}
      {userRankEntry && (
        <Card className="border-primary/30 bg-primary/5 p-4 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="font-mono font-black text-sm px-2.5 py-1 border-primary/40 text-primary">
              Rank #{userRankEntry.rank}
            </Badge>
            <div>
              <div className="font-extrabold text-sm">Your Leaderboard Standing</div>
              <div className="text-xs text-muted-foreground">Rating: <strong className="text-foreground">{userRankEntry.rating} Elo</strong> • Win Rate: <strong className="text-foreground">{userRankEntry.winRate}%</strong></div>
            </div>
          </div>
          <Button asChild size="sm" variant="outline" className="text-xs font-bold rounded-xl">
            <Link href={`/profile/${currentUser.username}`}>View Profile</Link>
          </Button>
        </Card>
      )}

      {/* ── Leaderboard Table Card ── */}
      <Card className="border-border/50 shadow-sm rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-sm text-left min-w-[550px]">
              <thead className="bg-muted/40 text-muted-foreground uppercase text-[11px] font-extrabold">
                <tr>
                  <th className="px-6 py-3.5 w-16 text-center">Rank</th>
                  <th className="px-6 py-3.5">Player</th>
                  <th className="px-6 py-3.5 text-right">Rating</th>
                  <th className="px-6 py-3.5 text-right">Win Rate</th>
                  <th className="px-6 py-3.5 text-right">Total Games</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredEntries.map((entry) => {
                  const isMe = currentUser?.id === entry.userId;
                  return (
                    <tr 
                      key={entry.userId} 
                      className={`hover:bg-muted/30 transition-colors ${isMe ? 'bg-primary/10 font-bold' : ''}`}
                    >
                      <td className="px-6 py-3.5 text-center font-mono font-bold">
                        {entry.rank === 1 && <span className="text-amber-400 font-extrabold">🥇 1</span>}
                        {entry.rank === 2 && <span className="text-slate-300 font-extrabold">🥈 2</span>}
                        {entry.rank === 3 && <span className="text-amber-600 font-extrabold">🥉 3</span>}
                        {entry.rank > 3 && <span className="text-muted-foreground">#{entry.rank}</span>}
                      </td>
                      <td className="px-6 py-3.5">
                        <Link href={`/profile/${entry.username}`} className="flex items-center gap-3 hover:text-primary transition-colors">
                          <Avatar className="h-8 w-8 border border-border/60">
                            <AvatarImage src={entry.avatar || undefined} />
                            <AvatarFallback>{entry.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-sm">{entry.username}</span>
                            {isMe && <Badge className="text-[9px] px-1.5 py-0 uppercase">You</Badge>}
                          </div>
                        </Link>
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono font-black text-base">
                        {entry.rating}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <div className="inline-flex items-center gap-2">
                          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden hidden sm:block">
                            <div 
                              className="h-full bg-emerald-500 rounded-full" 
                              style={{ width: `${entry.winRate || 0}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs font-bold text-muted-foreground">
                            {entry.winRate ? `${entry.winRate.toFixed(1)}%` : '-'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono text-xs text-muted-foreground font-semibold">
                        {(entry.wins || 0) + (entry.losses || 0) + (entry.draws || 0)}
                      </td>
                    </tr>
                  );
                })}

                {filteredEntries.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground text-xs">
                      No players found for &quot;{searchQuery}&quot;
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
