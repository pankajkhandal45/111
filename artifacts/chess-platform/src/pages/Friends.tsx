import React, { useState } from 'react';
import { useGetFriends, useGetFriendRequests, useSendFriendRequest, useAcceptFriendRequest, useDeclineFriendRequest, getBaseUrl } from '@workspace/api-client-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, UserPlus, Check, X, Clock } from 'lucide-react';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';
import { useAuth } from '@/context/AuthContext';

export default function Friends() {
  const { token } = useAuth();
  const { data: friends, isLoading: isFriendsLoading } = useGetFriends({ query: { refetchInterval: 60_000 } });
  const { data: requests, isLoading: isRequestsLoading } = useGetFriendRequests();
  
  const queryClient = useQueryClient();
  
  const { data: sentRequests } = useQuery({
    queryKey: ['sentFriendRequests'],
    queryFn: async () => {
      const base = getBaseUrl().replace(/\/$/, '');
      const res = await fetch(`${base}/api/friends/requests/sent`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    enabled: !!token
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
      toast({ title: "Request cancelled" });
    }
  });

  const sendRequest = useSendFriendRequest();
  const acceptRequest = useAcceptFriendRequest();
  const declineRequest = useDeclineFriendRequest();
  const { toast } = useToast();

  const [username, setUsername] = useState('');

  const handleSendRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) return;
    sendRequest.mutate({ data: { username } }, {
      onSuccess: (data: any) => {
        if (data?.message === "Friend request accepted") {
          toast({ title: "Friend request accepted!", description: `You are now friends with ${username}` });
          queryClient.invalidateQueries();
        } else {
          toast({ title: "Request sent" });
        }
        setUsername('');
        queryClient.invalidateQueries({ queryKey: ['sentFriendRequests'] });
      },
      onError: (err: any) => {
        toast({ 
          title: "Failed to send request", 
          description: err.response?.data?.error || err.message,
          variant: "destructive" 
        });
      }
    });
  };

  if (isFriendsLoading || isRequestsLoading) {
    return <div className="flex justify-center p-24"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-8">
      <h1 className="text-3xl font-bold">Friends</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Add Friend</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSendRequest} className="flex gap-2">
                <Input 
                  placeholder="Enter username" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <Button type="submit" disabled={sendRequest.isPending}>
                  <UserPlus className="w-4 h-4 mr-2" /> Add
                </Button>
              </form>
            </CardContent>
          </Card>

          {requests && requests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Pending Requests</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {requests.map(req => (
                  <div key={req.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={req.fromUser?.avatar || undefined} />
                        <AvatarFallback>{req.fromUser?.username?.substring(0,2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{req.fromUser?.username}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="icon" variant="outline" className="h-8 w-8 text-green-500" onClick={() => acceptRequest.mutate({ id: req.id }, { onSuccess: () => queryClient.invalidateQueries() })}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="outline" className="h-8 w-8 text-red-500" onClick={() => declineRequest.mutate({ id: req.id }, { onSuccess: () => queryClient.invalidateQueries() })}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {sentRequests && sentRequests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Sent Requests</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {sentRequests.map((req: any) => (
                  <div key={req.id} className="flex items-center justify-between opacity-70">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={req.toUser?.avatar || undefined} />
                        <AvatarFallback>{req.toUser?.username?.substring(0,2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{req.toUser?.username}</span>
                      <span className="text-xs flex items-center text-muted-foreground ml-2">
                        <Clock className="w-3 h-3 mr-1" /> Pending
                      </span>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="text-red-500 hover:text-red-600" 
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

        <div>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Your Friends</CardTitle>
            </CardHeader>
            <CardContent>
              {friends && friends.length > 0 ? (
                <div className="space-y-4">
                  {friends.map(friend => (
                    <div key={friend.id} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-lg transition-colors">
                      <Link href={`/profile/${friend.username}`} className="flex items-center gap-3">
                        <div className="relative">
                          <Avatar>
                            <AvatarImage src={friend.avatar || undefined} />
                            <AvatarFallback>{friend.username.substring(0,2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background ${friend.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                        </div>
                        <span className="font-medium">{friend.username}</span>
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No friends yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
