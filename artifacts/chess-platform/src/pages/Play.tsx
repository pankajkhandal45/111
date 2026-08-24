import React, { useState, useEffect } from 'react';
import { useCreateGame, getBaseUrl, getGetGameQueryKey, useGetDashboard } from '@workspace/api-client-react';
import { useLocation, useSearch } from 'wouter';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  Globe, 
  Users, 
  Lock, 
  Copy, 
  Check, 
  Link2, 
  UserPlus, 
  Flame, 
  Zap, 
  Clock, 
  Trophy, 
  Bot, 
  Play as PlayIcon, 
  ArrowRight,
  CheckCircle2,
  Swords
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';

interface TimeControlItem {
  id: string;
  name: string;
  tag: string;
  desc: string;
  icon: any;
  color: string;
}

const TIME_CONTROLS: Record<string, TimeControlItem[]> = {
  rapid: [
    { id: 'rapid10', name: '10 min', tag: 'Rapid', desc: '10 min per player', icon: Clock, color: 'text-emerald-500' },
    { id: 'rapid15', name: '15 min', tag: 'Rapid', desc: '15 min per player', icon: Clock, color: 'text-emerald-500' },
    { id: 'rapid30', name: '30 min', tag: 'Rapid', desc: '30 min per player', icon: Clock, color: 'text-emerald-500' }
  ],
  blitz: [
    { id: 'blitz3', name: '3 min', tag: 'Blitz', desc: '3 min per player', icon: Zap, color: 'text-amber-500' },
    { id: 'blitz5', name: '5 min', tag: 'Blitz', desc: '5 min per player', icon: Zap, color: 'text-amber-500' }
  ],
  bullet: [
    { id: 'bullet1', name: '1 min', tag: 'Bullet', desc: '1 min per player', icon: Flame, color: 'text-rose-500' },
    { id: 'bullet2', name: '2 min', tag: 'Bullet', desc: '2 min per player', icon: Flame, color: 'text-rose-500' }
  ],
  classical: [
    { id: 'classical60', name: '60 min', tag: 'Classical', desc: '60 min per player', icon: Trophy, color: 'text-blue-500' }
  ]
};

const BOT_ROSTER = [
  { id: 'beginner', name: 'Martin', title: 'Beginner', elo: 400, avatar: '🌱', color: 'text-emerald-500' },
  { id: 'easy', name: 'Sven', title: 'Easy', elo: 800, avatar: '♟️', color: 'text-green-500' },
  { id: 'intermediate', name: 'Isabel', title: 'Intermediate', elo: 1200, avatar: '🛡️', color: 'text-blue-500' },
  { id: 'advanced', name: 'Wally', title: 'Advanced', elo: 1600, avatar: '⚔️', color: 'text-indigo-500' },
  { id: 'expert', name: 'Nora', title: 'Expert', elo: 2000, avatar: '🔮', color: 'text-purple-500' },
  { id: 'master', name: 'Magnus Bot', title: 'Master', elo: 2400, avatar: '👑', color: 'text-rose-500' },
  { id: 'grandmaster', name: 'Stockfish Titan', title: 'GM', elo: 2800, avatar: '🤖', color: 'text-amber-500' }
];

