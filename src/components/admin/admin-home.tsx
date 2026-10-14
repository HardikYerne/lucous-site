"use client";

import * as React from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RequireRole } from "@/components/auth/require-role";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  apiFetch,
  getStoredUser,
  getUserInitials,
  type AdminStats,
  type AdminUser,
  type Course,
  type ProfileUser,
} from "@/lib/api";
import { cn } from "cn";
import { useTimeGreeting } from "@/lib/time-greeting";
import { ProfileEditor } from "@/components/auth/profile-editor";
import { TeacherApplicationsPanel } from "./teacher-applications-panel";

type Tab = "overview" | "applications" | "users" | "courses" | "profile";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "applications", label: "Teacher Applications" },
  { id: "users", label: "Users" },
  { id: "courses", label: "Courses" },
  { id: "profile", label: "Profile" },
];

export function AdminHome() {
  const [tab, setTab] = React.useState<Tab>("overview");
  const user = getStoredUser();
  const { personalizedGreeting } = useTimeGreeting(user?.name);

  return (
    <RequireRole role="admin" title="Admin">
      <div className="grid gap-5">
        <section className="flex items-center gap-4">
          <Avatar className="size-14 ring-2 ring-primary/20 shrink-0 shadow-sm">
            {user?.avatarUrl ? (
              <AvatarImage src={user.avatarUrl} alt={user?.name || "Admin"} className="object-cover" />
            ) : null}
            <AvatarFallback className="text-base font-semibold bg-primary/10 text-primary">
              {getUserInitials(user?.name, user?.email)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 suppressHydrationWarning className="font-heading text-2xl font-semibold">
              {personalizedGreeting} · Platform console
            </h1>
            <p className="text-sm text-muted-foreground">{user?.email ?? ""}</p>
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                tab === t.id && "border-primary bg-primary/5 text-primary"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "overview" ? <OverviewPanel /> : null}
        {tab === "applications" ? <TeacherApplicationsPanel /> : null}
        {tab === "users" ? <UsersPanel /> : null}
        {tab === "courses" ? <CoursesPanel /> : null}
        {tab === "profile" ? <ProfilePanel /> : null}
      </div>
    </RequireRole>
  );
}

function OverviewPanel() {
  const [stats, setStats] = React.useState<AdminStats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const d = await apiFetch<{ stats: AdminStats }>("/admin/stats");
        if (active) setStats(d.stats);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Failed to load stats");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!stats) return null;

  const tiles: { label: string; value: number }[] = [
    { label: "Users", value: stats.users },
    { label: "Students", value: stats.students },
    { label: "Teachers", value: stats.teachers },
    { label: "Parents", value: stats.parents },
    { label: "Admins", value: stats.admins },
    { label: "Courses", value: stats.courses },
    { label: "Enrollments", value: stats.enrollments },
    { label: "Attempts", value: stats.attempts },
    { label: "Questions", value: stats.questions },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tiles.map((t) => (
        <Card key={t.label}>
          <CardContent className="pt-1">
            <p className="text-xs text-muted-foreground">{t.label}</p>
            <p className="font-heading text-2xl font-semibold">{t.value}</p>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

function UsersPanel() {
  const [role, setRole] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [users, setUsers] = React.useState<AdminUser[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const timer = setTimeout(() => {
      (async () => {
        try {
          const params = new URLSearchParams();
          if (role) params.set("role", role);
          if (search.trim()) params.set("q", search.trim());
          const queryStr = params.toString() ? `?${params.toString()}` : "";
          const d = await apiFetch<{ users: AdminUser[] }>(`/admin/users${queryStr}`);
          if (active) setUsers(d.users);
        } catch (e) {
          if (active) setError(e instanceof Error ? e.message : "Failed to load users");
        } finally {
          if (active) setLoading(false);
        }
      })();
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [role, search]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>User Directory</CardTitle>
            <CardDescription>
              {loading ? "Searching users…" : `${users.length} user${users.length === 1 ? "" : "s"} found`}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="h-9 w-48 text-sm"
              placeholder="Search name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="">All roles</option>
              <option value="STUDENT">Students</option>
              <option value="TEACHER">Teachers</option>
              <option value="PARENT">Parents</option>
              <option value="ADMIN">Admins</option>
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-2">
        {error ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {loading ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Loading users…</p>
        ) : users.length === 0 ? (
          <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
            {search || role ? "No users matching the specified filters." : "No registered users found."}
          </div>
        ) : (
          users.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{u.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {u.email}
                  {u.grade ? ` · ${u.grade}` : ""}
                  {u.board ? ` · ${u.board}` : ""}
                  {u.school ? ` · ${u.school}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{u.role}</Badge>
                {u.isVerified ? <Badge variant="secondary">verified</Badge> : null}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function CoursesPanel() {
  const [courses, setCourses] = React.useState<Course[]>([]);
  const [search, setSearch] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const timer = setTimeout(() => {
      (async () => {
        try {
          const params = new URLSearchParams();
          if (search.trim()) params.set("q", search.trim());
          const queryStr = params.toString() ? `?${params.toString()}` : "";
          const d = await apiFetch<{ courses: (Course & { teacher?: { name: string } })[] }>(`/admin/courses${queryStr}`);
          if (active) setCourses(d.courses);
        } catch (e) {
          if (active) setError(e instanceof Error ? e.message : "Failed to load courses");
        } finally {
          if (active) setLoading(false);
        }
      })();
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Course Catalog</CardTitle>
            <CardDescription>
              {loading ? "Searching courses…" : `${courses.length} course${courses.length === 1 ? "" : "s"} total`}
            </CardDescription>
          </div>
          <Input
            className="h-9 w-56 text-sm"
            placeholder="Search by title, subject, board…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </CardHeader>
      <CardContent className="grid gap-2">
        {error ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {loading ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Loading courses…</p>
        ) : courses.length === 0 ? (
          <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
            {search ? "No courses matching your search." : "No courses have been created yet."}
          </div>
        ) : (
          courses.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{c.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {c.subject} · {c.board} · by {c.teacher?.name ?? "—"} · {c._count?.enrollments ?? 0} enrolled
                </p>
              </div>
              <Badge variant={c.price > 0 ? "secondary" : "outline"}>
                {c.price > 0 ? `₹${(c.price / 100).toFixed(0)}` : "Free"}
              </Badge>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function ProfilePanel() {
  return <ProfileEditor role="admin" showXp={false} />;
}
