import React from 'react';
import { useGetDashboard } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Link } from 'wouter';
import { 
  Play, 
  Zap, 
  Flame, 
  Clock, 
  Crown, 
  Trophy, 
  Target, 
  Puzzle, 
  ArrowRight, 
  TrendingUp, 
  Swords, 
  Sparkles, 
  Activity,
  Bot,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

function getRankTier(rating: number) {
  if (rating >= 1800) return { name: 'Master', badge: '👑', color: '#f43f5e', text: 'text-rose-400' };
  if (rating >= 1600) return { name: 'Diamond', badge: '💠', color: '#8b5cf6', text: 'text-purple-400' };
  if (rating >= 1400) return { name: 'Platinum', badge: '💎', color: '#06b6d4', text: 'text-cyan-400' };
  if (rating >= 1200) return { name: 'Gold', badge: '🥇', color: '#f59e0b', text: 'text-amber-400' };
  if (rating >= 1000) return { name: 'Silver', badge: '🥈', color: '#94a3b8', text: 'text-slate-300' };
  return { name: 'Bronze', badge: '🥉', color: '#b45309', text: 'text-amber-600' };
}

// Circular progress ring component
function RatingCircle({
  rating,
  icon,
  label,
  badge,
  color,
  accentText,
  subLabel,
}: {
  rating: number;
  icon: React.ReactNode;
  label: string;
  badge: string;
  color: string;
  accentText: string;
  subLabel: string;
}) {
  const tier = getRankTier(rating);
  // Map rating 600–2000 to 0–100%
  const MIN = 600;
  const MAX = 2000;
  const pct = Math.min(100, Math.max(0, ((rating - MIN) / (MAX - MIN)) * 100));

  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  return (
    <Card className="relative overflow-hidden border-border/60 hover:border-primary/40 transition-all duration-300 shadow-sm hover:shadow-md group">
      <CardContent className="flex flex-col items-center justify-center gap-2 pt-5 pb-4 px-3">
        {/* SVG Circle */}
        <div className="relative w-24 h-24">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 96 96">
            {/* Background track */}
            <circle
              cx="48" cy="48" r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="7"
              className="text-muted/40"
            />
            {/* Progress arc */}
            <circle
              cx="48" cy="48" r={radius}
              fill="none"
              stroke={tier.color}
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: 'stroke-dashoffset 0.8s ease' }}
            />
          </svg>
          {/* Center icon + rating */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
            <div className="opacity-80">{icon}</div>
            <span className="text-lg font-extrabold leading-none tracking-tight">{rating}</span>
          </div>
        </div>

        {/* Label */}
        <div className="text-center space-y-0.5">
          <div className="font-bold text-sm">{label}</div>
          <div className="text-[11px] text-muted-foreground">{badge} {tier.name}</div>
          <div className="text-[10px] text-muted-foreground/60">{subLabel}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const { user, isLoading: authLoading } = useAuth();

  const [cachedDashboard, setCachedDashboard] = React.useState<any>(() => {
    try {
      const saved = localStorage.getItem('chess_cached_dashboard');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const { data: dashboard, isLoading: dashboardLoading } = useGetDashboard({
    query: {
      queryKey: ['/api/dashboard'],
      enabled: !!user
    }
  });

  React.useEffect(() => {
    if (dashboard) {
      setCachedDashboard(dashboard);
      try {
        localStorage.setItem('chess_cached_dashboard', JSON.stringify(dashboard));
      } catch { /* ignore quota errors */ }
    }
  }, [dashboard]);

  if (authLoading && !user) {
    return (
      <div className="space-y-6 animate-pulse p-2">
        <div className="h-44 bg-muted/40 rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-40 bg-muted/40 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // Guest / Unauthenticated Landing View
  if (!user) {
    return (
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-background via-muted/30 to-background border border-border/50 p-8 md:p-16 text-center space-y-8 my-4">
        {/* Glow decorative background */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-semibold animate-pulse">
          <Sparkles className="w-4 h-4" /> Next-Gen Chess Experience
        </div>

        <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-transparent max-w-4xl mx-auto leading-tight">
          Master the Game of Kings with Modern Speed &amp; Style.
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Play online opponents, challenge advanced bots, test your tactical vision with puzzles, and analyze every move in real time.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <Button asChild size="lg" className="text-base font-bold px-8 h-12 rounded-xl shadow-lg shadow-primary/20 hover:scale-105 transition-transform">
            <Link href="/register"><Play className="w-5 h-5 mr-2 fill-current" /> Join Free Now</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="text-base font-bold px-8 h-12 rounded-xl hover:bg-muted/80">
            <Link href="/login">Log In</Link>
          </Button>
        </div>

        {/* Feature Pill Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-12 max-w-4xl mx-auto">
          <div className="p-4 rounded-xl border border-border/50 bg-card/50 backdrop-blur text-center space-y-1">
            <Zap className="w-6 h-6 text-amber-400 mx-auto" />
            <div className="font-bold text-sm">Real-time SSE</div>
            <div className="text-xs text-muted-foreground">Zero move latency</div>
          </div>
          <div className="p-4 rounded-xl border border-border/50 bg-card/50 backdrop-blur text-center space-y-1">
            <Bot className="w-6 h-6 text-blue-400 mx-auto" />
            <div className="font-bold text-sm">Smart Bots</div>
            <div className="text-xs text-muted-foreground">7 Difficulty levels</div>
          </div>
          <div className="p-4 rounded-xl border border-border/50 bg-card/50 backdrop-blur text-center space-y-1">
            <Trophy className="w-6 h-6 text-emerald-400 mx-auto" />
            <div className="font-bold text-sm">Elo Rankings</div>
            <div className="text-xs text-muted-foreground">Live leaderboards</div>
          </div>
          <div className="p-4 rounded-xl border border-border/50 bg-card/50 backdrop-blur text-center space-y-1">
            <Puzzle className="w-6 h-6 text-purple-400 mx-auto" />
            <div className="font-bold text-sm">Daily Puzzles</div>
            <div className="text-xs text-muted-foreground">Build your streak</div>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated User Dashboard
  const activeDashboard = dashboard || cachedDashboard;
  const userRatings = (user as any)?.ratings;
  const defaultRatings = userRatings || { bullet: 800, blitz: 800, rapid: 800, classical: 800, puzzleRating: 800 };

  const ratings: any = activeDashboard?.ratings || defaultRatings;
  const stats = activeDashboard?.stats || { totalGames: 0, wins: 0, losses: 0, draws: 0, winRate: 0, bestRating: 800, currentStreak: 0 };

  const bestElo = Math.max(ratings.bullet, ratings.blitz, ratings.rapid, ratings.classical);
  const bestTier = getRankTier(bestElo);

  const winPercent = stats.winRate;
  const totalGames = stats.totalGames;
  const wins = stats.wins;
  const losses = stats.losses;
  const draws = stats.draws;

  const recentGames = activeDashboard?.recentGames || [];

  return (
    <div className="space-y-8 pb-12">
      {/* ── Welcome Hero Banner ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/15 via-primary/5 to-background border border-primary/20 p-6 md:p-8 shadow-xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-primary/40 shadow-md">
              <AvatarImage src={user.avatar || undefined} />
              <AvatarFallback className="bg-primary/20 text-primary font-extrabold text-xl">
                {user.username.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                  Welcome back, {user.username}!
                </h1>
                <Badge variant="outline" className={`font-bold border-primary/30 ${bestTier.text}`}>
                  {bestTier.badge} {bestTier.name}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Peak Elo: <span className="font-bold text-foreground">{bestElo}</span> • Total Games: <span className="font-bold text-foreground">{totalGames}</span>
              </p>
            </div>
          </div>

          {/* Quick Play Actions */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <Button asChild size="lg" className="flex-1 md:flex-none font-bold rounded-xl shadow-md hover:scale-105 transition-transform">
              <Link href="/play?mode=online">
                <Play className="w-4 h-4 mr-2 fill-current" /> Play Online
              </Link>
            </Button>
            <Button asChild variant="secondary" size="lg" className="flex-1 md:flex-none font-bold rounded-xl hover:bg-secondary/80">
              <Link href="/play?mode=bot">
                <Bot className="w-4 h-4 mr-2 text-blue-400" /> Play Bot
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* ── Ratings Grid ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" /> Your Ratings
          </h2>
          <span className="text-xs text-muted-foreground">Live Elo stats</span>
        </div>

        {/* 2 columns on mobile, 4 on desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <RatingCircle
            rating={ratings.rapid}
            icon={<Clock className="w-4 h-4 text-emerald-400" />}
            label="Rapid"
            badge={getRankTier(ratings.rapid).badge}
            color={getRankTier(ratings.rapid).color}
            accentText="text-emerald-400"
            subLabel="10 min"
          />
          <RatingCircle
            rating={ratings.blitz}
            icon={<Zap className="w-4 h-4 text-amber-400" />}
            label="Blitz"
            badge={getRankTier(ratings.blitz).badge}
            color={getRankTier(ratings.blitz).color}
            accentText="text-amber-400"
            subLabel="3 min"
          />
          <RatingCircle
            rating={ratings.bullet}
            icon={<Flame className="w-4 h-4 text-rose-400" />}
            label="Bullet"
            badge={getRankTier(ratings.bullet).badge}
            color={getRankTier(ratings.bullet).color}
            accentText="text-rose-400"
            subLabel="1 min"
          />
          <RatingCircle
            rating={ratings.puzzleRating}
            icon={<Puzzle className="w-4 h-4 text-purple-400" />}
            label="Puzzles"
            badge={getRankTier(ratings.puzzleRating).badge}
            color={getRankTier(ratings.puzzleRating).color}
            accentText="text-purple-400"
            subLabel={`🔥 Streak: ${stats.currentStreak}`}
          />
        </div>
      </div>

      {/* ── Win Rate Card ── */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" /> Competitive Win Rate &amp; Stats
            </CardTitle>
            <Badge variant="outline" className="font-mono text-xs font-bold">
              {totalGames} Games Played
            </Badge>
          </div>
          <CardDescription>
            Performance breakdown over all competitive matches
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Win Rate Progress & Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center bg-muted/30 p-4 rounded-xl border border-border/40">
            <div className="text-center sm:text-left space-y-1">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Win Rate</div>
              <div className="text-4xl font-black text-primary">{winPercent.toFixed(1)}%</div>
            </div>

            <div className="sm:col-span-2 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-emerald-500">{wins} Wins ({totalGames > 0 ? Math.round((wins/totalGames)*100) : 0}%)</span>
                <span className="text-slate-400">{draws} Draws</span>
                <span className="text-rose-500">{losses} Losses ({totalGames > 0 ? Math.round((losses/totalGames)*100) : 0}%)</span>
              </div>
              {/* Visual Progress Bar */}
              <div className="h-3 w-full bg-rose-500/20 rounded-full overflow-hidden flex">
                <div 
                  className="bg-emerald-500 transition-all duration-500" 
                  style={{ width: `${totalGames > 0 ? (wins/totalGames)*100 : 0}%` }} 
                />
                <div 
                  className="bg-slate-400 transition-all duration-500" 
                  style={{ width: `${totalGames > 0 ? (draws/totalGames)*100 : 0}%` }} 
                />
              </div>
            </div>
          </div>

          {/* Score Pill Badges */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-center">
              <div className="text-xs text-emerald-500 font-semibold">Victory</div>
              <div className="text-xl font-bold text-emerald-500">{wins}</div>
            </div>
            <div className="p-3 rounded-xl border border-slate-500/20 bg-slate-500/5 text-center">
              <div className="text-xs text-slate-400 font-semibold">Draw</div>
              <div className="text-xl font-bold text-slate-300">{draws}</div>
            </div>
            <div className="p-3 rounded-xl border border-rose-500/20 bg-rose-500/5 text-center">
              <div className="text-xs text-rose-500 font-semibold">Defeat</div>
              <div className="text-xl font-bold text-rose-500">{losses}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Recent Games List ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" /> Recent Matches
          </h2>
          <Button asChild variant="ghost" size="sm" className="text-xs font-semibold">
            <Link href="/profile">View All Games <ArrowRight className="w-3 h-3 ml-1" /></Link>
          </Button>
        </div>

        {dashboardLoading && !activeDashboard ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-16 bg-muted/30 rounded-xl" />
            <div className="h-16 bg-muted/30 rounded-xl" />
          </div>
        ) : recentGames.length === 0 ? (
          <Card className="p-8 text-center space-y-3 border-dashed">
            <Swords className="w-8 h-8 mx-auto text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No recent games played yet.</p>
            <Button asChild size="sm" className="font-semibold">
              <Link href="/play?mode=online">Play First Match</Link>
            </Button>
          </Card>
        ) : (
          <div className="space-y-2">
            {recentGames.map((game: any) => {
              const isWhite = game.whitePlayer?.id === user.id;
              const opponent = isWhite ? game.blackPlayer : game.whitePlayer;
              const opponentName = opponent?.username || (game.mode === 'bot' ? 'ChessBot' : 'Opponent');

              let isWin = false;
              let isDrawGame = game.result === 'draw';
              if (!isDrawGame) {
                isWin = (game.result === 'white' && isWhite) || (game.result === 'black' && !isWhite);
              }

              return (
                <Card key={game.id} className="p-4 flex items-center justify-between hover:bg-muted/40 transition-colors border-border/60">
                  <div className="flex items-center gap-4">
                    {/* Outcome Badge */}
                    <div className="flex-shrink-0">
                      {isDrawGame ? (
                        <div className="w-9 h-9 rounded-full bg-slate-500/20 text-slate-400 flex items-center justify-center font-extrabold text-xs">
                          D
                        </div>
                      ) : isWin ? (
                        <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center font-extrabold text-xs">
                          W
                        </div>
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center font-extrabold text-xs">
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
                      {new Date(game.createdAt).toLocaleDateString()}
                    </span>
                    <Button asChild size="sm" variant="outline" className="h-8 text-xs font-semibold rounded-lg">
                      <Link href={`/game/${game.id}`}>Analyze</Link>
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
