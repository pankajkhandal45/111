import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, User, Lock, Globe, Trash2, Upload, X } from 'lucide-react';

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
    return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!user) return null;

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      const res = await fetch('/api/users/me', {
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
      queryClient.invalidateQueries({ queryKey: ['me'] });
      toast({ title: 'Profile updated successfully!' });
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setIsSavingProfile(false);
    }
  }

  // Convert local image file → base64 and save immediately
  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Sirf image files allowed hain', variant: 'destructive' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'Image 2MB se chhoti honi chahiye', variant: 'destructive' });
      return;
    }
    setIsUploadingImage(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      // Update local preview immediately
      setProfileForm(f => ({ ...f, avatar: base64 }));
      // Save to server right away
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ avatar: base64 }),
      });
      if (!res.ok) throw new Error('Upload failed');
      queryClient.invalidateQueries({ queryKey: ['me'] });
      toast({ title: '✅ Profile photo update ho gayi!' });
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
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      toast({ title: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }
    setIsSavingPassword(true);
    try {
      const res = await fetch('/api/users/me/password', {
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
      toast({ title: 'Password changed successfully!' });
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setIsSavingPassword(false);
    }
  }

  async function deleteAccount() {
    if (!confirm('Are you sure? This will permanently delete your account and all data.')) return;
    try {
      const res = await fetch('/api/users/me', {
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
    <div className="max-w-2xl mx-auto space-y-8 py-4">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your account and preferences</p>
      </div>

      {/* Profile Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" /> Profile
          </CardTitle>
          <CardDescription>Update your public profile information</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="space-y-5">
            {/* Avatar Upload Section */}
            <div className="flex items-start gap-4">
              {/* Avatar Preview with upload overlay */}
              <div className="relative group flex-shrink-0">
                <Avatar className="h-20 w-20 border-2 border-muted">
                  <AvatarImage src={profileForm.avatar || undefined} alt={user.username} />
                  <AvatarFallback className="text-2xl font-bold">
                    {user.username.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {/* Hover overlay */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingImage}
                  className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  {isUploadingImage
                    ? <Loader2 className="h-5 w-5 text-white animate-spin" />
                    : <Upload className="h-5 w-5 text-white" />}
                </button>
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </div>

              <div className="flex-1 space-y-2">
                <div>
                  <p className="text-sm font-medium">Profile Photo</p>
                  <p className="text-xs text-muted-foreground">Photo par click karke local image upload karo (max 2MB)</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingImage}
                  className="w-full"
                >
                  {isUploadingImage
                    ? <><Loader2 className="mr-2 h-3 w-3 animate-spin" />Uploading...</>
                    : <><Upload className="mr-2 h-3 w-3" />Device se photo choose karo</>}
                </Button>
                {/* Optional: manual URL override */}
                {profileForm.avatar && !profileForm.avatar.startsWith('data:') && (
                  <div className="flex items-center gap-1">
                    <Input
                      placeholder="Ya avatar URL paste karo"
                      value={profileForm.avatar}
                      onChange={e => setProfileForm(f => ({ ...f, avatar: e.target.value }))}
                      className="text-xs h-7"
                    />
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0"
                      onClick={() => setProfileForm(f => ({ ...f, avatar: '' }))}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                {profileForm.avatar && (
                  <Button type="button" variant="ghost" size="sm" className="text-xs text-muted-foreground h-6 px-2"
                    onClick={() => setProfileForm(f => ({ ...f, avatar: '' }))}>
                    <X className="h-3 w-3 mr-1" /> Photo hatao
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={profileForm.username}
                onChange={e => setProfileForm(f => ({ ...f, username: e.target.value }))}
                minLength={3}
                maxLength={20}
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="bio">Bio</Label>
              <Input
                id="bio"
                placeholder="Tell others about yourself..."
                value={profileForm.bio}
                onChange={e => setProfileForm(f => ({ ...f, bio: e.target.value }))}
                maxLength={200}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="country" className="flex items-center gap-1">
                <Globe className="h-3 w-3" /> Country
              </Label>
              <Input
                id="country"
                placeholder="e.g. India"
                value={profileForm.country}
                onChange={e => setProfileForm(f => ({ ...f, country: e.target.value }))}
              />
            </div>

            <Button type="submit" disabled={isSavingProfile} className="w-full">
              {isSavingProfile ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Save Profile'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Password Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" /> Change Password
          </CardTitle>
          <CardDescription>Update your login password</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={savePassword} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={passwordForm.currentPassword}
                onChange={e => setPasswordForm(f => ({ ...f, currentPassword: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={passwordForm.newPassword}
                onChange={e => setPasswordForm(f => ({ ...f, newPassword: e.target.value }))}
                minLength={6}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={e => setPasswordForm(f => ({ ...f, confirmPassword: e.target.value }))}
                required
              />
            </div>
            <Button type="submit" disabled={isSavingPassword} className="w-full">
              {isSavingPassword ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Changing...</> : 'Change Password'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" /> Danger Zone
          </CardTitle>
          <CardDescription>Irreversible and destructive actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg border border-destructive/30 bg-destructive/5">
            <div>
              <p className="font-medium text-sm">Delete Account</p>
              <p className="text-xs text-muted-foreground">Permanently delete your account and all your data</p>
            </div>
            <Button variant="destructive" size="sm" onClick={deleteAccount}>
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
