import React, { useEffect, useRef, useState, useCallback } from 'react';
import Peer from 'peerjs';
import { Mic, MicOff, Volume2, PhoneCall, PhoneOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────
type VoiceStatus = 'idle' | 'connecting' | 'connected' | 'error';

interface VoiceChatProps {
  gameId: number;
  myColor: 'white' | 'black';   // which side am I playing
  myName: string;
  myAvatar?: string | null;
  opponentName: string;
  opponentAvatar?: string | null;
  /** Only show when game is active */
  gameActive: boolean;
}

// ── Peer ID helpers ────────────────────────────────────────────────────────────
// Each player gets a deterministic PeerJS ID based on gameId + color
// so they can always find each other.
function makePeerId(gameId: number, color: 'white' | 'black') {
  return `chess-voice-g${gameId}-${color}`;
}

// ── VoiceChat Component ────────────────────────────────────────────────────────
export function VoiceChat({
  gameId,
  myColor,
  myName,
  myAvatar,
  opponentName,
  opponentAvatar,
  gameActive,
}: VoiceChatProps) {
  const opponentColor: 'white' | 'black' = myColor === 'white' ? 'black' : 'white';

  const peerRef       = useRef<Peer | null>(null);
  const localStream   = useRef<MediaStream | null>(null);
  const callRef       = useRef<any>(null);
  const myAnalyser    = useRef<AnalyserNode | null>(null);
  const myDataArr     = useRef<Uint8Array | null>(null);
  const remoteAnalyser = useRef<AnalyserNode | null>(null);
  const remoteDataArr  = useRef<Uint8Array | null>(null);
  const remoteAudio   = useRef<HTMLAudioElement | null>(null);
  const reconnectRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef        = useRef<number>(0);

  const [status, setStatus]           = useState<VoiceStatus>('idle');
  const [isMuted, setIsMuted]         = useState(false);
  const [myVol, setMyVol]             = useState(0);
  const [remoteVol, setRemoteVol]     = useState(0);
  const [isSpeaking, setIsSpeaking]   = useState(false);
  const [oppSpeaking, setOppSpeaking] = useState(false);
  const [open, setOpen]               = useState(true);
  const [pttActive, setPttActive]     = useState(false);
  const [errorMsg, setErrorMsg]       = useState('');

  // ── Volume animation loop ────────────────────────────────────────────────
  const tickVis = useCallback(() => {
    rafRef.current = requestAnimationFrame(tickVis);

    // My volume
    if (myAnalyser.current && myDataArr.current) {
      myAnalyser.current.getByteFrequencyData(myDataArr.current);
      const avg = myDataArr.current.reduce((a, b) => a + b, 0) / myDataArr.current.length;
      const pct = Math.min(100, avg * 2.8);
      setMyVol(pct);
      setIsSpeaking(pct > 10 && !isMuted);
    }

    // Remote volume
    if (remoteAnalyser.current && remoteDataArr.current) {
      remoteAnalyser.current.getByteFrequencyData(remoteDataArr.current);
      const avg = remoteDataArr.current.reduce((a, b) => a + b, 0) / remoteDataArr.current.length;
      const pct = Math.min(100, avg * 2.8);
      setRemoteVol(pct);
      setOppSpeaking(pct > 10);
    }
  }, [isMuted]);

  // ── Mic access ───────────────────────────────────────────────────────────
  async function getMic(): Promise<MediaStream> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    // Build analyser for local mic
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    myAnalyser.current = analyser;
    myDataArr.current = new Uint8Array(analyser.frequencyBinCount);
    return stream;
  }

  // ── Attach remote audio ──────────────────────────────────────────────────
  function attachRemoteStream(stream: MediaStream) {
    if (!remoteAudio.current) remoteAudio.current = new Audio();
    remoteAudio.current.srcObject = stream;
    remoteAudio.current.autoplay = true;
    remoteAudio.current.play().catch(() => {});

    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    remoteAnalyser.current = analyser;
    remoteDataArr.current = new Uint8Array(analyser.frequencyBinCount);
  }

  // ── Handle incoming call ─────────────────────────────────────────────────
  function handleCall(call: any) {
    if (!localStream.current) return;
    callRef.current = call;
    call.answer(localStream.current);
    call.on('stream', (remoteStream: MediaStream) => {
      attachRemoteStream(remoteStream);
      setStatus('connected');
    });
    call.on('close', () => {
      setStatus('idle');
      callRef.current = null;
    });
    call.on('error', () => setStatus('error'));
  }

  // ── Start voice chat ─────────────────────────────────────────────────────
  async function startVoice() {
    try {
      setStatus('connecting');
      setErrorMsg('');

      localStream.current = await getMic();
      rafRef.current = requestAnimationFrame(tickVis);

      const myPeerId  = makePeerId(gameId, myColor);
      const oppPeerId = makePeerId(gameId, opponentColor);

      const peer = new Peer(myPeerId, {
        host: 'peerjs.92k.de',
        secure: true,
        port: 443,
        path: '/',
        debug: 0,
      });
      peerRef.current = peer;

      peer.on('open', () => {
        // If I'm white — call the black player; black waits for incoming call
        if (myColor === 'white') {
          const call = peer.call(oppPeerId, localStream.current!);
          callRef.current = call;
          call.on('stream', (remoteStream: MediaStream) => {
            attachRemoteStream(remoteStream);
            setStatus('connected');
          });
          call.on('close', () => { setStatus('idle'); callRef.current = null; });
          call.on('error', () => setStatus('error'));
        }
        // Both sides listen for incoming calls
        peer.on('call', handleCall);
      });

      peer.on('error', (err: any) => {
        if (err.type === 'peer-unavailable') {
          // Opponent not online yet — retry after 4s
          reconnectRef.current = setTimeout(() => {
            if (peerRef.current && localStream.current) {
              const oppPeerId = makePeerId(gameId, opponentColor);
              const call = peerRef.current.call(oppPeerId, localStream.current);
              callRef.current = call;
              call.on('stream', (s: MediaStream) => { attachRemoteStream(s); setStatus('connected'); });
              call.on('close', () => { setStatus('idle'); callRef.current = null; });
            }
          }, 4000);
        } else if (err.type === 'unavailable-id') {
          // My ID is taken (I already have another tab open) — destroy and wait
          setStatus('error');
          setErrorMsg('Already connected in another tab. Close it first.');
        } else {
          setStatus('error');
          setErrorMsg('Connection error. Try again.');
        }
      });
    } catch {
      setStatus('error');
      setErrorMsg('Microphone access denied. Please allow mic permission.');
    }
  }

  // ── Stop voice chat ──────────────────────────────────────────────────────
  function stopVoice() {
    if (reconnectRef.current) clearTimeout(reconnectRef.current);
    cancelAnimationFrame(rafRef.current);
    callRef.current?.close();
    localStream.current?.getTracks().forEach(t => t.stop());
    peerRef.current?.destroy();
    if (remoteAudio.current) { remoteAudio.current.srcObject = null; }
    peerRef.current    = null;
    localStream.current = null;
    callRef.current    = null;
    myAnalyser.current = null;
    remoteAnalyser.current = null;
    setStatus('idle');
    setMyVol(0);
    setRemoteVol(0);
    setIsSpeaking(false);
    setOppSpeaking(false);
    setIsMuted(false);
  }

  // ── Mute toggle ──────────────────────────────────────────────────────────
  function toggleMute() {
    if (!localStream.current) return;
    const next = !isMuted;
    setIsMuted(next);
    localStream.current.getAudioTracks().forEach(t => (t.enabled = !next));
  }

  // ── Push-to-Talk (Space) ─────────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== 'Space' || e.repeat || status !== 'connected') return;
      // Only PTT when focus is NOT on an input/textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      if (!pttActive && localStream.current) {
        setPttActive(true);
        localStream.current.getAudioTracks().forEach(t => (t.enabled = true));
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code !== 'Space' || !pttActive) return;
      setPttActive(false);
      if (isMuted && localStream.current) {
        localStream.current.getAudioTracks().forEach(t => (t.enabled = false));
      }
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup',   onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup',   onKeyUp);
    };
  }, [status, pttActive, isMuted]);

  // ── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => () => stopVoice(), []);

  if (!gameActive) return null;

  // ── UI ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col bg-card rounded-md border shadow-sm overflow-hidden">
      {/* ── Header ── */}
      <button
        className="flex items-center justify-between px-4 py-2.5 bg-muted/50 hover:bg-muted transition-colors cursor-pointer w-full text-left border-b"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            {status === 'connected' && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            )}
            <span className={cn(
              'relative inline-flex rounded-full h-2 w-2',
              status === 'connected'  ? 'bg-green-500' :
              status === 'connecting' ? 'bg-yellow-400' :
              status === 'error'      ? 'bg-red-500' :
                                        'bg-muted-foreground/40'
            )} />
          </span>
          <Mic className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Voice Chat</span>
          {status === 'connected' && (
            <span className="text-xs text-green-500 font-medium">Live</span>
          )}
        </div>
        <span
          className="text-xs text-muted-foreground transition-transform duration-200"
          style={{ display: 'inline-block', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
        >▼</span>
      </button>

      {open && (
        <div className="p-3 flex flex-col gap-3">

          {/* Error */}
          {errorMsg && (
            <p className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1">{errorMsg}</p>
          )}

          {/* ── Players row ── */}
          {status === 'connected' && (
            <div className="flex items-center justify-between gap-2">
              {/* Me */}
              <div className={cn(
                'flex flex-col items-center gap-1 rounded-lg px-3 py-2 flex-1 transition-all',
                isSpeaking && !isMuted ? 'bg-green-500/10 ring-1 ring-green-500/50' : 'bg-muted/30'
              )}>
                <div className="relative">
                  <Avatar className={cn('h-9 w-9 border-2 transition-all', isSpeaking && !isMuted ? 'border-green-500' : 'border-transparent')}>
                    <AvatarImage src={myAvatar || undefined} />
                    <AvatarFallback className="text-xs font-bold">{myName.substring(0,2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  {isMuted && (
                    <span className="absolute -bottom-1 -right-1 bg-destructive rounded-full p-0.5">
                      <MicOff className="w-2.5 h-2.5 text-white" />
                    </span>
                  )}
                </div>
                <p className="text-xs font-semibold truncate max-w-[70px]">{myName}</p>
                {/* Volume bar */}
                <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: isMuted ? '0%' : `${myVol}%`, transitionDuration: '60ms' }}
                  />
                </div>
              </div>

              {/* VS */}
              <div className="text-xs text-muted-foreground font-bold">🎙️</div>

              {/* Opponent */}
              <div className={cn(
                'flex flex-col items-center gap-1 rounded-lg px-3 py-2 flex-1 transition-all',
                oppSpeaking ? 'bg-blue-500/10 ring-1 ring-blue-500/50' : 'bg-muted/30'
              )}>
                <Avatar className={cn('h-9 w-9 border-2 transition-all', oppSpeaking ? 'border-blue-500' : 'border-transparent')}>
                  <AvatarImage src={opponentAvatar || undefined} />
                  <AvatarFallback className="text-xs font-bold">{opponentName.substring(0,2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <p className="text-xs font-semibold truncate max-w-[70px]">{opponentName}</p>
                {/* Volume bar */}
                <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${remoteVol}%`, transitionDuration: '60ms' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Connecting state ── */}
          {status === 'connecting' && (
            <div className="flex items-center justify-center gap-2 py-3 text-muted-foreground text-xs">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>
                {myColor === 'white'
                  ? `${opponentName} ka wait kar rahe hain…`
                  : 'Connecting to opponent…'}
              </span>
            </div>
          )}

          {/* ── Controls ── */}
          <div className="flex gap-2">
            {status === 'idle' || status === 'error' ? (
              <Button
                className="flex-1 h-8 text-xs gap-1.5"
                onClick={startVoice}
              >
                <PhoneCall className="w-3.5 h-3.5" />
                Voice Call Start Karo
              </Button>
            ) : status === 'connecting' ? (
              <Button
                variant="outline"
                className="flex-1 h-8 text-xs gap-1.5"
                onClick={stopVoice}
              >
                <PhoneOff className="w-3.5 h-3.5" />
                Cancel
              </Button>
            ) : (
              <>
                <Button
                  variant={isMuted ? 'destructive' : 'outline'}
                  className={cn('flex-1 h-8 text-xs gap-1.5', pttActive && 'ring-2 ring-green-500')}
                  onClick={toggleMute}
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted
                    ? <><MicOff className="w-3.5 h-3.5" /> Muted</>
                    : <><Mic className="w-3.5 h-3.5" /> Mute</>
                  }
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 h-8 text-xs gap-1.5"
                  onClick={stopVoice}
                >
                  <PhoneOff className="w-3.5 h-3.5" /> End
                </Button>
              </>
            )}
          </div>

          {/* PTT hint */}
          {status === 'connected' && (
            <p className="text-[10px] text-muted-foreground text-center">
              Hold <kbd className="bg-muted border border-border rounded px-1 font-mono">Space</kbd> for Push-to-Talk
            </p>
          )}
        </div>
      )}
    </div>
  );
}
