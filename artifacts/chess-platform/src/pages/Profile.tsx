import React from 'react';
import { useGetUserProfile, useGetUserStats } from '@workspace/api-client-react';
import { useParams, Link } from 'wouter';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Loader2, 
  CalendarDays, 
  Flag, 
  Trophy, 
  Target, 
  Zap, 
  Flame, 
  Clock, 
  Crown, 
  Swords, 
  User, 
  Settings as SettingsIcon,
  ArrowRight,
  Sparkles,
  ShieldAlert
} from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/context/AuthContext';

function getRankTier(rating: number) {
  if (rating >= 1800) return { name: 'Master', badge: '👑', color: '#f43f5e', text: 'text-rose-400' };
  if (rating >= 1600) return { name: 'Diamond', badge: '💠', color: '#8b5cf6', text: 'text-purple-400' };
  if (rating >= 1400) return { name: 'Platinum', badge: '💎', color: '#06b6d4', text: 'text-cyan-400' };
  if (rating >= 1200) return { name: 'Gold', badge: '🥇', color: '#f59e0b', text: 'text-amber-400' };
  if (rating >= 1000) return { name: 'Silver', badge: '🥈', color: '#94a3b8', text: 'text-slate-300' };
  return { name: 'Bronze', badge: '🥉', color: '#b45309', text: 'text-amber-600' };
}

