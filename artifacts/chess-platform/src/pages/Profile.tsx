import React from 'react';
import { useGetUserProfile, useGetUserStats } from '@workspace/api-client-react';
import { useParams } from 'wouter';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, CalendarDays, Flag, Trophy, Target } from 'lucide-react';
import { format } from 'date-fns';

export default function Profile() {
  const { username } = useParams<{ username: string }>();
  
  const { data: profile, isLoading: isProfileLoading } = useGetUserProfile(username);
  const { data: stats, isLoading: isStatsLoading } = useGetUserStats(username);

  if (isProfileLoading || isStatsLoading) {
    return <div className="flex justify-center p-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!profile) {
    return <div className="text-center p-24 text-xl">User not found</div>;
  }

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row gap-8 items-start">
        <Avatar className="h-32 w-32 border-4 border-background shadow-lg">
          <AvatarImage src={profile.avatar || undefined} />
          <AvatarFallback className="text-4xl">{profile.username.substring(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="space-y-4 flex-1">
          <div>
            <h1 className="text-4xl font-bold">{profile.username}</h1>
            <div className="flex items-center gap-4 text-muted-foreground mt-2">
              {profile.country && (
                <span className="flex items-center gap-1"><Flag className="h-4 w-4" /> {profile.country}</span>
              )}
              <span className="flex items-center gap-1"><CalendarDays className="h-4 w-4" /> Joined {format(new Date(profile.createdAt), 'MMM yyyy')}</span>
            </div>
          </div>
          {profile.bio && <p className="text-lg">{profile.bio}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Ratings Column */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ratings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-2"><Trophy className="h-4 w-4" /> Rapid</span>
                <span className="font-bold text-xl">{profile.ratings.rapid}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-2"><Target className="h-4 w-4" /> Blitz</span>
                <span className="font-bold text-xl">{profile.ratings.blitz}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-2"><Trophy className="h-4 w-4" /> Bullet</span>
                <span className="font-bold text-xl">{profile.ratings.bullet}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-2"><Trophy className="h-4 w-4" /> Classical</span>
                <span className="font-bold text-xl">{profile.ratings.classical}</span>
              </div>
            </CardContent>
          </Card>

          {stats && (
            <Card>
              <CardHeader>
                <CardTitle>Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Total Games</span>
                  <span className="font-bold">{stats.totalGames}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Win Rate</span>
                  <span className="font-bold">{stats.winRate.toFixed(1)}%</span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden flex">
                  <div className="bg-green-500 h-full" style={{ width: `${(stats.wins / Math.max(1, stats.totalGames)) * 100}%` }} />
                  <div className="bg-gray-400 h-full" style={{ width: `${(stats.draws / Math.max(1, stats.totalGames)) * 100}%` }} />
                  <div className="bg-red-500 h-full" style={{ width: `${(stats.losses / Math.max(1, stats.totalGames)) * 100}%` }} />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{stats.wins} W</span>
                  <span>{stats.draws} D</span>
                  <span>{stats.losses} L</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Recent Games Column */}
        <div className="md:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Recent Games</CardTitle>
            </CardHeader>
            <CardContent>
              {profile.recentGames && profile.recentGames.length > 0 ? (
                <div className="space-y-4">
                  {profile.recentGames.map(game => (
                    <div key={game.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                      <div className="flex items-center gap-4">
                        <div className={`w-3 h-12 rounded-full ${game.resultReason === 'won' ? 'bg-green-500' : game.resultReason === 'lost' ? 'bg-red-500' : 'bg-gray-400'}`} />
                        <div>
                          <div className="font-semibold capitalize">{game.timeControl} • {game.mode}</div>
                          <div className="text-sm text-muted-foreground">{format(new Date(game.createdAt), 'MMM d, yyyy')}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{game.result || 'Ongoing'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No recent games
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
