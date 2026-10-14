"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Camera,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import {
  apiFetch,
  getStoredUser,
  getUserInitials,
  updateProfileAvatar,
  updateStoredUser,
  type ProfileUser,
} from "@/lib/api";
import { getSession, setSession, type AuthRole } from "@/lib/auth";

export interface ProfileEditorProps {
  role?: AuthRole;
  showXp?: boolean;
}

export function ProfileEditor({ role, showXp = true }: ProfileEditorProps) {
  const [me, setMe] = React.useState<ProfileUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [avatarLoading, setAvatarLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [avatarError, setAvatarError] = React.useState("");
  const [saved, setSaved] = React.useState(false);

  const [form, setForm] = React.useState({
    name: "",
    phone: "",
    grade: "",
    board: "",
    school: "",
    subject: "",
  });

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const d = await apiFetch<{ user: ProfileUser }>("/auth/me");
        if (!active || !d?.user) return;
        setMe(d.user);
        setForm({
          name: d.user.name ?? "",
          phone: d.user.phone ?? "",
          grade: d.user.grade ?? "",
          board: d.user.board ?? "",
          school: d.user.school ?? "",
          subject: d.user.subject ?? "",
        });
        updateStoredUser(d.user);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Failed to load profile details.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    setAvatarError("");
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      setAvatarError("Please select a JPG, PNG, WebP, or GIF image.");
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setAvatarError("Profile picture must be under 3MB.");
      return;
    }

    setAvatarLoading(true);
    try {
      const res = await updateProfileAvatar(file);
      if (!res.success) {
        setAvatarError(res.message || "Failed to update profile picture.");
        return;
      }

      const updatedUser = res.user ?? { ...me, avatarUrl: res.avatarUrl };
      setMe(updatedUser as ProfileUser);
      updateStoredUser(updatedUser as ProfileUser);

      // Also sync session
      const currentSession = getSession();
      if (currentSession) {
        setSession({
          ...currentSession,
          avatarUrl: res.avatarUrl,
        });
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Avatar upload error:", err);
      setAvatarError("Unable to update picture. Please check your connection.");
    } finally {
      setAvatarLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleRemoveAvatar() {
    setAvatarError("");
    setAvatarLoading(true);
    try {
      const d = await apiFetch<{ user: ProfileUser }>("/auth/profile", {
        method: "PATCH",
        body: { avatarUrl: "" },
      });
      setMe(d.user);
      updateStoredUser(d.user);

      const currentSession = getSession();
      if (currentSession) {
        setSession({
          ...currentSession,
          avatarUrl: null,
        });
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setAvatarError("Failed to remove profile picture.");
    } finally {
      setAvatarLoading(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Full name is required.");
      return;
    }

    setSaving(true);
    setError("");
    setSaved(false);

    try {
      const d = await apiFetch<{ user: ProfileUser }>("/auth/profile", {
        method: "PATCH",
        body: form,
      });

      setMe(d.user);
      updateStoredUser(d.user);

      // Sync active session name
      const currentSession = getSession();
      if (currentSession) {
        setSession({
          ...currentSession,
          name: d.user.name,
        });
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8 text-sm text-muted-foreground gap-2">
          <Loader2 className="size-4 animate-spin text-primary" />
          Loading profile…
        </CardContent>
      </Card>
    );
  }

  const effectiveRole = (role || me?.role?.toLowerCase() || "student") as AuthRole;
  const isStudent = effectiveRole === "student";
  const isTeacher = effectiveRole === "teacher";

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle>Profile</CardTitle>
            <CardDescription>
              {me?.email} · {me?.role}
            </CardDescription>
          </div>
          {showXp && typeof me?.xp === "number" && isStudent ? (
            <Badge variant="secondary" className="w-fit text-xs font-semibold">
              {me.xp} XP
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-6">
        {/* Profile Picture Management */}
        <div className="flex flex-col sm:flex-row items-center gap-4 p-4 border rounded-lg bg-muted/20">
          <div className="relative group shrink-0">
            <Avatar className="size-20 ring-2 ring-primary/20 shadow-sm">
              {me?.avatarUrl ? (
                <AvatarImage src={me.avatarUrl} alt={me?.name || "User"} className="object-cover" />
              ) : null}
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold flex items-center justify-center">
                {getUserInitials(me?.name, me?.email)}
              </AvatarFallback>
            </Avatar>
            {avatarLoading ? (
              <div className="absolute inset-0 bg-background/70 backdrop-blur-xs rounded-full flex items-center justify-center">
                <Loader2 className="size-6 animate-spin text-primary" />
              </div>
            ) : null}
          </div>

          <div className="flex flex-col items-center sm:items-start gap-1.5 text-center sm:text-left flex-1">
            <h3 className="text-sm font-semibold">Profile Picture</h3>
            <p className="text-xs text-muted-foreground">
              PNG, JPG, WebP, or GIF up to 3MB. Displayed across dashboards, comments, and headers.
            </p>

            <div className="flex items-center gap-2 mt-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                disabled={avatarLoading}
                onChange={handleAvatarUpload}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                disabled={avatarLoading}
                onClick={() => fileInputRef.current?.click()}
              >
                {me?.avatarUrl ? (
                  <>
                    <ImageIcon className="size-3.5" />
                    Change picture
                  </>
                ) : (
                  <>
                    <Upload className="size-3.5" />
                    Upload picture
                  </>
                )}
              </Button>

              {me?.avatarUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                  disabled={avatarLoading}
                  onClick={handleRemoveAvatar}
                >
                  <Trash2 className="size-3.5 mr-1" />
                  Remove
                </Button>
              ) : null}
            </div>

            {avatarError ? (
              <p className="text-xs text-destructive mt-1">{avatarError}</p>
            ) : null}
          </div>
        </div>

        {/* Profile Information Form */}
        <form className="grid gap-4" onSubmit={save}>
          <label className="grid gap-1.5 text-sm font-medium">
            Full Name <span className="text-destructive">*</span>
            <Input
              required
              className="h-10"
              value={form.name}
              disabled={saving}
              placeholder="Your full name"
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>

          <label className="grid gap-1.5 text-sm font-medium">
            Phone Number
            <Input
              className="h-10"
              value={form.phone}
              disabled={saving}
              placeholder="e.g. 9876543210"
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </label>

          {isStudent ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium">
                Grade / Class
                <Input
                  className="h-10"
                  value={form.grade}
                  disabled={saving}
                  placeholder="e.g. Class 10"
                  onChange={(e) => setForm({ ...form, grade: e.target.value })}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Board / Curriculum
                <Input
                  className="h-10"
                  value={form.board}
                  disabled={saving}
                  placeholder="e.g. CBSE"
                  onChange={(e) => setForm({ ...form, board: e.target.value })}
                />
              </label>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium">
              School / Institution
              <Input
                className="h-10"
                value={form.school}
                disabled={saving}
                placeholder="Your school or institution"
                onChange={(e) => setForm({ ...form, school: e.target.value })}
              />
            </label>

            {isTeacher || isStudent ? (
              <label className="grid gap-1.5 text-sm font-medium">
                Subject Focus
                <Input
                  className="h-10"
                  value={form.subject}
                  disabled={saving}
                  placeholder="e.g. Mathematics, Science"
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                />
              </label>
            ) : null}
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {saved ? (
            <p className="flex items-center gap-1.5 text-sm text-brand-green font-medium">
              <CheckCircle2 className="size-4" />
              Profile updated successfully.
            </p>
          ) : null}

          <Button type="submit" className="h-10 text-sm mt-1" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin mr-2" />
                Saving…
              </>
            ) : (
              "Save profile"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