export default function Profile() {
  const { username } = useParams<{ username: string }>();
  const { user: currentUser } = useAuth();
  
  const { data: profile, isLoading: isProfileLoading } = useGetUserProfile(username);
  const { data: stats, isLoading: isStatsLoading } = useGetUserStats(username);

  const isMe = currentUser?.username === username;

  if (isProfileLoading || isStatsLoading) {
    return (
      <div className="max-w-5xl mx-auto py-12 px-4 space-y-6 animate-pulse">
        <div className="h-48 bg-muted/40 rounded-3xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-muted/40 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <ShieldAlert className="w-16 h-16 text-muted-foreground/50" />
        <h1 className="text-2xl font-bold">User Not Found</h1>
        <p className="text-muted-foreground">The player @{username} does not exist or has been removed.</p>
        <Button asChild><Link href="/">Back to Home</Link></Button>
      </div>
    );
  }

  const ratings = profile.ratings || { bullet: 800, blitz: 800, rapid: 800, classical: 800 };
  const bestElo = Math.max(ratings.bullet, ratings.blitz, ratings.rapid, ratings.classical);
  const bestTier = getRankTier(bestElo);

  const totalGames = stats?.totalGames ?? 0;
  const wins = stats?.wins ?? 0;
  const losses = stats?.losses ?? 0;
  const draws = stats?.draws ?? 0;
  const winRate = stats?.winRate ?? 0;

  return (
    <div className="max-w-5xl mx-auto py-6 space-y-8 pb-16">
      {/* ── Profile Hero Card ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-card via-muted/30 to-card border border-border/60 p-6 md:p-10 shadow-xl">
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-primary/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-6 relative z-10 text-center md:text-left">
          <div className="flex flex-col md:flex-row items-center gap-6">
            {/* Avatar with Glow Ring */}
            <div className="relative group">
              <Avatar className="h-28 w-28 border-4 border-background shadow-2xl ring-4 ring-primary/20">
                <AvatarImage src={profile.avatar || undefined} alt={profile.username} />
                <AvatarFallback className="text-3xl font-black bg-primary/20 text-primary">
                  {profile.username.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-green-500 border-4 border-background shadow" />
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                <h1 className="text-3xl md:text-4xl font-black tracking-tight">{profile.username}</h1>
                <Badge variant="outline" className={`font-bold border-primary/30 text-sm px-3 py-1 ${bestTier.text}`}>
                  {bestTier.badge} {bestTier.name}
                </Badge>
              </div>

              {/* Bio */}
              {profile.bio && (
                <p className="text-muted-foreground text-sm max-w-lg leading-relaxed">
                  {profile.bio}
                </p>
              )}

              {/* Meta details */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs font-semibold text-muted-foreground pt-1">
                {profile.country && (
                  <span className="flex items-center gap-1 bg-muted/60 px-3 py-1 rounded-full border border-border/40">
                    <Flag className="h-3.5 w-3.5 text-primary" /> {profile.country}
                  </span>
                )}
                <span className="flex items-center gap-1 bg-muted/60 px-3 py-1 rounded-full border border-border/40">
                  <CalendarDays className="h-3.5 w-3.5 text-primary" /> Joined {format(new Date(profile.createdAt), 'MMM yyyy')}
                </span>
                <span className="flex items-center gap-1 bg-muted/60 px-3 py-1 rounded-full border border-border/40">
                  <Trophy className="h-3.5 w-3.5 text-amber-400" /> Peak Elo: {bestElo}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            {isMe ? (
              <Button asChild variant="outline" className="font-bold rounded-xl shadow-sm hover:bg-muted/80">
                <Link href="/settings">
                  <SettingsIcon className="w-4 h-4 mr-2" /> Edit Profile
                </Link>
              </Button>
            ) : (
              <Button asChild className="font-bold rounded-xl shadow-md hover:scale-105 transition-transform">
                <Link href={`/play?invite=${profile.id}`}>
                  <Swords className="w-4 h-4 mr-2" /> Challenge Player
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Ratings Grid ── */}
      <div className="space-y-4">
        <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-400" /> Rating Breakdown
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Rapid', rating: ratings.rapid, icon: Clock, color: 'text-emerald-400', sub: '10 min' },
            { label: 'Blitz', rating: ratings.blitz, icon: Zap, color: 'text-amber-400', sub: '3 min' },
            { label: 'Bullet', rating: ratings.bullet, icon: Flame, color: 'text-rose-400', sub: '1 min' },
            { label: 'Classical', rating: ratings.classical, icon: Crown, color: 'text-purple-400', sub: '60 min' }
          ].map(r => {
            const tier = getRankTier(r.rating);
            const Icon = r.icon;
            return (
              <Card key={r.label} className="border-border/60 hover:border-primary/40 transition-all duration-300 shadow-sm hover:shadow-md">
                <CardContent className="p-5 flex flex-col items-center text-center space-y-2">
                  <div className="p-3 rounded-full bg-primary/10">
                    <Icon className={`w-6 h-6 ${r.color}`} />
                  </div>
                  <div>
                    <div className="text-3xl font-black">{r.rating}</div>
                    <div className="text-xs font-bold text-foreground mt-0.5">{r.label}</div>
                    <div className="text-[11px] text-muted-foreground font-medium">{tier.badge} {tier.name}</div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ── Statistics Card ── */}
      {stats && (
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" /> Career Match Statistics
              </CardTitle>
              <Badge variant="outline" className="font-mono text-xs font-bold">
                {totalGames} Total Matches
              </Badge>
            </div>
            <CardDescription>Overall performance in competitive rated games</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center bg-muted/30 p-5 rounded-2xl border border-border/40">
              <div className="text-center sm:text-left space-y-1">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Win Rate</div>
                <div className="text-4xl font-black text-primary">{winRate.toFixed(1)}%</div>
              </div>

              <div className="sm:col-span-2 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-emerald-500">{wins} Wins ({totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0}%)</span>
                  <span className="text-slate-400">{draws} Draws</span>
                  <span className="text-rose-500">{losses} Losses ({totalGames > 0 ? Math.round((losses / totalGames) * 100) : 0}%)</span>
                </div>
                {/* Visual Progress Bar */}
                <div className="h-3.5 w-full bg-rose-500/20 rounded-full overflow-hidden flex">
                  <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${totalGames > 0 ? (wins / totalGames) * 100 : 0}%` }} />
                  <div className="bg-slate-400 transition-all duration-500" style={{ width: `${totalGames > 0 ? (draws / totalGames) * 100 : 0}%` }} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-center">
                <div className="text-xs text-emerald-500 font-semibold">Victories</div>
                <div className="text-2xl font-bold text-emerald-500">{wins}</div>
              </div>
              <div className="p-3.5 rounded-xl border border-slate-500/20 bg-slate-500/5 text-center">
                <div className="text-xs text-slate-400 font-semibold">Draws</div>
                <div className="text-2xl font-bold text-slate-300">{draws}</div>
              </div>
              <div className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/5 text-center">
                <div className="text-xs text-rose-500 font-semibold">Defeats</div>
                <div className="text-2xl font-bold text-rose-500">{losses}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Recent Games List ── */}
      <div className="space-y-4">
        <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
          <Swords className="w-5 h-5 text-primary" /> Recent Matches
        </h2>

        {profile.recentGames && profile.recentGames.length > 0 ? (
          <div className="space-y-3">
            {profile.recentGames.map((game: any) => {
              const isWhite = game.whitePlayer?.username === profile.username;
              const opponent = isWhite ? game.blackPlayer : game.whitePlayer;
              const opponentName = opponent?.username || (game.mode === 'bot' ? 'ChessBot' : 'Opponent');

              let isWin = false;
              let isDrawGame = game.result === 'draw';
              if (!isDrawGame) {
                isWin = (game.result === 'white' && isWhite) || (game.result === 'black' && !isWhite);
              }

              return (
                <Card key={game.id} className="p-4 flex items-center justify-between hover:bg-muted/40 transition-colors border-border/60 shadow-sm">
                  <div className="flex items-center gap-4">
                    {/* Outcome Badge */}
                    <div className="flex-shrink-0">
                      {isDrawGame ? (
                        <div className="w-10 h-10 rounded-full bg-slate-500/20 text-slate-400 flex items-center justify-center font-black text-sm">
                          D
                        </div>
                      ) : isWin ? (
                        <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center font-black text-sm">
                          W
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center font-black text-sm">
                          L
                        </div>
                      )}
                    </div>

                    {/* Match Details */}
                    <div>
                      <div className="font-bold text-sm flex items-center gap-2">
                        <span>vs {opponentName}</span>
                        <Badge variant="outline" className="text-[10px] uppercase font-mono px-1.5 py-0">
                          {game.timeControl}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {game.mode} match • {game.resultReason || game.status}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      {format(new Date(game.createdAt), 'MMM d, yyyy')}
                    </span>
                    <Button asChild size="sm" variant="outline" className="h-8 text-xs font-semibold rounded-lg">
                      <Link href={`/game/${game.id}`}>Analyze <ArrowRight className="w-3 h-3 ml-1" /></Link>
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-10 text-center space-y-3 border-dashed">
            <Swords className="w-10 h-10 mx-auto text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No recent matches played yet.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
