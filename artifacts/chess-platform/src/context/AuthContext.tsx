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
  const queryClient = useQueryClient();

  const setToken = (newToken: string | null) => {
    if (newToken) {
      localStorage.setItem("chess_token", newToken);
    } else {
      localStorage.removeItem("chess_token");
    }
    setTokenState(newToken);
  };

  const logout = () => {
    localStorage.removeItem("chess_token");
    setTokenState(null);
    queryClient.clear();
  };

  const { data: user, isLoading } = useGetMe({
    query: {
      enabled: !!token,
      retry: false,
    },
  });

  // If token is invalid, clear it
  useEffect(() => {
    if (!isLoading && token && !user) {
      setToken(null);
    }
  }, [isLoading, token, user]);

  return (
    <AuthContext.Provider value={{ user: user || null, token, setToken, logout, isLoading }}>
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
