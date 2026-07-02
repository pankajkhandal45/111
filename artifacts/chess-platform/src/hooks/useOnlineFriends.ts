import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';

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
      const res = await fetch('/api/friends', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      const all: OnlineFriend[] = await res.json();
      return all;
    },
    enabled: !!token,
    refetchInterval: 30_000,
    staleTime: 25_000,
  });
}
