import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { getGetMeQueryKey, getBaseUrl } from '@workspace/api-client-react';
import { 
  Loader2, 
  User, 
  Lock, 
  Globe, 
  Trash2, 
  Upload, 
  X, 
  Sparkles, 
  CheckCircle2, 
  ShieldAlert,
  Camera
} from 'lucide-react';

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80',
];

export default function Settings() {
  const { user, logout, isLoading: isAuthLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const token = localStorage.getItem('chess_token');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const [profileForm, setProfileForm] = useState({
    username: '',
    bio: '',
    country: '',
    avatar: '',
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      setLocation('/login');
      return;
    }
    if (user) {
      setProfileForm({
        username: user.username || '',
        bio: (user as any).bio || '',
        country: (user as any).country || '',
        avatar: user.avatar || '',
      });
    }
  }, [user, isAuthLoading, setLocation]);

  if (isAuthLoading) {
    return <div className="flex justify-center p-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!user) return null;

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setIsSavingProfile(true);
    const base = getBaseUrl().replace(/\/$/, '');
    try {
      const res = await fetch(`${base}/api/users/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          username: profileForm.username,
          bio: profileForm.bio,
          country: profileForm.country,
          avatar: profileForm.avatar,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Update failed');
      }
      const updatedUser = await res.json();
      queryClient.setQueryData(getGetMeQueryKey(), updatedUser);
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      toast({ title: '✅ Profile details updated!' });
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Only image files are allowed', variant: 'destructive' });
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast({ title: 'Image must be under 3MB', variant: 'destructive' });
      return;
    }
    setIsUploadingImage(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          const MAX = 240;
          let { width, height } = img;
          if (width > height) {
            if (width > MAX) { height = Math.round(height * MAX / width); width = MAX; }
          } else {
            if (height > MAX) { width = Math.round(width * MAX / height); height = MAX; }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = reject;
        img.src = objectUrl;
      });

      setProfileForm(f => ({ ...f, avatar: base64 }));
      const base = getBaseUrl().replace(/\/$/, '');
      const res = await fetch(`${base}/api/users/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ avatar: base64 }),
      });
      if (!res.ok) throw new Error('Upload failed');
      const updatedUser = await res.json().catch(() => null);
      if (updatedUser) {
        queryClient.setQueryData(getGetMeQueryKey(), updatedUser);
      }
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      toast({ title: '✅ Profile photo updated successfully!' });
    } catch (err: any) {
      toast({ title: err.message || 'Upload failed', variant: 'destructive' });
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({ title: 'New passwords do not match', variant: 'destructive' });
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      toast({ title: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }
    setIsSavingPassword(true);
    const base = getBaseUrl().replace(/\/$/, '');
    try {
      const res = await fetch(`${base}/api/users/me/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Password change failed');
      }
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast({ title: '✅ Password changed successfully!' });
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setIsSavingPassword(false);
    }
  }

  async function deleteAccount() {
    if (!confirm('Are you sure you want to permanently delete your account? All match history and progress will be deleted.')) return;
    const base = getBaseUrl().replace(/\/$/, '');
    try {
      const res = await fetch(`${base}/api/users/me`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to delete account');
      logout();
      setLocation('/');
      toast({ title: 'Account deleted' });
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' });
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-8 pb-16">
      {/* ── Settings Header ── */}
      <div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Account Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Customize your profile, preferences, and account security
        </p>
      </div>

      {/* ── Tabs Container ── */}
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid grid-cols-3 w-full h-12 p-1 bg-muted/60 rounded-2xl">
          <TabsTrigger value="profile" className="rounded-xl font-bold flex items-center justify-center gap-2">
            <User className="w-4 h-4" /> Profile Info
          </TabsTrigger>
          <TabsTrigger value="security" className="rounded-xl font-bold flex items-center justify-center gap-2">
            <Lock className="w-4 h-4" /> Security
          </TabsTrigger>
          <TabsTrigger value="danger" className="rounded-xl font-bold flex items-center justify-center gap-2 text-rose-500 data-[state=active]:text-rose-500">
            <ShieldAlert className="w-4 h-4" /> Danger Zone
          </TabsTrigger>
        </TabsList>

        {/* ── Profile Info Tab ── */}
        <TabsContent value="profile" className="mt-6 space-y-6">
          <Card className="border-border/60 shadow-md">
            <CardHeader>
              <CardTitle className="text-xl font-extrabold">Public Profile</CardTitle>
              <CardDescription>Manage how other players see you across ChessHub</CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Photo & Presets */}
              <div className="space-y-4 bg-muted/30 p-5 rounded-2xl border border-border/40">
                <Label className="text-sm font-bold">Profile Picture</Label>

                <div className="flex flex-col sm:flex-row items-center gap-5">
                  {/* Photo Preview with Upload trigger */}
                  <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                    <Avatar className="h-24 w-24 border-4 border-background shadow-lg ring-2 ring-primary/30">
                      <AvatarImage src={profileForm.avatar || undefined} alt={user.username} />
                      <AvatarFallback className="text-3xl font-black bg-primary/20 text-primary">
                        {user.username.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute inset-0 rounded-full bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      {isUploadingImage ? (
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                      ) : (
                        <>
                          <Camera className="w-6 h-6 text-white mb-1" />
                          <span className="text-[10px] text-white font-bold">Change</span>
                        </>
                      )}
                    </div>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />

                  <div className="flex-1 space-y-3 text-center sm:text-left">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="font-bold rounded-xl"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingImage}
                      >
                        {isUploadingImage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        Upload Custom Photo
                      </Button>
                      {profileForm.avatar && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs text-rose-500 hover:text-rose-600 rounded-xl"
                          onClick={() => setProfileForm(f => ({ ...f, avatar: '' }))}
                        >
                          <X className="w-3.5 h-3.5 mr-1" /> Remove Photo
                        </Button>
                      )}
                    </div>

                    {/* Preset Avatars Selection */}
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold mb-2">Or choose a preset avatar:</p>
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                        {PRESET_AVATARS.map((url, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setProfileForm(f => ({ ...f, avatar: url }))}
                            className={`relative rounded-full overflow-hidden border-2 transition-all duration-200 hover:scale-110 ${
                              profileForm.avatar === url ? 'border-primary ring-2 ring-primary/40 scale-105' : 'border-border/60'
                            }`}
                          >
                            <img src={url} alt={`Preset ${idx}`} className="w-9 h-9 object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Profile Details Form */}
              <form onSubmit={saveProfile} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="username" className="font-bold">Username</Label>
                  <Input
                    id="username"
                    value={profileForm.username}
                    onChange={e => setProfileForm(f => ({ ...f, username: e.target.value }))}
                    minLength={3}
                    maxLength={20}
                    className="h-11 rounded-xl"
                    required
                  />
                  <p className="text-xs text-muted-foreground">3 to 20 characters. Must be unique.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio" className="font-bold">Bio / About You</Label>
                  <Input
                    id="bio"
                    placeholder="Grandmaster in the making..."
                    value={profileForm.bio}
                    onChange={e => setProfileForm(f => ({ ...f, bio: e.target.value }))}
                    maxLength={200}
                    className="h-11 rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country" className="font-bold flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-primary" /> Country
                  </Label>
                  <Input
                    id="country"
                    placeholder="e.g. India, United States"
                    value={profileForm.country}
                    onChange={e => setProfileForm(f => ({ ...f, country: e.target.value }))}
                    className="h-11 rounded-xl"
                  />
                </div>

                <Button type="submit" size="lg" disabled={isSavingProfile} className="w-full font-bold h-12 rounded-xl shadow-md">
                  {isSavingProfile ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Saving Changes...</> : <><CheckCircle2 className="mr-2 h-5 w-5" /> Save Profile</>}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Security Tab ── */}
        <TabsContent value="security" className="mt-6">
          <Card className="border-border/60 shadow-md">
            <CardHeader>
              <CardTitle className="text-xl font-extrabold flex items-center gap-2">
                <Lock className="w-5 h-5 text-primary" /> Security & Password
              </CardTitle>
              <CardDescription>Update your password to keep your account secure</CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={savePassword} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={e => setPasswordForm(f => ({ ...f, currentPassword: e.target.value }))}
                    className="h-11 rounded-xl"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={e => setPasswordForm(f => ({ ...f, newPassword: e.target.value }))}
                    minLength={6}
                    className="h-11 rounded-xl"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={e => setPasswordForm(f => ({ ...f, confirmPassword: e.target.value }))}
                    className="h-11 rounded-xl"
                    required
                  />
                </div>

                <Button type="submit" size="lg" disabled={isSavingPassword} className="w-full font-bold h-12 rounded-xl shadow-md">
                  {isSavingPassword ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Changing Password...</> : 'Update Password'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Danger Zone Tab ── */}
        <TabsContent value="danger" className="mt-6">
          <Card className="border-rose-500/30 bg-rose-500/5 shadow-md">
            <CardHeader>
              <CardTitle className="text-xl font-extrabold text-rose-500 flex items-center gap-2">
                <Trash2 className="w-5 h-5" /> Danger Zone
              </CardTitle>
              <CardDescription>Irreversible and permanent account actions</CardDescription>
            </CardHeader>

            <CardContent>
              <div className="p-5 rounded-2xl border border-rose-500/20 bg-card space-y-4">
                <div>
                  <h3 className="font-extrabold text-base text-foreground">Delete Account</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Once you delete your account, there is no going back. All rating data, game history, and settings will be permanently erased.
                  </p>
                </div>

                <Button variant="destructive" size="lg" className="w-full font-bold h-12 rounded-xl" onClick={deleteAccount}>
                  <Trash2 className="w-5 h-5 mr-2" /> Delete Account Permanently
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
