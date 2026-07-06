import React from 'react';
import { useGetDashboard } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { Loader2, Play, Users, Trophy, Target } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function Home() {
  const { user, isLoading: authLoading } = useAuth();
  const { data: dashboard, isLoading: dashboardLoading } = useGetDashboard({
    query: {
      enabled: !!user
    }
  });

  if (authLoading || dashboardLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
          Master the Game.
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-[600px]">
          Join ChessHub to play, learn, and compete. Experience the premium chess platform for serious players.
        </p>
        <div className="flex gap-4">
          <Button asChild size="lg" className="text-lg px-8">
            <Link href="/register">Sign Up</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="text-lg px-8">
            <Link href="/login">Log In</Link>
          </Button>
        </div>
      </div>
    );
  }


  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Quick Play Card */}
        <Card className="col-span-1 md:col-span-2 lg:col-span-4 bg-primary/5 border-primary/20">
          <CardContent className="flex flex-col sm:flex-row items-center justify-between p-6">
            <div className="space-y-2 mb-4 sm:mb-0">
              <h2 className="text-2xl font-bold">Ready for a game?</h2>
              <p className="text-muted-foreground">Find an opponent or challenge a bot.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="lg">
                <Link href="/play?mode=online"><Play className="mr-2 h-4 w-4" /> Play Online</Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="/play?mode=bot">Play Bot</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Ratings */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rapid Rating</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.ratings?.rapid ?? 800}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blitz Rating</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.ratings?.blitz ?? 800}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bullet Rating</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.ratings?.bullet ?? 800}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(dashboard?.stats?.winRate || 0).toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Over {dashboard?.stats?.totalGames || 0} games</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Add more sections for recent games, puzzles, friends */}
    </div>
  );
}
