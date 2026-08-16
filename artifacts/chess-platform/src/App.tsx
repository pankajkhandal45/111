import { Switch, Route, Redirect, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ActiveGameProvider } from "@/context/ActiveGameContext";
import { Layout } from "@/components/Layout";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Suspense, lazy, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { getBaseUrl } from "@workspace/api-client-react";
import Home from "@/pages/Home";

import { ErrorBoundary } from "@/components/ErrorBoundary";

function ProfileRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return <PageLoader />;
  }
  if (user?.username) {
    return <Redirect to={`/profile/${user.username}`} />;
  }
  return <Redirect to="/login" />;
}

function lazyWithRetry<T extends React.ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    const pageHasBeenReloaded = window.sessionStorage.getItem('chunk_reload_done');
    try {
      const component = await componentImport();
      window.sessionStorage.removeItem('chunk_reload_done');
      return component;
    } catch (error) {
      if (!pageHasBeenReloaded) {
        window.sessionStorage.setItem('chunk_reload_done', 'true');
        window.location.reload();
      }
      throw error;
    }
  });
}

const Game = lazyWithRetry(() => import("@/pages/Game"));
const Login = lazyWithRetry(() => import("@/pages/Login"));
const Register = lazyWithRetry(() => import("@/pages/Register"));
const Play = lazyWithRetry(() => import("@/pages/Play"));
const Leaderboard = lazyWithRetry(() => import("@/pages/Leaderboard"));
const Profile = lazyWithRetry(() => import("@/pages/Profile"));
const Analysis = lazyWithRetry(() => import("@/pages/Analysis"));
const Puzzles = lazyWithRetry(() => import("@/pages/Puzzles"));
const Friends = lazyWithRetry(() => import("@/pages/Friends"));
const Admin = lazyWithRetry(() => import("@/pages/Admin"));
const Settings = lazyWithRetry(() => import("@/pages/Settings"));
const NotFound = lazyWithRetry(() => import("@/pages/not-found"));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      retryDelay: 2000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      staleTime: 60_000,       // 60s tak same data reuse karo
      gcTime: 10 * 60 * 1000, // 10 min cache
      networkMode: 'online',
    },
    mutations: {
      networkMode: 'online',
    },
  },
});

// Shows a toast if backend takes >3s to respond (Render.com cold start)
function BackendWatcher() {
  const { toast } = useToast();
  const shown = useRef(false);

  useEffect(() => {
    if (shown.current) return;
    const timer = setTimeout(() => {
      const base = getBaseUrl();
      const url = base ? `${base}/api/healthz` : '/api/healthz';
      // If healthz hasn't responded in 3s, show a warning
      fetch(url, { method: 'GET', cache: 'no-store' })
        .then(r => { if (!r.ok) throw new Error(); })
        .catch(() => {
          if (!shown.current) {
            shown.current = true;
            toast({
              title: '⏳ Server shuru ho raha hai...',
              description: 'Pehli baar thoda wait karo (~30 sec). Baad mein fast chalega.',
              duration: 15000,
            });
          }
        });
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  return null;
}

function Router() {
  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/login" component={Login} />
          <Route path="/register" component={Register} />
          <Route path="/play" component={Play} />
          <Route path="/game/:id" component={Game} />
          <Route path="/analysis/:id" component={Analysis} />
          <Route path="/puzzles" component={Puzzles} />
          <Route path="/leaderboard" component={Leaderboard} />
          <Route path="/profile" component={ProfileRedirect} />
          <Route path="/profile/:username" component={Profile} />
          <Route path="/friends" component={Friends} />
          <Route path="/admin" component={Admin} />
          <Route path="/settings" component={Settings} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="chesshub-theme">
        <AuthProvider>
          <ActiveGameProvider>
            <ErrorBoundary>
              <TooltipProvider>
                <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                  <BackendWatcher />
                  <Router />
                </WouterRouter>
                <Toaster />
              </TooltipProvider>
            </ErrorBoundary>
          </ActiveGameProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