export default function Play() {
  const [, setLocation] = useLocation();
  const createGame = useCreateGame();
  const { user, token } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: dashboard } = useGetDashboard({
    query: {
      queryKey: ['/api/dashboard'],
      enabled: !!user,
    }
  });

  const ratings: any = dashboard?.ratings || (user as any)?.ratings || {
    bullet: 800,
    blitz: 800,
    rapid: 800,
    classical: 800
  };

  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const joinParam = params.get('join');
  const modeParam = params.get('mode');

  const [mode, setMode] = useState<'online' | 'bot' | 'local' | 'private'>('online');
  const [timeControl, setTimeControl] = useState('rapid10');
  const [botLevel, setBotLevel] = useState('intermediate');

  useEffect(() => {
    if (joinParam) {
      setMode('private');
      setPrivateTab('join');
      setJoinCode(joinParam.toUpperCase());
    } else if (modeParam && ['online', 'bot', 'local', 'private'].includes(modeParam)) {
      setMode(modeParam as any);
    }
  }, [joinParam, modeParam]);

  const [privateTab, setPrivateTab] = useState<'create' | 'join'>(joinParam ? 'join' : 'create');
  const [createdGame, setCreatedGame] = useState<{ id: number; roomCode: string } | null>(null);
  const [joinCode, setJoinCode] = useState(joinParam || '');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const joinGameMutation = useMutation({
    mutationFn: async (code: string) => {
      const base = getBaseUrl().replace(/\/$/, '');
      const res = await fetch(`${base}/api/games/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ roomCode: code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to join game');
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
            queryClient.setQueryData(getGetGameQueryKey(data.id), data);
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
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    toast({ title: 'Room code copied!' });
  };

  const handleCopyLink = () => {
    if (!createdGame) return;
    const link = `${window.location.origin}/play?join=${createdGame.roomCode}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    toast({ title: 'Invite link copied!' });
  };

  const handleJoinGame = () => {
    if (!joinCode.trim()) return;
    joinGameMutation.mutate(joinCode.trim().toUpperCase());
  };

  const getSelectedTimeControlObj = () => {
    for (const group of Object.values(TIME_CONTROLS)) {
      const match = group.find(item => item.id === timeControl);
      if (match) return match;
    }
    return TIME_CONTROLS.rapid[0];
  };

  const selectedTcObj = getSelectedTimeControlObj();
  const selectedBotObj = BOT_ROSTER.find(b => b.id === botLevel) || BOT_ROSTER[2];

  const getRatingForCategory = (category: string) => {
    if (category === 'bullet') return ratings?.bullet || 800;
    if (category === 'blitz') return ratings?.blitz || 800;
    if (category === 'rapid') return ratings?.rapid || 800;
    if (category === 'classical') return ratings?.classical || 800;
    return 800;
  };

  // Screen when private game is created
  if (createdGame) {
    return (
      <div className="max-w-md mx-auto py-12 px-4 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" /> Room Ready
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Private Room Created</h1>
          <p className="text-xs text-muted-foreground">Share the room code or link with your opponent.</p>
        </div>

        <Card className="border-border/60 shadow-md">
          <CardContent className="p-6 text-center space-y-6">
            <div>
              <span className="text-xs uppercase font-medium text-muted-foreground block mb-2">Room Code</span>
              <span className="text-4xl font-mono font-bold tracking-[0.2em] text-primary">
                {createdGame.roomCode}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={handleCopyCode} className="h-10 text-xs font-medium">
                {copiedCode ? <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-500" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                {copiedCode ? 'Copied' : 'Copy Code'}
              </Button>
              <Button variant="outline" size="sm" onClick={handleCopyLink} className="h-10 text-xs font-medium">
                {copiedLink ? <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-500" /> : <Link2 className="mr-1.5 h-3.5 w-3.5" />}
                {copiedLink ? 'Copied' : 'Copy Link'}
              </Button>
            </div>

            <Button 
              size="lg" 
              className="w-full h-11 text-sm font-bold rounded-xl" 
              onClick={() => setLocation(`/game/${createdGame.id}`)}
            >
              Enter Game Room <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setCreatedGame(null)}>
            ← Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      {/* ── Minimalist Clean Header ── */}
      <div className="text-center space-y-1">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Play Chess</h1>
        <p className="text-xs md:text-sm text-muted-foreground">Select game mode and time control to get started</p>
      </div>

      {/* ── Sleek Segmented Mode Bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-muted/40 p-1.5 rounded-2xl border border-border/50">
        <button
          type="button"
          onClick={() => setMode('online')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
            mode === 'online'
              ? 'bg-card text-foreground shadow border border-border/40'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Globe className="w-4 h-4 text-emerald-500" />
          <span>Online</span>
        </button>

        <button
          type="button"
          onClick={() => setMode('bot')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
            mode === 'bot'
              ? 'bg-card text-foreground shadow border border-border/40'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Bot className="w-4 h-4 text-blue-500" />
          <span>vs Computer</span>
        </button>

        <button
          type="button"
          onClick={() => setMode('local')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
            mode === 'local'
              ? 'bg-card text-foreground shadow border border-border/40'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Users className="w-4 h-4 text-purple-500" />
          <span>Pass &amp; Play</span>
        </button>

        <button
          type="button"
          onClick={() => setMode('private')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
            mode === 'private'
              ? 'bg-card text-foreground shadow border border-border/40'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Lock className="w-4 h-4 text-amber-500" />
          <span>Private Match</span>
        </button>
      </div>

      {/* ── Main Clean Container ── */}
      <Card className="border-border/50 shadow-sm rounded-2xl">
        <CardContent className="p-6 space-y-6">

          {/* PRIVATE MATCH setup */}
          {mode === 'private' ? (
            <div className="space-y-6">
              <div className="flex justify-center gap-2 border-b border-border/40 pb-4">
                <Button
                  variant={privateTab === 'create' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setPrivateTab('create')}
                  className="rounded-lg text-xs font-bold"
                >
                  Create Room
                </Button>
                <Button
                  variant={privateTab === 'join' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setPrivateTab('join')}
                  className="rounded-lg text-xs font-bold"
                >
                  Join Room
                </Button>
              </div>

              {privateTab === 'create' ? (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Time Control</span>
                    <Tabs defaultValue="rapid" className="w-full">
                      <TabsList className="w-full justify-start bg-muted/40 p-1 rounded-xl">
                        <TabsTrigger value="rapid" className="rounded-lg text-xs font-bold">Rapid</TabsTrigger>
                        <TabsTrigger value="blitz" className="rounded-lg text-xs font-bold">Blitz</TabsTrigger>
                        <TabsTrigger value="bullet" className="rounded-lg text-xs font-bold">Bullet</TabsTrigger>
                        <TabsTrigger value="classical" className="rounded-lg text-xs font-bold">Classical</TabsTrigger>
                      </TabsList>

                      {Object.entries(TIME_CONTROLS).map(([category, controls]) => (
                        <TabsContent key={category} value={category} className="mt-3">
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {controls.map((control) => {
                              const isSelected = timeControl === control.id;
                              return (
                                <button
                                  key={control.id}
                                  type="button"
                                  onClick={() => setTimeControl(control.id)}
                                  className={`p-3.5 rounded-xl border text-center transition-all cursor-pointer ${
                                    isSelected
                                      ? 'border-primary bg-primary/10 font-bold shadow-sm'
                                      : 'border-border/50 bg-muted/20 hover:bg-muted/40'
                                  }`}
                                >
                                  <div className="text-base font-bold">{control.name}</div>
                                  <div className="text-[11px] text-muted-foreground">{control.tag}</div>
                                </button>
                              );
                            })}
                          </div>
                        </TabsContent>
                      ))}
                    </Tabs>
                  </div>

                  <Button 
                    size="lg" 
                    className="w-full h-11 text-sm font-bold rounded-xl"
                    onClick={handleCreateGame} 
                    disabled={createGame.isPending}
                  >
                    {createGame.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
                    Create Private Room
                  </Button>
                </div>
              ) : (
                <div className="max-w-sm mx-auto space-y-4 py-2 text-center">
                  <p className="text-xs text-muted-foreground">Enter 6-letter room code</p>
                  <Input
                    placeholder="ROOM CODE"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    className="text-center text-2xl font-mono tracking-widest h-14 font-bold rounded-xl uppercase"
                    maxLength={6}
                    onKeyDown={(e) => e.key === 'Enter' && handleJoinGame()}
                  />
                  <Button
                    size="lg"
                    className="w-full h-11 text-sm font-bold rounded-xl"
                    onClick={handleJoinGame}
                    disabled={joinCode.length !== 6 || joinGameMutation.isPending}
                  >
                    {joinGameMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                    Join Game
                  </Button>
                </div>
              )}
            </div>
          ) : (
            /* ONLINE / BOT / LOCAL MODES */
            <div className="space-y-6">

              {/* BOT LEVEL SELECTOR */}
              {mode === 'bot' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-muted-foreground uppercase tracking-wider">Select Bot</span>
                    <span className="font-bold text-foreground">{selectedBotObj.name} ({selectedBotObj.elo} Elo)</span>
                  </div>

                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                    {BOT_ROSTER.map((bot) => {
                      const isSelected = botLevel === bot.id;
                      return (
                        <button
                          key={bot.id}
                          type="button"
                          onClick={() => setBotLevel(bot.id)}
                          className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                            isSelected
                              ? 'border-blue-500 bg-blue-500/10 font-bold shadow-sm'
                              : 'border-border/50 bg-muted/20 hover:bg-muted/40'
                          }`}
                        >
                          <span className="text-xl">{bot.avatar}</span>
                          <span className="text-[11px] font-bold truncate w-full">{bot.name}</span>
                          <span className="text-[9px] text-muted-foreground font-mono">{bot.elo}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TIME CONTROL SELECTOR */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-muted-foreground uppercase tracking-wider">Select Time Control</span>
                  {user && (
                    <span className="text-muted-foreground">Elo: <strong className="text-foreground">{getRatingForCategory(selectedTcObj.tag.toLowerCase())}</strong></span>
                  )}
                </div>

                <Tabs defaultValue="rapid" className="w-full">
                  <TabsList className="w-full justify-start bg-muted/40 p-1 rounded-xl">
                    <TabsTrigger value="rapid" className="rounded-lg text-xs font-bold flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-emerald-500" /> Rapid
                    </TabsTrigger>
                    <TabsTrigger value="blitz" className="rounded-lg text-xs font-bold flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-amber-500" /> Blitz
                    </TabsTrigger>
                    <TabsTrigger value="bullet" className="rounded-lg text-xs font-bold flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5 text-rose-500" /> Bullet
                    </TabsTrigger>
                    <TabsTrigger value="classical" className="rounded-lg text-xs font-bold flex items-center gap-1">
                      <Trophy className="w-3.5 h-3.5 text-blue-500" /> Classical
                    </TabsTrigger>
                  </TabsList>

                  {Object.entries(TIME_CONTROLS).map(([category, controls]) => (
                    <TabsContent key={category} value={category} className="mt-3">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {controls.map((control) => {
                          const isSelected = timeControl === control.id;
                          return (
                            <button
                              key={control.id}
                              type="button"
                              onClick={() => setTimeControl(control.id)}
                              className={`p-4 rounded-xl border text-center transition-all cursor-pointer ${
                                isSelected
                                  ? 'border-primary bg-primary/10 font-bold shadow-sm'
                                  : 'border-border/50 bg-muted/20 hover:bg-muted/40'
                              }`}
                            >
                              <div className="text-lg font-extrabold">{control.name}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">{control.desc}</div>
                            </button>
                          );
                        })}
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </div>

              {/* ACTION BUTTON */}
              <div className="pt-4 border-t border-border/40">
                <Button 
                  size="lg" 
                  className="w-full h-12 text-base font-extrabold rounded-xl shadow-md"
                  onClick={handleCreateGame} 
                  disabled={createGame.isPending}
                >
                  {createGame.isPending ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <PlayIcon className="mr-2 h-5 w-5 fill-current" />
                  )}
                  {mode === 'online' && 'Play Online'}
                  {mode === 'bot' && `Play vs ${selectedBotObj.name}`}
                  {mode === 'local' && 'Play Local Match'}
                </Button>
              </div>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
