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
  type Child,
  type ChildOverview,
  type ProfileUser,
} from "@/lib/api";
import { cn } from "cn";
import { useTimeGreeting } from "@/lib/time-greeting";
import { ProfileEditor } from "@/components/auth/profile-editor";
import Link from "next/link";
import { ArrowLeft, Flame, Target, Trophy, Zap } from "lucide-react";
import { getReferenceChapters } from "@/components/student/curriculum-reference";

type Tab = "children" | "profile";

export function ParentHome() {
  const [tab, setTab] = React.useState<Tab>("children");
  const user = getStoredUser();
  const { personalizedGreeting } = useTimeGreeting(user?.name);

  return (
    <RequireRole role="parent" title="Parent">
      <div className="grid gap-5">
        <div>
          <Link href="/" aria-label="Back to home" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            <ArrowLeft aria-hidden />
            Back to home
          </Link>
        </div>
        <section className="flex items-center gap-4">
          <Avatar className="size-14 ring-2 ring-primary/20 shrink-0 shadow-sm">
            {user?.avatarUrl ? (
              <AvatarImage src={user.avatarUrl} alt={user?.name || "Parent"} className="object-cover" />
            ) : null}
            <AvatarFallback className="text-base font-semibold bg-primary/10 text-primary">
              {getUserInitials(user?.name, user?.email)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 suppressHydrationWarning className="font-heading text-2xl font-semibold">
              {personalizedGreeting}
            </h1>
            <p className="text-sm text-muted-foreground">
              {user?.email ?? ""} · Track your child&apos;s learning.
            </p>
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          {(["children", "profile"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                tab === t && "border-primary bg-primary/5 text-primary"
              )}
            >
              {t === "children" ? "Children" : "Profile"}
            </button>
          ))}
        </div>

        {tab === "children" ? <ChildrenPanel /> : null}
        {tab === "profile" ? <ProfilePanel /> : null}
      </div>
    </RequireRole>
  );
}

