import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { Layout } from "@/components/Layout";
import NotFound from "@/pages/not-found";

import Home from "@/pages/Home";
import Game from "@/pages/Game";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Play from "@/pages/Play";
import Leaderboard from "@/pages/Leaderboard";
import Profile from "@/pages/Profile";
import Analysis from "@/pages/Analysis";
import Puzzles from "@/pages/Puzzles";
import Friends from "@/pages/Friends";
import Admin from "@/pages/Admin";
import Settings from "@/pages/Settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Layout>
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
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
