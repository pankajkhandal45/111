import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

export function useHeartbeat() {
  const { token } = useAuth();

  useEffect(() => {
    if (!token) return;

    const ping = () => {
      fetch('/api/auth/heartbeat', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    };

    ping();
    const interval = setInterval(ping, 30_000);
    return () => clearInterval(interval);
  }, [token]);
}
