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
    refetchInterval: 5000,  // Check every 5 seconds for real-time online status
    staleTime: 0,           // 0ms stale time so status updates immediately
  });
}
