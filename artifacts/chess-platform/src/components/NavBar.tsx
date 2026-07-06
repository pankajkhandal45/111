import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/context/AuthContext';
import { useGetNotifications } from '@workspace/api-client-react';
import { useOnlineFriends } from '@/hooks/useOnlineFriends';
import { useTheme } from '@/components/ThemeProvider';
import { Bell, User, Settings, LogOut, ShieldCheck, Users, Sun, Moon, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export function NavBar() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { theme, setTheme } = useTheme();
  
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  const { data: notifications } = useGetNotifications({
    query: { enabled: !!user }
  });
  const { data: friends } = useOnlineFriends();

  const unreadCount = notifications?.filter(n => !n.isRead).length || 0;
  const onlineCount = friends?.filter(f => f.isOnline).length || 0;

  const NavLinks = () => (
    <>
      <Link href="/play" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Play</Link>
      <Link href="/puzzles" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Puzzles</Link>
      <Link href="/leaderboard" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Leaderboard</Link>
      <Link href="/friends" className="relative text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
        Friends
        {onlineCount > 0 && (
          <span className="inline-flex items-center justify-center rounded-full bg-green-500 text-white text-[10px] font-bold w-4 h-4">{onlineCount}</span>
        )}
      </Link>
      {user && (
        <Link href="/settings" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
          Settings
        </Link>
      )}
      {user?.role === 'admin' && (
        <Link href="/admin" className="text-sm font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
          <ShieldCheck className="h-4 w-4" /> Admin
        </Link>
      )}
    </>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between mx-auto px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl text-primary">♔</span>
            <span className="font-bold text-lg hidden sm:inline-block">ChessHub</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <NavLinks />
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>

          {user ? (
            <>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="absolute -top-1 -right-1 px-1 min-w-[1.25rem] h-5">
                    {unreadCount}
                  </Badge>
                )}
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.avatar || undefined} alt={user.username} />
                      <AvatarFallback>{user.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    {/* green dot = you are online */}
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-background" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user.username}</p>
                      <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>

                  {/* Online friends mini-list */}
                  {onlineCount > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <div className="px-2 py-1.5">
                        <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                          {onlineCount} friend{onlineCount !== 1 ? 's' : ''} online
                        </p>
                        <div className="space-y-1.5 max-h-28 overflow-y-auto">
                          {friends?.filter(f => f.isOnline).slice(0, 4).map(f => (
                            <Link key={f.id} href={`/profile/${f.username}`} className="flex items-center gap-2 hover:bg-muted/50 rounded px-1 py-0.5 transition-colors">
                              <div className="relative flex-shrink-0">
                                <Avatar className="h-5 w-5">
                                  <AvatarImage src={f.avatar || undefined} />
                                  <AvatarFallback className="text-[9px]">{f.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <span className="absolute bottom-0 right-0 w-1.5 h-1.5 rounded-full bg-green-500 border border-background" />
                              </div>
                              <span className="text-xs font-medium truncate">{f.username}</span>
                            </Link>
                          ))}
                          {onlineCount > 4 && (
                            <Link href="/friends" className="text-xs text-muted-foreground px-1">+{onlineCount - 4} more</Link>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={`/profile/${user.username}`} className="cursor-pointer w-full flex items-center">
                      <User className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="cursor-pointer w-full flex items-center">
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Settings</span>
                    </Link>
                  </DropdownMenuItem>
                  {installPrompt && (
                    <DropdownMenuItem onClick={handleInstallClick} className="cursor-pointer w-full flex items-center">
                      <Download className="mr-2 h-4 w-4" />
                      <span>Install App</span>
                    </DropdownMenuItem>
                  )}
                  {user.role === 'admin' && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/admin" className="cursor-pointer w-full flex items-center text-primary">
                          <ShieldCheck className="mr-2 h-4 w-4" />
                          <span>Admin Panel</span>
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => { logout(); setLocation('/'); }}
                    className="text-destructive focus:bg-destructive/10 cursor-pointer"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" asChild>
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild>
                <Link href="/register">Sign up</Link>
              </Button>
            </div>
          )}


        </div>
      </div>
    </header>
  );
}
