import React, { useState, useEffect } from 'react';
import { useCreateGame } from '@workspace/api-client-react';
import { useLocation, useSearch } from 'wouter';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, Globe, Cpu, Users, Lock, Copy, Check, Link2, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { useMutation } from '@tanstack/react-query';

const TIME_CONTROLS = {
  bullet: [
    { id: 'bullet1', name: '1 min' },
    { id: 'bullet2', name: '2 min' }
  ],
  blitz: [
    { id: 'blitz3', name: '3 min' },
    { id: 'blitz5', name: '5 min' }
  ],
  rapid: [
    { id: 'rapid10', name: '10 min' },
    { id: 'rapid15', name: '15 min' },
    { id: 'rapid30', name: '30 min' }
  ],
  classical: [
    { id: 'classical60', name: '60 min' }
  ]
};

const BOT_LEVELS = [
  { id: 'beginner', name: 'Beginner' },
  { id: 'easy', name: 'Easy' },
  { id: 'intermediate', name: 'Intermediate' },
  { id: 'advanced', name: 'Advanced' },
  { id: 'expert', name: 'Expert' },
  { id: 'master', name: 'Master' },
  { id: 'grandmaster', name: 'Grandmaster' }
];

export default function Play() {
  const [, setLocation] = useLocation();
  const createGame = useCreateGame();
  const { token } = useAuth();
  const { toast } = useToast();

  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const joinParam = params.get('join');

  const [mode, setMode] = useState<'online' | 'bot' | 'local' | 'private'>(joinParam ? 'private' : 'online');
  const [timeControl, setTimeControl] = useState('rapid10');
  const [botLevel, setBotLevel] = useState('intermediate');

  // Private match states
  const [privateTab, setPrivateTab] = useState<'create' | 'join'>(joinParam ? 'join' : 'create');
  const [createdGame, setCreatedGame] = useState<{ id: number; roomCode: string } | null>(null);
  const [joinCode, setJoinCode] = useState(joinParam || '');
  const [copied, setCopied] = useState(false);

  const joinGameMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await fetch('/api/games/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ roomCode: code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to join');
      return data;
    },
    onSuccess: (data) => {
      setLocation(`/game/${data.id}`);
    },
    onError: (err: any) => {
      toast({ title: 'Failed to join game', description: err.message, variant: 'destructive' });
    },
  });

  const handleCreateGame = () => {
    createGame.mutate(
      {
        data: {
          mode: mode as any,
          timeControl: timeControl as any,
          ...(mode === 'bot' ? { botLevel: botLevel as any } : {}),
        },
      },
      {
        onSuccess: (data) => {
          if (mode === 'private') {
            setCreatedGame({ id: data.id, roomCode: data.roomCode! });
          } else {
            setLocation(`/game/${data.id}`);
          }
        },
        onError: () => {
          toast({ title: 'Failed to create game', variant: 'destructive' });
        }
      }
    );
  };

  const handleCopyCode = () => {
    if (!createdGame) return;
    navigator.clipboard.writeText(createdGame.roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Room code copied!' });
  };

  const handleCopyLink = () => {
    if (!createdGame) return;
    const link = `${window.location.origin}/play?join=${createdGame.roomCode}`;
    navigator.clipboard.writeText(link);
    toast({ title: 'Invite link copied! Share it with your friend.' });
  };

  const handleJoinGame = () => {
    if (!joinCode.trim()) return;
    joinGameMutation.mutate(joinCode.trim().toUpperCase());
  };

  // If a private game was just created, show the lobby/waiting screen
  if (createdGame) {
    return (
      <div className="max-w-lg mx-auto py-16 flex flex-col items-center gap-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Private Match Created!</h1>
          <p className="text-muted-foreground">Share the room code or link with your friend to start the game.</p>
        </div>

        <Card className="w-full">
          <CardContent className="pt-6 space-y-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">Room Code</p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-5xl font-mono font-bold tracking-widest text-primary">
                  {createdGame.roomCode}
                </span>
                <Button size="icon" variant="outline" onClick={handleCopyCode}>
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <Button variant="outline" className="w-full" onClick={handleCopyLink}>
                <Link2 className="mr-2 h-4 w-4" /> Copy Invite Link
              </Button>
              <Button className="w-full" onClick={() => setLocation(`/game/${createdGame.id}`)}>
                Enter Game Room & Wait for Friend
              </Button>
            </div>
          </CardContent>
        </Card>

        <Button variant="ghost" onClick={() => setCreatedGame(null)}>← Back</Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Play Chess</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1 flex flex-col gap-2">
          <Button
            variant={mode === 'online' ? 'default' : 'ghost'}
            className="justify-start w-full"
            onClick={() => setMode('online')}
          >
            <Globe className="mr-2 h-4 w-4" /> Play Online
          </Button>
          <Button
            variant={mode === 'bot' ? 'default' : 'ghost'}
            className="justify-start w-full"
            onClick={() => setMode('bot')}
          >
            <Cpu className="mr-2 h-4 w-4" /> Play Computer
          </Button>
          <Button
            variant={mode === 'local' ? 'default' : 'ghost'}
            className="justify-start w-full"
            onClick={() => setMode('local')}
          >
            <Users className="mr-2 h-4 w-4" /> Play Local
          </Button>
          <Button
            variant={mode === 'private' ? 'default' : 'ghost'}
            className="justify-start w-full"
            onClick={() => setMode('private')}
          >
            <Lock className="mr-2 h-4 w-4" /> Private Match
          </Button>
        </div>

        <div className="md:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>
                {mode === 'online' && 'Play against someone of your skill level'}
                {mode === 'bot' && 'Challenge the computer'}
                {mode === 'local' && 'Play with a friend on the same screen'}
                {mode === 'private' && 'Private Match with a Friend'}
              </CardTitle>
              <CardDescription>
                {mode === 'private'
                  ? 'Create a game and share the code, or join with a code'
                  : 'Select a time control to begin'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

              {mode === 'private' ? (
                <div className="space-y-4">
                  {/* Create / Join Tabs */}
                  <div className="flex gap-2 p-1 bg-muted rounded-lg">
                    <button
                      onClick={() => setPrivateTab('create')}
                      className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${privateTab === 'create' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      Create Game
                    </button>
                    <button
                      onClick={() => setPrivateTab('join')}
                      className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${privateTab === 'join' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      Join with Code
                    </button>
                  </div>

                  {privateTab === 'create' ? (
                    <div className="space-y-6">
                      <p className="text-sm text-muted-foreground">
                        Select a time control, create the game and share the room code with your friend. They can join from any device.
                      </p>
                      <Tabs defaultValue="rapid" className="w-full">
                        <TabsList className="w-full justify-start">
                          <TabsTrigger value="bullet">Bullet</TabsTrigger>
                          <TabsTrigger value="blitz">Blitz</TabsTrigger>
                          <TabsTrigger value="rapid">Rapid</TabsTrigger>
                          <TabsTrigger value="classical">Classical</TabsTrigger>
                        </TabsList>
                        {Object.entries(TIME_CONTROLS).map(([category, controls]) => (
                          <TabsContent key={category} value={category} className="mt-4">
                            <div className="flex flex-wrap gap-4">
                              {controls.map(control => (
                                <Button
                                  key={control.id}
                                  variant={timeControl === control.id ? 'default' : 'outline'}
                                  className="h-24 w-32 flex flex-col gap-2 text-lg"
                                  onClick={() => setTimeControl(control.id)}
                                >
                                  <span>{control.name}</span>
                                </Button>
                              ))}
                            </div>
                          </TabsContent>
                        ))}
                      </Tabs>
                      <div className="pt-2 border-t flex justify-end">
                        <Button size="lg" className="w-full md:w-auto px-12 text-lg" onClick={handleCreateGame} disabled={createGame.isPending}>
                          {createGame.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Lock className="mr-2 h-5 w-5" />}
                          Create Private Game
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <p className="text-sm text-muted-foreground">
                        Enter the 6-letter room code your friend shared with you to join their game.
                      </p>
                      <div className="space-y-3">
                        <Input
                          placeholder="Enter room code (e.g. AB12CD)"
                          value={joinCode}
                          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                          className="text-center text-2xl font-mono tracking-widest h-16"
                          maxLength={6}
                          onKeyDown={(e) => e.key === 'Enter' && handleJoinGame()}
                        />
                        <Button
                          size="lg"
                          className="w-full text-lg"
                          onClick={handleJoinGame}
                          disabled={joinCode.length !== 6 || joinGameMutation.isPending}
                        >
                          {joinGameMutation.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <UserPlus className="mr-2 h-5 w-5" />}
                          Join Game
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {mode === 'bot' && (
                    <div className="space-y-2">
                      <h3 className="font-semibold">Bot Level</h3>
                      <div className="flex flex-wrap gap-2">
                        {BOT_LEVELS.map(level => (
                          <Button
                            key={level.id}
                            variant={botLevel === level.id ? 'default' : 'outline'}
                            onClick={() => setBotLevel(level.id)}
                          >
                            {level.name}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  <Tabs defaultValue="rapid" className="w-full">
                    <TabsList className="w-full justify-start">
                      <TabsTrigger value="bullet">Bullet</TabsTrigger>
                      <TabsTrigger value="blitz">Blitz</TabsTrigger>
                      <TabsTrigger value="rapid">Rapid</TabsTrigger>
                      <TabsTrigger value="classical">Classical</TabsTrigger>
                    </TabsList>

                    {Object.entries(TIME_CONTROLS).map(([category, controls]) => (
                      <TabsContent key={category} value={category} className="mt-4">
                        <div className="flex flex-wrap gap-4">
                          {controls.map(control => (
                            <Button
                              key={control.id}
                              variant={timeControl === control.id ? 'default' : 'outline'}
                              className="h-24 w-32 flex flex-col gap-2 text-lg"
                              onClick={() => setTimeControl(control.id)}
                            >
                              <span>{control.name}</span>
                            </Button>
                          ))}
                        </div>
                      </TabsContent>
                    ))}
                  </Tabs>

                  <div className="pt-6 border-t flex justify-end">
                    <Button size="lg" className="w-full md:w-auto px-12 text-lg" onClick={handleCreateGame} disabled={createGame.isPending}>
                      {createGame.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                      Play
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

