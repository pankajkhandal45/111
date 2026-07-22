import React, { createContext, useContext, useEffect, useState } from "react";
import { useGetMe } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import type { User } from "@workspace/api-client-react/src/generated/api.schemas";

interface AuthContextType {
  user: User | null;
  token: string | null;
  setToken: (token: string | null) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem("chess_token"));
  const [cachedUser, setCachedUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem("chess_cached_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const queryClient = useQueryClient();

  const setToken = (newToken: string | null) => {
    if (newToken) {
      localStorage.setItem("chess_token", newToken);
    } else {
      localStorage.removeItem("chess_token");
      localStorage.removeItem("chess_cached_user");
      setCachedUser(null);
    }
    setTokenState(newToken);
  };

  const logout = () => {
    localStorage.removeItem("chess_token");
    localStorage.removeItem("chess_cached_user");
    setTokenState(null);
    setCachedUser(null);
    queryClient.clear();
  };

  const { data: remoteUser, isLoading: isQueryLoading, error } = useGetMe({
    query: {
      enabled: !!token,
      retry: false,
    },
  });

  // Sync fresh server user to state and localStorage
  useEffect(() => {
    if (remoteUser) {
      setCachedUser(remoteUser);
      try {
        localStorage.setItem("chess_cached_user", JSON.stringify(remoteUser));
      } catch { /* ignore quota errors */ }
    }
  }, [remoteUser]);

  // Only clear token if we explicitly get a 401 Unauthorized error
  useEffect(() => {
    if (error && (error as any).status === 401) {
      setToken(null);
    }
  }, [error]);

  const activeUser = remoteUser || cachedUser;
  // We are loading ONLY if we have a token but neither remoteUser nor cachedUser is ready yet
  const isLoading = !!token && !activeUser && isQueryLoading;

  return (
    <AuthContext.Provider value={{ user: activeUser || null, token, setToken, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
