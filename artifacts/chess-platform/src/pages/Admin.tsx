import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Users, Gamepad2, Trophy, Sword, Trash2, ShieldCheck, ShieldOff, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

function useAdminQuery<T>(path: string) {
  const token = localStorage.getItem('chess_token');
  return useQuery<T>({
    queryKey: ['admin', path],
    queryFn: async () => {
      const res = await fetch(`/api/${path}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });
}

function useAdminMutation(method: string, path: string) {
  const token = localStorage.getItem('chess_token');
  return useMutation({
    mutationFn: async (body?: unknown) => {
      const res = await fetch(`/api/${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed');
      }
      return res.json();
    },
  });
}

interface Stats {
  totalUsers: number;
  totalGames: number;
  activeGames: number;
  finishedGames: number;
  totalMoves: number;
  totalPuzzles: number;
  onlineUsers: number;
  recentGames: any[];
}

interface UserEntry {
  id: number;
  username: string;
  email: string;
  role: string;
  isGuest: boolean;
  isOnline: boolean;
  avatar: string | null;
  country: string | null;
  createdAt: string;
  ratings: { bullet: number; blitz: number; rapid: number; classical: number } | null;
  gamesPlayed: number;
}

interface GameEntry {
  id: number;
  status: string;
  result: string | null;
  resultReason: string | null;
  mode: string;
  timeControl: string;
  botLevel: string | null;
  whitePlayer: { id: number; username: string } | null;
  blackPlayer: { id: number; username: string } | null;
  createdAt: string;
}

export default function Admin() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: stats, isLoading: isStatsLoading } = useAdminQuery<Stats>('admin/stats');
  const { data: usersData, isLoading: isUsersLoading } = useAdminQuery<{ users: UserEntry[]; total: number }>('admin/users');
  const { data: gamesData, isLoading: isGamesLoading } = useAdminQuery<{ games: GameEntry[]; total: number }>('admin/games');

  const token = localStorage.getItem('chess_token');

  const changeRole = useMutation({
    mutationFn: async ({ id, role }: { id: number; role: string }) => {
      const res = await fetch(`/api/admin/users/${id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      toast({ title: 'Role updated' });
    },
    onError: (err: Error) => toast({ title: err.message, variant: 'destructive' }),
  });

  const deleteUser = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      toast({ title: 'User deleted' });
    },
    onError: (err: Error) => toast({ title: err.message, variant: 'destructive' }),
  });

  if (isAuthLoading) {
    return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!user) {
    setLocation('/login');
    return null;
  }

  if (user.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <ShieldOff className="h-16 w-16 text-destructive" />
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground">You need admin privileges to view this page.</p>
        <Button onClick={() => setLocation('/')}>Go Home</Button>
      </div>
    );
  }

  const statCards = [
    { label: 'Total Users', value: stats?.totalUsers, icon: Users, color: 'text-blue-500' },
    { label: 'Total Games', value: stats?.totalGames, icon: Gamepad2, color: 'text-green-500' },
    { label: 'Active Games', value: stats?.activeGames, icon: Activity, color: 'text-yellow-500' },
    { label: 'Total Puzzles', value: stats?.totalPuzzles, icon: Trophy, color: 'text-purple-500' },
    { label: 'Total Moves', value: stats?.totalMoves, icon: Sword, color: 'text-orange-500' },
    { label: 'Online Now', value: stats?.onlineUsers, icon: Users, color: 'text-emerald-500' },
  ];

  return (
    <div className="space-y-8 py-4">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Admin Panel</h1>
          <p className="text-muted-foreground text-sm">Manage users, games, and platform settings</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-4 flex flex-col items-center text-center gap-1">
              <Icon className={`h-6 w-6 ${color} mb-1`} />
              {isStatsLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <div className="text-2xl font-bold">{value?.toLocaleString() ?? 0}</div>
              )}
              <div className="text-xs text-muted-foreground">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="games">Games</TabsTrigger>
          <TabsTrigger value="recent">Recent Activity</TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>All Users ({usersData?.total ?? 0})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isUsersLoading ? (
                <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 text-left">User</th>
                        <th className="px-4 py-3 text-left">Email</th>
                        <th className="px-4 py-3 text-center">Role</th>
                        <th className="px-4 py-3 text-center">Games</th>
                        <th className="px-4 py-3 text-center">Rapid</th>
                        <th className="px-4 py-3 text-center">Joined</th>
                        <th className="px-4 py-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usersData?.users.map(u => (
                        <tr key={u.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="relative">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={u.avatar || undefined} />
                                  <AvatarFallback className="text-xs">{u.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-background ${u.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                              </div>
                              <span className="font-medium">{u.username}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{u.email}</td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                              {u.role}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-center">{u.gamesPlayed}</td>
                          <td className="px-4 py-3 text-center font-medium">{u.ratings?.rapid ?? 800}</td>
                          <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                            {format(new Date(u.createdAt), 'MMM d, yyyy')}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              {u.role !== 'admin' ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() => changeRole.mutate({ id: u.id, role: 'admin' })}
                                  disabled={changeRole.isPending}
                                >
                                  <ShieldCheck className="h-3 w-3 mr-1" /> Make Admin
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() => changeRole.mutate({ id: u.id, role: 'user' })}
                                  disabled={changeRole.isPending || u.id === user.id}
                                >
                                  <ShieldOff className="h-3 w-3 mr-1" /> Demote
                                </Button>
                              )}
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                onClick={() => {
                                  if (confirm(`Delete user ${u.username}?`)) deleteUser.mutate(u.id);
                                }}
                                disabled={deleteUser.isPending || u.id === user.id}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Games Tab */}
        <TabsContent value="games" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>All Games ({gamesData?.total ?? 0})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isGamesLoading ? (
                <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 text-left">ID</th>
                        <th className="px-4 py-3 text-left">White</th>
                        <th className="px-4 py-3 text-left">Black</th>
                        <th className="px-4 py-3 text-center">Mode</th>
                        <th className="px-4 py-3 text-center">Time</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-center">Result</th>
                        <th className="px-4 py-3 text-center">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gamesData?.games.map(g => (
                        <tr key={g.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs">#{g.id}</td>
                          <td className="px-4 py-3 font-medium">{g.whitePlayer?.username ?? '—'}</td>
                          <td className="px-4 py-3 font-medium">{g.blackPlayer?.username ?? '—'}</td>
                          <td className="px-4 py-3 text-center capitalize">
                            <Badge variant="outline">{g.mode}</Badge>
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-muted-foreground">{g.timeControl}</td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant={g.status === 'active' ? 'default' : g.status === 'finished' ? 'secondary' : 'outline'}>
                              {g.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-center capitalize text-muted-foreground text-xs">
                            {g.result ?? '—'} {g.resultReason ? `(${g.resultReason})` : ''}
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                            {format(new Date(g.createdAt), 'MMM d, HH:mm')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recent Activity Tab */}
        <TabsContent value="recent" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Games</CardTitle>
            </CardHeader>
            <CardContent>
              {isStatsLoading ? (
                <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
              ) : (
                <div className="space-y-3">
                  {stats?.recentGames.map(g => (
                    <div key={g.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/10">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-8 rounded-full ${g.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`} />
                        <div>
                          <div className="font-semibold text-sm">
                            {g.whitePlayer?.username ?? 'Unknown'} <span className="text-muted-foreground">vs</span> {g.blackPlayer?.username ?? 'Unknown'}
                          </div>
                          <div className="text-xs text-muted-foreground capitalize">
                            {g.mode} · {g.timeControl}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={g.status === 'active' ? 'default' : 'secondary'} className="mb-1">
                          {g.status}
                        </Badge>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(g.createdAt), 'MMM d, HH:mm')}
                        </div>
                      </div>
                    </div>
                  ))}
                  {!stats?.recentGames.length && (
                    <div className="text-center py-8 text-muted-foreground">No recent games</div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