function ChildrenPanel() {
  const [children, setChildren] = React.useState<Child[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [info, setInfo] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [studentPassword, setStudentPassword] = React.useState("");
  const [linking, setLinking] = React.useState(false);
  const [selected, setSelected] = React.useState<string | null>(null);

  async function load() {
    try {
      const d = await apiFetch<{ children: Child[] }>("/parent/children");
      setChildren(d.children);
      if (d.children.length === 0) {
        setSelected(null);
      } else if (!selected || !d.children.some((c) => c.id === selected)) {
        setSelected(d.children[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load children");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function link(e: React.FormEvent) {
    e.preventDefault();
    setLinking(true);
    setError("");
    setInfo("");
    try {
      const res = await apiFetch<{ success: boolean; message?: string }>("/parent/link", {
        method: "POST",
        body: { studentEmail: email.trim().toLowerCase(), studentPassword },
      });
      setEmail("");
      setStudentPassword("");
      setInfo(res.message || "If an active student account exists for this email, it has been linked.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to link student");
    } finally {
      setLinking(false);
    }
  }

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Link a child</CardTitle>
          <CardDescription>
            Enter your child&apos;s student email and their account password. You can view their performance only after the account is verified with that password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={link}>
            <div className="grid flex-1 gap-3">
              <label className="grid gap-1.5 text-sm font-medium">
                Student email
                <Input
                  required
                  type="email"
                  className="h-10"
                  value={email}
                  disabled={linking}
                  placeholder="child@example.com"
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Student password
                <Input
                  required
                  type="password"
                  className="h-10"
                  autoComplete="off"
                  value={studentPassword}
                  disabled={linking}
                  placeholder="Enter your child's account password"
                  onChange={(e) => setStudentPassword(e.target.value)}
                />
              </label>
            </div>
            <Button type="submit" disabled={linking}>
              {linking ? "Verifying…" : "Verify & link child"}
            </Button>
          </form>
          {error ? (
            <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/10 p-2.5 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          {info ? (
            <div className="mt-3 rounded-lg border border-primary/20 bg-primary/10 p-2.5 text-sm text-foreground">
              {info}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your children</CardTitle>
          <CardDescription>{children.length} linked</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : children.length === 0 ? (
            <p className="text-sm text-muted-foreground">No children linked yet. Use the form above to link a child account.</p>
          ) : (
            children.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelected(c.id)}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-colors hover:bg-muted",
                  selected === c.id && "border-primary bg-primary/5 ring-1 ring-primary/20"
                )}
              >
                <div>
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.email}
                    {c.grade ? ` · ${c.grade}` : ""}
                    {c.board ? ` · ${c.board}` : ""}
                  </p>
                </div>
              </button>
            ))
          )}
        </CardContent>
      </Card>

      {selected ? <ChildOverviewPanel studentId={selected} child={children.find((c) => c.id === selected)} /> : null}
    </div>
  );
}

// ---- Student progress card (display-only helpers) ----
// UI rule for the level badge: every 250 XP is one level (Lv N starts at (N-1) x 250 XP).
const XP_PER_LEVEL = 250;
const C_BLUE = "#4da3ff";
const C_GREEN = "#4ade80";
const C_AMBER = "#fbbf24";
const C_RED = "#f87171";
const RING_COLORS = [C_BLUE, C_GREEN, C_AMBER];
const SUBJECT_GUESSES = [
  "Mathematics",
  "Science",
  "English",
  "Social Science",
  "Hindi",
  "Physics",
  "Chemistry",
  "Biology",
  "Computer Science",
];
const SHORT_SUBJECT: Record<string, string> = {
  Mathematics: "Maths",
  "Social Science": "Social",
  "Computer Science": "Computer",
};

// Optional extra fields. They fill their tiles automatically if the overview API sends them.
type OverviewExtras = {
  streak?: number | null;
  badges?: { earned: number; total: number } | null;
  classRank?: number | null;
};

function subjectOfChapter(chapter: string): string | null {
  const key = chapter.trim().toLowerCase();
  for (const s of SUBJECT_GUESSES) {
    if (getReferenceChapters(s).some((c) => c.toLowerCase() === key)) return SHORT_SUBJECT[s] ?? s;
  }
  return null;
}

function avgOf(nums: number[]) {
  return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0;
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// Consecutive days (ending today, or yesterday) on which the student completed a quiz.
function computeStreak(dates: string[]) {
  const days = new Set<string>();
  dates.forEach((iso) => {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) days.add(dayKey(d));
  });
  const cursor = new Date();
  cursor.setHours(12, 0, 0, 0);
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function scoreColor(score: number) {
  return score >= 70 ? C_BLUE : score >= 50 ? C_GREEN : C_RED;
}

function ProgressRing({ value, label, color }: { value: number; label: string; color: string }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="relative size-[104px] shrink-0 sm:size-[132px]">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#111b32" strokeWidth="9" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-lg font-bold leading-none sm:text-xl" style={{ color }}>
          {value}%
        </span>
        <span className="mt-1.5 max-w-[72px] truncate text-xs text-slate-200 sm:text-sm">{label}</span>
      </div>
    </div>
  );
}

function StatTile({ icon, value, label }: { icon: React.ReactNode; value: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-[#1c2a44] bg-[#08101f] px-2 py-4 text-center sm:py-5">
      {icon}
      <div className="mt-1.5 text-2xl font-bold leading-tight text-white">{value}</div>
      <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-400 sm:text-sm">{label}</div>
    </div>
  );
}

function ChildOverviewPanel({ studentId, child }: { studentId: string; child?: Child }) {
  const [data, setData] = React.useState<ChildOverview | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let active = true;
    setData(null);
    setLoading(true);
    setError("");
    (async () => {
      try {
        const d = await apiFetch<ChildOverview>(`/parent/child/${studentId}/overview`);
        if (active) setData(d);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Failed to load child data");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [studentId]);

  if (loading) {
    return <div className="rounded-3xl border border-[#1b2a45] bg-[#0a1424] p-8 text-sm text-slate-300">Loading student progress…</div>;
  }
  if (error) {
    return <div className="rounded-3xl border border-red-900/60 bg-[#0a1424] p-5 text-sm text-red-300">{error}</div>;
  }
  if (!data) return null;

  // ---- everything below is calculated from the student's real data ----
  const extras = data as unknown as OverviewExtras;
  const student = data.student;
  const name = student.name || child?.name || "Student";
  const rawGrade = student.grade || child?.grade;
  const grade = rawGrade ? (/^\d+$/.test(String(rawGrade)) ? `Class ${rawGrade}` : String(rawGrade)) : "";
  const classLine = [grade, student.board || child?.board].filter(Boolean).join(" · ");

  const xp = student.xp ?? 0;
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const nextLevelXp = level * XP_PER_LEVEL;
  const xpToNext = nextLevelXp - xp;
  const xpPct = Math.max(0, Math.min(100, (xp / nextLevelXp) * 100));

  const attempts = [...(data.attempts ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const streak = typeof extras.streak === "number" ? extras.streak : computeStreak(attempts.map((a) => a.createdAt));
  const badgesText = extras.badges ? `${extras.badges.earned}/${extras.badges.total}` : "—";
  const rankText = extras.classRank ? `#${extras.classRank}` : "—";

  // Subject rings: average score per subject (falls back to the chapter name when the subject is unknown)
  const bySubject = new Map<string, number[]>();
  attempts.forEach((a) => {
    const label = subjectOfChapter(a.topic.chapter.name) ?? a.topic.chapter.name;
    bySubject.set(label, [...(bySubject.get(label) ?? []), a.score]);
  });
  const rings = Array.from(bySubject.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 3)
    .map(([label, scores]) => ({ label, value: avgOf(scores) }));

  // Topic bars: latest score of the 3 most recently practised topics
  const seen = new Set<string>();
  const topicBars: { name: string; value: number }[] = [];
  for (const a of attempts) {
    if (seen.has(a.topic.name)) continue;
    seen.add(a.topic.name);
    topicBars.push({ name: a.topic.name, value: a.score });
    if (topicBars.length === 3) break;
  }

  const focus = (data.weakTopics ?? []).slice(0, 3);
  const latestXp = attempts.find((a) => (a.xp ?? 0) > 0);

  return (
    <section
      className={cn(
        "relative rounded-[28px] border border-[#1b2a45] bg-gradient-to-br from-[#0f1d36] via-[#0a1424] to-[#09111f] p-5 text-white shadow-2xl shadow-black/30 sm:p-8",
        latestXp ? "pt-20 sm:pt-8" : ""
      )}
    >
      {latestXp ? (
        <div className="absolute -top-4 right-3 z-10 flex max-w-[calc(100%-1.5rem)] items-center gap-3 rounded-2xl border border-[#22324f] bg-[#0b1426] px-4 py-3 shadow-xl shadow-black/40 sm:right-0 sm:max-w-[340px]">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
            <Zap className="size-5 text-emerald-400" aria-hidden />
          </div>
          <div className="min-w-0">
            <div className="text-base font-bold leading-tight">+{latestXp.xp} XP</div>
            <div className="truncate text-sm text-slate-400">
              {latestXp.topic.name} · {latestXp.score}%
            </div>
          </div>
        </div>
      ) : null}

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[#12306a]/70 text-lg font-bold text-blue-200 sm:size-[72px] sm:text-xl">
            {getUserInitials(name, "")}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold tracking-tight sm:text-3xl">{name}</h2>
            {classLine ? <p className="mt-0.5 text-sm text-slate-400 sm:text-lg">{classLine}</p> : null}
          </div>
        </div>
        <span className="hidden shrink-0 items-center gap-2 self-end rounded-full bg-amber-400/10 px-4 py-2 text-base font-bold text-amber-300 sm:inline-flex">
          <Trophy className="size-4" aria-hidden />
          Lv {level}
        </span>
      </div>
      <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-400/10 px-3 py-1.5 text-sm font-bold text-amber-300 sm:hidden">
        <Trophy className="size-4" aria-hidden />
        Lv {level}
      </span>

      {/* XP bar */}
      <div className="mt-5 sm:mt-6">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-lg font-bold sm:text-xl">{xp.toLocaleString()} XP</span>
          <span className="text-sm text-slate-400 sm:text-lg">
            {xpToNext} XP to Lv {level + 1}
          </span>
        </div>
        <div className="mt-2.5 h-3 overflow-hidden rounded-full bg-[#121c33]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#4da3ff] via-[#38d0e0] to-[#4ade80]"
            style={{ width: `${xpPct}%` }}
          />
        </div>
      </div>

      {/* Streak / badges / rank */}
      <div className="mt-5 grid grid-cols-3 gap-3 sm:gap-4">
        <StatTile icon={<Flame className="size-6" style={{ color: C_RED }} aria-hidden />} value={streak} label="Day streak" />
        <StatTile icon={<Trophy className="size-6" style={{ color: C_AMBER }} aria-hidden />} value={badgesText} label="Badges" />
        <StatTile icon={<Trophy className="size-6" style={{ color: C_BLUE }} aria-hidden />} value={rankText} label="Class rank" />
      </div>

      {/* Subject rings */}
      <div className="mt-5 rounded-2xl border border-[#1c2a44] bg-[#0a1324] p-4 sm:p-5">
        {rings.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            Subject scores will appear once the student completes a quiz.
          </p>
        ) : (
          <div className="flex flex-wrap items-center justify-around gap-4">
            {rings.map((r, i) => (
              <ProgressRing key={r.label} value={r.value} label={r.label} color={RING_COLORS[i % RING_COLORS.length]} />
            ))}
          </div>
        )}
      </div>

      {/* Topic bars */}
      {topicBars.length > 0 ? (
        <div className="mt-6 grid gap-5">
          {topicBars.map((t) => (
            <div key={t.name}>
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-base font-semibold text-slate-100 sm:text-lg">{t.name}</span>
                <span className="shrink-0 text-sm text-slate-400 sm:text-lg">{t.value}%</span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#121c33]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.max(0, Math.min(100, t.value))}%`, backgroundColor: scoreColor(t.value) }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Focus next */}
      <div className="mt-6 rounded-2xl border border-red-400/35 bg-gradient-to-br from-[#1b1626] to-[#14121f] p-4 sm:p-5">
        <div className="flex items-center gap-2.5 font-bold uppercase tracking-wide text-red-400">
          <Target className="size-5" aria-hidden />
          Focus next
        </div>
        {focus.length === 0 ? (
          <p className="mt-3 text-base text-slate-300">No weak topics right now. Great job!</p>
        ) : (
          <div className="mt-3 grid gap-2.5">
            {focus.map((w) => (
              <div key={w.topicId} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-base text-slate-100 sm:text-lg">
                  {w.chapterName} — {w.topicName}
                </span>
                <span className="shrink-0 text-base font-bold text-red-400 sm:text-lg">{w.score}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ProfilePanel() {
  return <ProfileEditor role="parent" showXp={false} />;
}

