import React, { useState } from 'react';
import { 
  useGetFriends, 
  useGetFriendRequests, 
  useSendFriendRequest, 
  useAcceptFriendRequest, 
  useDeclineFriendRequest, 
  getBaseUrl 
} from '@workspace/api-client-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, UserPlus, Check, X, Clock, Swords, UserCheck, Shield, Sparkles, MessageSquare, Search } from 'lucide-react';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/context/AuthContext';

export default function Friends() {
  const { token, user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Queries with staleTime: 30s to make page navigation instant (0ms delay)
  const { data: friends, isLoading: isFriendsLoading } = useGetFriends({ 
    query: { 
      queryKey: ['/api/friends'], 
      staleTime: 30_000, 
      refetchInterval: 30_000,
      refetchOnWindowFocus: true,
    } 
  });

  const { data: requests, isLoading: isRequestsLoading } = useGetFriendRequests({
    query: {
      queryKey: ['/api/friends/requests'],
      staleTime: 30_000,
      refetchInterval: 30_000,
    }
  });
  
  const { data: sentRequests } = useQuery({
    queryKey: ['sentFriendRequests'],
    queryFn: async () => {
      const base = getBaseUrl().replace(/\/$/, '');
      const res = await fetch(`${base}/api/friends/requests/sent`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch sent requests');
      return res.json();
    },
    enabled: !!token,
    staleTime: 30_000,
  });

  const cancelRequest = useMutation({
    mutationFn: async (id: number) => {
      const base = getBaseUrl().replace(/\/$/, '');
      const res = await fetch(`${base}/api/friends/requests/${id}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to cancel');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sentFriendRequests'] });
      toast({ title: 'Friend request cancelled' });
    }
  });

  const sendRequest = useSendFriendRequest();
  const acceptRequest = useAcceptFriendRequest();
  const declineRequest = useDeclineFriendRequest();

  const [searchFriend, setSearchFriend] = useState('');
  const [username, setUsername] = useState('');

  const handleSendRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    sendRequest.mutate({ data: { username: username.trim() } }, {
      onSuccess: (data: any) => {
        if (data?.message === "Friend request accepted") {
          toast({ title: "Friend added!", description: `You are now friends with ${username}` });
          queryClient.invalidateQueries();
        } else {
          toast({ title: "Friend request sent!" });
        }
        setUsername('');
        queryClient.invalidateQueries({ queryKey: ['sentFriendRequests'] });
      },
      onError: (err: any) => {
        toast({ 
          title: "Could not send request", 
          description: err.response?.data?.error || err.message,
          variant: "destructive" 
        });
      }
    });
  };

  const filteredFriends = React.useMemo(() => {
    if (!friends) return [];
    if (!searchFriend.trim()) return friends;
    return friends.filter(f => f.username.toLowerCase().includes(searchFriend.toLowerCase().trim()));
  }, [friends, searchFriend]);

  const onlineFriendsCount = friends?.filter(f => f.isOnline).length || 0;

  return (
    <div className="max-w-5xl mx-auto py-6 md:py-10 px-4 space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
            <UserCheck className="w-3.5 h-3.5" /> Community Hub
          </div>
          <h1 className="text-3xl font-black tracking-tight">Friends</h1>
          <p className="text-xs text-muted-foreground">Connect, challenge, and play with your chess friends</p>
        </div>

        {/* Quick Stats Pill */}
        {friends && (
          <div className="flex items-center gap-3 bg-card/60 p-2.5 rounded-xl border border-border/50 text-xs font-semibold">
            <div className="flex items-center gap-1.5 text-emerald-500">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>{onlineFriendsCount} Online</span>
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="text-muted-foreground">{friends.length} Total Friends</div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* ── Left Column: Add Friend & Requests ── */}
        <div className="space-y-6 md:col-span-1">
          {/* Add Friend Card */}
          <Card className="border-border/50 shadow-sm rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-extrabold flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-primary" /> Add Friend
              </CardTitle>
              <CardDescription className="text-xs">
                Enter your friend&apos;s username to send an invite.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSendRequest} className="space-y-3">
                <Input 
                  placeholder="Username..." 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="rounded-xl text-base sm:text-xs"
                />
                <Button 
                  type="submit" 
                  disabled={sendRequest.isPending || !username.trim()}
                  className="w-full h-10 text-xs font-bold rounded-xl"
                >
                  {sendRequest.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
                  Send Invite
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Pending Incoming Requests */}
          {requests && requests.length > 0 && (
            <Card className="border-emerald-500/30 bg-emerald-500/5 shadow-sm rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-extrabold flex items-center justify-between text-emerald-400">
                  <span>Pending Requests</span>
                  <Badge className="bg-emerald-500 text-black text-[10px] font-bold">{requests.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {requests.map((req) => (
                  <div key={req.id} className="flex items-center justify-between p-2 rounded-xl bg-card border border-border/40">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={req.fromUser?.avatar || undefined} />
                        <AvatarFallback>{req.fromUser?.username?.substring(0,2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="font-extrabold text-xs truncate">{req.fromUser?.username}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button 
                        size="icon" 
                        variant="default" 
                        className="h-8 w-8 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-black" 
                        onClick={() => acceptRequest.mutate({ id: req.id }, { onSuccess: () => queryClient.invalidateQueries() })}
                        title="Accept"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="outline" 
                        className="h-8 w-8 rounded-lg text-rose-500 border-rose-500/30 hover:bg-rose-500/10" 
                        onClick={() => declineRequest.mutate({ id: req.id }, { onSuccess: () => queryClient.invalidateQueries() })}
                        title="Decline"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Sent Pending Requests */}
          {sentRequests && sentRequests.length > 0 && (
            <Card className="border-border/50 shadow-sm rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-extrabold text-muted-foreground flex items-center justify-between">
                  <span>Sent Requests</span>
                  <Badge variant="outline" className="text-[10px] font-mono">{sentRequests.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {sentRequests.map((req: any) => (
                  <div key={req.id} className="flex items-center justify-between p-2 rounded-xl bg-muted/20">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={req.toUser?.avatar || undefined} />
                        <AvatarFallback>{req.toUser?.username?.substring(0,2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="truncate">
                        <span className="font-bold text-xs block truncate">{req.toUser?.username}</span>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" /> Pending
                        </span>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-7 text-[11px] font-semibold text-rose-400 hover:text-rose-500 hover:bg-rose-500/10" 
                      onClick={() => cancelRequest.mutate(req.id)}
                      disabled={cancelRequest.isPending}
                    >
                      Cancel
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Right Column: Friends List ── */}
        <div className="md:col-span-2 space-y-4">
          <Card className="border-border/50 shadow-sm rounded-2xl">
            <CardHeader className="pb-4 border-b border-border/40">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <CardTitle className="text-base font-extrabold flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-primary" /> Your Friends List
                </CardTitle>

                {/* Filter input */}
                {friends && friends.length > 5 && (
                  <div className="relative w-full sm:w-48">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Filter friends..."
                      value={searchFriend}
                      onChange={(e) => setSearchFriend(e.target.value)}
                      className="pl-8 h-8 rounded-lg text-base sm:text-xs"
                    />
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-3">
              {isFriendsLoading && !friends ? (
                <div className="space-y-3 py-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-14 bg-muted/20 animate-pulse rounded-xl" />
                  ))}
                </div>
              ) : filteredFriends && filteredFriends.length > 0 ? (
                <div className="space-y-2.5">
                  {filteredFriends.map((friend) => (
                    <div 
                      key={friend.id} 
                      className="p-3.5 rounded-xl border border-border/40 bg-card hover:bg-muted/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <Link href={`/profile/${friend.username}`} className="flex items-center gap-3 group">
                        <div className="relative">
                          <Avatar className="h-10 w-10 border border-border/60 group-hover:scale-105 transition-transform">
                            <AvatarImage src={friend.avatar || undefined} />
                            <AvatarFallback>{friend.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span 
                            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background ${
                              friend.isOnline ? 'bg-emerald-500' : 'bg-slate-400'
                            }`}
                            title={friend.isOnline ? 'Online' : 'Offline'}
                          />
                        </div>

                        <div>
                          <div className="font-extrabold text-sm flex items-center gap-2 group-hover:text-primary transition-colors">
                            <span>{friend.username}</span>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              friend.isOnline ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'text-muted-foreground'
                            }`}>
                              {friend.isOnline ? 'Online' : 'Offline'}
                            </span>
                          </div>
                          {friend.ratings && (
                            <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5 font-mono">
                              <span>⚡ {friend.ratings.blitz}</span>
                              <span>⏱️ {friend.ratings.rapid}</span>
                            </div>
                          )}
                        </div>
                      </Link>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                        <Button 
                          size="sm" 
                          variant="secondary"
                          className="h-8 text-xs font-bold rounded-lg flex items-center gap-1.5 hover:bg-primary hover:text-primary-foreground transition-colors"
                          onClick={() => setLocation('/play?mode=private')}
                        >
                          <Swords className="w-3.5 h-3.5" /> Challenge
                        </Button>
                        <Button 
                          asChild 
                          size="sm" 
                          variant="outline" 
                          className="h-8 text-xs font-semibold rounded-lg"
                        >
                          <Link href={`/profile/${friend.username}`}>Profile</Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 space-y-3 text-muted-foreground">
                  <UserPlus className="w-10 h-10 mx-auto opacity-40" />
                  <p className="text-sm font-semibold">No friends added yet.</p>
                  <p className="text-xs max-w-xs mx-auto">Use the Add Friend form on the left to invite fellow chess players!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
