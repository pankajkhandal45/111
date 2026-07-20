import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { getBaseUrl } from '@workspace/api-client-react';

export interface OnlineFriend {
  id: number;
  username: string;
  avatar: string | null;
  isOnline: boolean;
  lastSeen: string | null;
  ratings: { bullet: number; blitz: number; rapid: number; classical: number };
}

export function useOnlineFriends() {
  const { token } = useAuth();

  return useQuery<OnlineFriend[]>({
    queryKey: ['friends', 'online'],
    queryFn: async () => {
      const base = getBaseUrl().replace(/\/$/, '');
      const res = await fetch(`${base}/api/friends`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      const all: OnlineFriend[] = await res.json();
      return all;
    },
    enabled: !!token,
    refetchInterval: 2 * 60_000,  // har 2 min mein check karo (pehle 30s tha)
    staleTime: 90_000,             // 90s tak cached data use karo
  });
}
