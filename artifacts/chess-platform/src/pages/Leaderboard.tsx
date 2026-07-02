import React from 'react';
import { useGetLeaderboard } from '@workspace/api-client-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Link } from 'wouter';
import { Trophy, Loader2 } from 'lucide-react';

export default function Leaderboard() {
  return (
    <div className="max-w-5xl mx-auto py-8">
      <div className="flex items-center gap-3 mb-8">
        <Trophy className="h-8 w-8 text-yellow-500" />
        <h1 className="text-3xl font-bold">Global Leaderboard</h1>
      </div>

      <Tabs defaultValue="rapid" className="w-full">
        <TabsList className="w-full justify-start mb-6">
          <TabsTrigger value="bullet">Bullet</TabsTrigger>
          <TabsTrigger value="blitz">Blitz</TabsTrigger>
          <TabsTrigger value="rapid">Rapid</TabsTrigger>
          <TabsTrigger value="classical">Classical</TabsTrigger>
        </TabsList>

        {['bullet', 'blitz', 'rapid', 'classical'].map((timeControl) => (
          <TabsContent key={timeControl} value={timeControl}>
            <LeaderboardTable timeControl={timeControl as any} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function LeaderboardTable({ timeControl }: { timeControl: 'bullet' | 'blitz' | 'rapid' | 'classical' }) {
  const { data: leaderboard, isLoading } = useGetLeaderboard({ timeControl, limit: 50 });

  if (isLoading) {
    return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <Card>
      <CardContent className="p-0">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground uppercase">
            <tr>
              <th className="px-6 py-4 rounded-tl-lg w-16 text-center">Rank</th>
              <th className="px-6 py-4">Player</th>
              <th className="px-6 py-4 text-right">Rating</th>
              <th className="px-6 py-4 text-right rounded-tr-lg">Win Rate</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard?.map((entry) => (
              <tr key={entry.userId} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4 text-center font-medium">
                  {entry.rank === 1 && <span className="text-yellow-500">1</span>}
                  {entry.rank === 2 && <span className="text-gray-400">2</span>}
                  {entry.rank === 3 && <span className="text-amber-600">3</span>}
                  {entry.rank > 3 && <span className="text-muted-foreground">{entry.rank}</span>}
                </td>
                <td className="px-6 py-4">
                  <Link href={`/profile/${entry.username}`} className="flex items-center gap-3 hover:text-primary transition-colors">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={entry.avatar || undefined} />
                      <AvatarFallback>{entry.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="font-semibold">{entry.username}</span>
                  </Link>
                </td>
                <td className="px-6 py-4 text-right font-bold text-lg">
                  {entry.rating}
                </td>
                <td className="px-6 py-4 text-right text-muted-foreground">
                  {entry.winRate ? `${entry.winRate.toFixed(1)}%` : '-'}
                </td>
              </tr>
            ))}
            {!leaderboard?.length && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                  No players found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
