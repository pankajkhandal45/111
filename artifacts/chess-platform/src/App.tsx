import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { Layout } from "@/components/Layout";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Suspense, lazy, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { getBaseUrl } from "@workspace/api-client-react";

const Home = lazy(() => import("@/pages/Home"));
const Game = lazy(() => import("@/pages/Game"));
const Login = lazy(() => import("@/pages/Login"));
const Register = lazy(() => import("@/pages/Register"));
const Play = lazy(() => import("@/pages/Play"));
const Leaderboard = lazy(() => import("@/pages/Leaderboard"));
const Profile = lazy(() => import("@/pages/Profile"));
const Analysis = lazy(() => import("@/pages/Analysis"));
const Puzzles = lazy(() => import("@/pages/Puzzles"));
const Friends = lazy(() => import("@/pages/Friends"));
const Admin = lazy(() => import("@/pages/Admin"));
const Settings = lazy(() => import("@/pages/Settings"));
const NotFound = lazy(() => import("@/pages/not-found"));

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
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <BackendWatcher />
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
