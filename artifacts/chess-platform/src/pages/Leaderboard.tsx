import React, { useState } from 'react';
import { useGetLeaderboard } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { Trophy, Search, Crown, Flame, Zap, Clock, Users, UserPlus, LogIn, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function Leaderboard() {
  const [activeTab, setActiveTab] = useState<'bullet' | 'blitz' | 'rapid' | 'classical'>('rapid');
  const [searchQuery, setSearchQuery] = useState('');
  const { user, isLoading: authLoading } = useAuth();

  return (
    <div className="max-w-5xl mx-auto py-4 sm:py-8 px-2 sm:px-4 space-y-5 sm:space-y-8 w-full overflow-hidden">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
            <Users className="w-3.5 h-3.5" /> Friends Circle
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Friends Leaderboard</h1>
          <p className="text-xs text-muted-foreground">Rankings and standings among you and your chess friends</p>
        </div>

        {/* Live Search Input - text-base on mobile prevents auto viewport zoom */}
        {user && (
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search friend..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 sm:h-10 rounded-xl text-base sm:text-xs bg-card/60"
            />
          </div>
        )}
      </div>

      {/* ── If Not Logged In ── */}
      {!authLoading && !user ? (
        <Card className="border-border/60 bg-gradient-to-b from-card to-muted/20 p-8 text-center space-y-6 rounded-2xl shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-inner">
            <Trophy className="w-8 h-8" />
          </div>
          <div className="space-y-2 max-w-md mx-auto">
            <h2 className="text-xl font-extrabold tracking-tight">Sign in to see Friends Leaderboard</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Connect with your friends, challenge each other to games, and climb the personal rankings together!
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button asChild size="default" className="font-bold rounded-xl px-6">
              <Link href="/login">
                <LogIn className="w-4 h-4 mr-2" /> Log In
              </Link>
            </Button>
            <Button asChild variant="outline" size="default" className="font-bold rounded-xl px-6">
              <Link href="/register">Create Account</Link>
            </Button>
          </div>
        </Card>
      ) : (
        /* ── Category Tabs ── */
        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="w-full space-y-4 sm:space-y-6">
          <TabsList className="grid grid-cols-4 w-full bg-muted/40 p-1 rounded-xl sm:rounded-2xl border border-border/50">
            <TabsTrigger value="rapid" className="rounded-lg sm:rounded-xl font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1 sm:gap-2 py-1.5 sm:py-2 px-1">
              <Clock className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" /> <span className="truncate">Rapid</span>
            </TabsTrigger>
            <TabsTrigger value="blitz" className="rounded-lg sm:rounded-xl font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1 sm:gap-2 py-1.5 sm:py-2 px-1">
              <Zap className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" /> <span className="truncate">Blitz</span>
            </TabsTrigger>
            <TabsTrigger value="bullet" className="rounded-lg sm:rounded-xl font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1 sm:gap-2 py-1.5 sm:py-2 px-1">
              <Flame className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" /> <span className="truncate">Bullet</span>
            </TabsTrigger>
            <TabsTrigger value="classical" className="rounded-lg sm:rounded-xl font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1 sm:gap-2 py-1.5 sm:py-2 px-1">
              <Trophy className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" /> <span className="truncate">Classical</span>
            </TabsTrigger>
          </TabsList>

          <LeaderboardView timeControl={activeTab} searchQuery={searchQuery} currentUser={user} />
        </Tabs>
      )}
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

  const totalFriendsInBoard = (leaderboard?.length || 1) - 1;

  if (isLoading && !leaderboard) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2 sm:gap-4 h-32 sm:h-40 bg-muted/20 animate-pulse rounded-2xl" />
        <div className="h-48 sm:h-64 bg-muted/20 animate-pulse rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 w-full">
      {/* ── Empty Friends Prompt Banner ── */}
      {leaderboard && leaderboard.length <= 1 && (
        <Card className="border-primary/20 bg-primary/5 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <div className="font-extrabold text-sm flex items-center gap-1.5 justify-center sm:justify-start">
                <span>Add friends to build your leaderboard!</span>
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <p className="text-xs text-muted-foreground">
                Challenge fellow players to matches and see how you stack up in real-time.
              </p>
            </div>
          </div>
          <Button asChild size="sm" className="font-bold rounded-xl flex-shrink-0">
            <Link href="/friends">
              <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Find Friends
            </Link>
          </Button>
        </Card>
      )}

      {/* ── Top Winners Podium (When >= 3 entries) ── */}
      {!searchQuery && topThree.length === 3 && (
        <div className="grid grid-cols-3 gap-2 sm:gap-6 pt-2 sm:pt-4 items-end max-w-xl mx-auto w-full">
          {/* 2nd Place (Silver) */}
          <div className="flex flex-col items-center">
            <Link href={`/profile/${topThree[0].username}`} className="group flex flex-col items-center w-full">
              <div className="relative mb-1.5">
                <Avatar className="h-10 w-10 sm:h-14 sm:w-14 border-2 border-slate-300 shadow-md group-hover:scale-105 transition-transform">
                  <AvatarImage src={topThree[0].avatar || undefined} />
                  <AvatarFallback>{topThree[0].username.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 bg-slate-300 text-slate-950 text-[9px] sm:text-[10px] font-black px-1.5 py-0.2 rounded-full shadow">
                  #2
                </span>
              </div>
              <div className="text-center w-full px-0.5">
                <div className="font-extrabold text-[11px] sm:text-xs truncate max-w-[75px] sm:max-w-[110px] mx-auto group-hover:text-primary transition-colors">
                  {topThree[0].username}
                  {currentUser?.id === topThree[0].userId && <span className="text-[9px] text-primary ml-1">(You)</span>}
                </div>
                <div className="text-[10px] sm:text-xs font-mono font-bold text-slate-400">{topThree[0].rating}</div>
              </div>
            </Link>
            <div className="w-full bg-gradient-to-t from-slate-500/20 to-slate-500/5 border-t-2 border-slate-400 rounded-t-xl h-16 sm:h-24 mt-2 flex items-center justify-center font-bold text-slate-400 text-xs sm:text-sm">
              🥈 2nd
            </div>
          </div>

          {/* 1st Place (Gold) */}
          <div className="flex flex-col items-center">
            <Link href={`/profile/${topThree[1].username}`} className="group flex flex-col items-center w-full">
              <Crown className="w-4 h-4 sm:w-6 sm:h-6 text-amber-400 mb-0.5 animate-bounce" />
              <div className="relative mb-1.5">
                <Avatar className="h-14 w-14 sm:h-20 sm:w-20 border-2 sm:border-4 border-amber-400 shadow-xl ring-2 sm:ring-4 ring-amber-400/20 group-hover:scale-105 transition-transform">
                  <AvatarImage src={topThree[1].avatar || undefined} />
                  <AvatarFallback>{topThree[1].username.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 bg-amber-400 text-black text-[10px] sm:text-xs font-black px-2 py-0.2 rounded-full shadow">
                  #1
                </span>
              </div>
              <div className="text-center w-full px-0.5">
                <div className="font-extrabold text-xs sm:text-sm truncate max-w-[90px] sm:max-w-[130px] mx-auto group-hover:text-primary transition-colors">
                  {topThree[1].username}
                  {currentUser?.id === topThree[1].userId && <span className="text-[10px] text-primary ml-1">(You)</span>}
                </div>
                <div className="text-xs sm:text-sm font-mono font-black text-amber-400">{topThree[1].rating}</div>
              </div>
            </Link>
            <div className="w-full bg-gradient-to-t from-amber-500/30 to-amber-500/5 border-t-2 border-amber-400 rounded-t-xl h-22 sm:h-32 mt-2 flex items-center justify-center font-black text-amber-400 text-xs sm:text-base">
              🥇 1st
            </div>
          </div>

          {/* 3rd Place (Bronze) */}
          <div className="flex flex-col items-center">
            <Link href={`/profile/${topThree[2].username}`} className="group flex flex-col items-center w-full">
              <div className="relative mb-1.5">
                <Avatar className="h-10 w-10 sm:h-14 sm:w-14 border-2 border-amber-700 shadow-md group-hover:scale-105 transition-transform">
                  <AvatarImage src={topThree[2].avatar || undefined} />
                  <AvatarFallback>{topThree[2].username.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 bg-amber-700 text-white text-[9px] sm:text-[10px] font-black px-1.5 py-0.2 rounded-full shadow">
                  #3
                </span>
              </div>
              <div className="text-center w-full px-0.5">
                <div className="font-extrabold text-[11px] sm:text-xs truncate max-w-[75px] sm:max-w-[110px] mx-auto group-hover:text-primary transition-colors">
                  {topThree[2].username}
                  {currentUser?.id === topThree[2].userId && <span className="text-[9px] text-primary ml-1">(You)</span>}
                </div>
                <div className="text-[10px] sm:text-xs font-mono font-bold text-amber-600">{topThree[2].rating}</div>
              </div>
            </Link>
            <div className="w-full bg-gradient-to-t from-amber-800/20 to-amber-800/5 border-t-2 border-amber-700 rounded-t-xl h-14 sm:h-20 mt-2 flex items-center justify-center font-bold text-amber-600 text-xs sm:text-sm">
              🥉 3rd
            </div>
          </div>
        </div>
      )}

      {/* ── Logged-in User Rank Banner ── */}
      {userRankEntry && (
        <Card className="border-primary/30 bg-primary/5 p-3 sm:p-4 rounded-xl sm:rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <Badge variant="outline" className="font-mono font-black text-xs sm:text-sm px-2 py-0.5 sm:px-2.5 sm:py-1 border-primary/40 text-primary">
              #{userRankEntry.rank}
            </Badge>
            <div>
              <div className="font-extrabold text-xs sm:text-sm">Your Standing among Friends</div>
              <div className="text-[11px] sm:text-xs text-muted-foreground">
                Rating: <strong className="text-foreground">{userRankEntry.rating} Elo</strong> • Win Rate: <strong className="text-foreground">{userRankEntry.winRate}%</strong>
                {totalFriendsInBoard > 0 && <span> • <strong>{totalFriendsInBoard}</strong> friend{totalFriendsInBoard !== 1 ? 's' : ''} in circle</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline" className="text-[11px] sm:text-xs font-bold rounded-lg sm:rounded-xl h-8 px-2.5 sm:px-3">
              <Link href="/friends">Friends</Link>
            </Button>
            <Button asChild size="sm" variant="default" className="text-[11px] sm:text-xs font-bold rounded-lg sm:rounded-xl h-8 px-2.5 sm:px-3">
              <Link href={`/profile/${currentUser.username}`}>Profile</Link>
            </Button>
          </div>
        </Card>
      )}

      {/* ── Leaderboard Table Container ── */}
      <Card className="border-border/50 shadow-sm rounded-xl sm:rounded-2xl overflow-hidden w-full">
        <CardContent className="p-0">
          <div className="overflow-x-auto w-full max-w-full">
            <table className="w-full text-left border-collapse">
              <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] sm:text-[11px] font-extrabold">
                <tr>
                  <th className="px-3 sm:px-6 py-3 text-center w-12 sm:w-16">Rank</th>
                  <th className="px-3 sm:px-6 py-3">Player</th>
                  <th className="px-3 sm:px-6 py-3 text-right">Rating</th>
                  <th className="px-3 sm:px-6 py-3 text-right">Win Rate</th>
                  <th className="px-3 sm:px-6 py-3 text-right">Games</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-xs sm:text-sm">
                {filteredEntries.map((entry) => {
                  const isMe = currentUser?.id === entry.userId;
                  return (
                    <tr 
                      key={entry.userId} 
                      className={`hover:bg-muted/30 transition-colors ${isMe ? 'bg-primary/10 font-bold' : ''}`}
                    >
                      <td className="px-3 sm:px-6 py-3 text-center font-mono font-bold text-xs sm:text-sm">
                        {entry.rank === 1 && <span className="text-amber-400 font-extrabold">🥇 1</span>}
                        {entry.rank === 2 && <span className="text-slate-300 font-extrabold">🥈 2</span>}
                        {entry.rank === 3 && <span className="text-amber-600 font-extrabold">🥉 3</span>}
                        {entry.rank > 3 && <span className="text-muted-foreground">#{entry.rank}</span>}
                      </td>
                      <td className="px-3 sm:px-6 py-3">
                        <Link href={`/profile/${entry.username}`} className="flex items-center gap-2 sm:gap-3 hover:text-primary transition-colors">
                          <Avatar className="h-7 w-7 sm:h-8 sm:w-8 border border-border/60 flex-shrink-0">
                            <AvatarImage src={entry.avatar || undefined} />
                            <AvatarFallback className="text-[10px] sm:text-xs">{entry.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="font-extrabold text-xs sm:text-sm truncate max-w-[100px] sm:max-w-[180px]">{entry.username}</span>
                            {isMe && <Badge className="text-[9px] px-1 py-0 uppercase">You</Badge>}
                          </div>
                        </Link>
                      </td>
                      <td className="px-3 sm:px-6 py-3 text-right font-mono font-black text-xs sm:text-base text-foreground">
                        {entry.rating}
                      </td>
                      <td className="px-3 sm:px-6 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5 sm:gap-2">
                          <div className="w-12 sm:w-16 h-1.5 sm:h-2 bg-muted rounded-full overflow-hidden hidden sm:block">
                            <div 
                              className="h-full bg-emerald-500 rounded-full" 
                              style={{ width: `${entry.winRate || 0}%` }}
                            />
                          </div>
                          <span className="font-mono text-[11px] sm:text-xs font-bold text-muted-foreground">
                            {entry.winRate ? `${entry.winRate.toFixed(1)}%` : '-'}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-3 text-right font-mono text-[11px] sm:text-xs text-muted-foreground font-semibold">
                        {(entry.wins || 0) + (entry.losses || 0) + (entry.draws || 0)}
                      </td>
                    </tr>
                  );
                })}

                {filteredEntries.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 sm:py-12 text-center text-muted-foreground text-xs">
                      {searchQuery ? `No friend found matching "${searchQuery}"` : "No players in your friends leaderboard yet"}
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

