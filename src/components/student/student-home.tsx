"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "cn";
import {
  BookOpen,
  Gamepad2,
  PenLine,
  ClipboardList,
  Sparkles,
  User,
  KeyRound,
  Award,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { computeProgress } from "@/components/student/progress-utils";
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";
import { RequireStudent } from "@/components/student/require-student";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  apiFetch,
  getStoredUser,
  getUserInitials,
  type Attempt,
  type Board,
  type Grade,
  type Subject,
  type WeakTopic,
  type StudentProgressData,
} from "@/lib/api";
import { useSession } from "@/lib/use-session";
import { useTimeGreeting } from "@/lib/time-greeting";

const QUICK_ACTIONS = [
  { href: "/student/access", label: "Enter Code", icon: KeyRound, hint: "Teacher lesson code" },
  { href: "/student/learn", label: "Learn", icon: BookOpen, hint: "Study topics" },
  { href: "/student/play", label: "Play", icon: Gamepad2, hint: "Quick quiz game" },
  { href: "/student/practice", label: "Practice", icon: PenLine, hint: "Topic practice" },
  { href: "/student/test", label: "Test", icon: ClipboardList, hint: "Topic test" },
  { href: "/student/games", label: "Games", icon: Gamepad2, hint: "Earn XP & compete" },
  { href: "/student/tutor", label: "AI Tutor", icon: Sparkles, hint: "Ask anything" },
  { href: "/student/certificates", label: "Certificate", icon: Award, hint: "Unlock at 100%" },
  { href: "/student/profile", label: "Profile", icon: User, hint: "Your account" },
] as const;

export function StudentHome() {
  const session = useSession();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [progress, setProgress] = React.useState<StudentProgressData>({ completedCount: 0, totalContent: 0 });
  const [tutorChats, setTutorChats] = React.useState(0);
  const [weakTopics, setWeakTopics] = React.useState<WeakTopic[]>([]);
  const [results, setResults] = React.useState<Attempt[]>([]);
  const [boards, setBoards] = React.useState<Board[]>([]);
  const [classes, setClasses] = React.useState<Grade[]>([]);
  const [subjects, setSubjects] = React.useState<Subject[]>([]);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [prog, weak, res, brd, cls, subs, chats] = await Promise.all([
          apiFetch<StudentProgressData>("/student/progress"),
          apiFetch<{ weakTopics: WeakTopic[] }>("/student/weak-topics"),
          apiFetch<{ attempts: Attempt[] }>("/student/results"),
          apiFetch<{ boards: Board[] }>("/student/boards"),
          apiFetch<{ classes: Grade[] }>("/student/classes"),
          apiFetch<{ subjects: Subject[] }>("/student/subjects"),
          apiFetch<{ conversations: unknown[] }>("/ai/tutor/conversations").catch(() => ({ conversations: [] })),
        ]);
        if (!active) return;
        setProgress(prog);
        setTutorChats(chats.conversations?.length ?? 0);
        setWeakTopics(weak.weakTopics);
        setResults(res.attempts);
        setBoards(brd.boards);
        setClasses(cls.classes);
        setSubjects(subs.subjects);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const user = getStoredUser();
  const userName = user?.name ?? session?.name;
  const { personalizedGreeting } = useTimeGreeting(userName);
  // Real progress from lessons, practice/tests, games (XP) and AI Tutor use
  const summary = computeProgress(progress, tutorChats);
  const pct = summary.percent;

  return (
    <RequireStudent title="Dashboard">
      <div className="grid gap-5">
        <section className="flex items-center gap-4">
          <Avatar className="size-14 ring-2 ring-primary/20 shrink-0 shadow-sm">
            {user?.avatarUrl ? (
              <AvatarImage src={user.avatarUrl} alt={userName || "Student"} className="object-cover" />
            ) : null}
            <AvatarFallback className="text-base font-semibold bg-primary/10 text-primary">
              {getUserInitials(userName, user?.email ?? session?.email)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 suppressHydrationWarning className="font-heading text-2xl font-semibold">
              {personalizedGreeting}
            </h1>
            <p className="text-sm text-muted-foreground">
              {user?.email ?? session?.email ?? ""} · Pick up where you left off.
            </p>
          </div>
        </section>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>Learning progress</CardTitle>
                <CardDescription>
                  {loading
                    ? "Loading…"
                    : `${progress.completedCount} of ${progress.totalContent} lessons completed`}
                </CardDescription>
              </div>
              {progress.xp !== undefined && progress.xp > 0 ? (
                <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary font-semibold text-xs">
                  {progress.xp} Total XP
                </Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={pct}>
              <ProgressLabel>Completed</ProgressLabel>
              <ProgressValue />
            </Progress>
            <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground sm:grid-cols-4">
              {summary.parts.map((part) => (
                <div key={part.key}>
                  <span className="text-sm font-semibold text-foreground">
                    {part.target > 0 ? `${Math.min(part.done, part.target)}/${part.target}` : "—"}
                  </span>
                  <p>{part.label}</p>
                </div>
              ))}
            </div>
            {summary.complete ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Award className="size-4 text-primary" aria-hidden />
                  100% complete! Your certificate is ready.
                </p>
                <Link href="/student/certificates" className={buttonVariants({ size: "sm" })}>
                  Get certificate
                </Link>
              </div>
            ) : null}
            {progress.totalAttempts ? (
              <div className="grid grid-cols-2 gap-3 pt-2 text-xs text-muted-foreground sm:grid-cols-4 border-t">
                <div>
                  <span className="font-semibold text-foreground text-sm">{progress.totalAttempts}</span>
                  <p>Tests Taken</p>
                </div>
                <div>
                  <span className="font-semibold text-foreground text-sm">{progress.averageScore ?? 0}%</span>
                  <p>Avg. Score</p>
                </div>
                <div>
                  <span className="font-semibold text-foreground text-sm">{progress.masteredTopicsCount ?? 0}</span>
                  <p>Mastered (≥60%)</p>
                </div>
                <div>
                  <span className="font-semibold text-foreground text-sm">{progress.weakTopicsCount ?? 0}</span>
                  <p>Needs Revision</p>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_ACTIONS.map((action) => (
            <Link key={action.href} href={action.href} className="group">
              <Card className="h-full transition-shadow group-hover:shadow-lift">
                <CardContent className="flex flex-col gap-2 pt-1">
                  <action.icon className="size-5 text-primary" aria-hidden />
                  <span className="font-medium">{action.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {action.hint}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Available catalogue</CardTitle>
            <CardDescription>
              Boards, classes and subjects you can study
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <>
                <div className="grid gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Boards
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {boards.map((b) => (
                      <Badge key={b.id} variant="outline">
                        {b.name}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Classes
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {classes.map((c) => (
                      <Badge key={c.id} variant="outline">
                        {c.name}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="grid gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Subjects
                  </span>
                  {subjects.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No subjects yet.
                    </p>
                  ) : (
                    subjects.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium">{s.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {s.board?.name} · {s.grade?.name}
                          </p>
                        </div>
                        <Badge variant="secondary">
                          {s._count.chapters} chapters
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Weak topics</CardTitle>
              <CardDescription>Score below 60% — worth revisiting</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : weakTopics.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No weak topics. Nice work!
                </p>
              ) : (
                weakTopics.map((w) => (
                  <div
                    key={w.topicId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{w.topicName}</p>
                        {w.hasRetested && typeof w.improvement === "number" ? (
                          <Badge
                            variant="outline"
                            className={
                              w.improvement > 0
                                ? "border-brand-green/30 bg-brand-green/10 text-brand-green text-xs"
                                : "text-xs"
                            }
                          >
                            {w.improvement > 0 ? `+${w.improvement}%` : `${w.improvement}%`}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {w.chapterName} · Latest score {w.score}%
                      </p>
                    </div>
                    <Link
                      href={`/student/retest?topicId=${w.topicId}&mode=${
                        w.action === "Retest" ? "RETEST" : "PRACTICE"
                      }`}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    >
                      {w.action}
                    </Link>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>Your latest attempts</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : results.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No attempts yet. Try a Play or Practice quiz.
                </p>
              ) : (
                results.slice(0, 6).map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{a.topic.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.topic.chapter.name} · {a.mode} · {a.correct}/{a.total} correct
                      </p>
                    </div>
                    <Badge variant={a.score >= 60 ? "secondary" : "destructive"}>
                      {a.score}%
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Link
            href="/student/results"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            View all results
          </Link>
        </div>
      </div>
    </RequireStudent>
  );
}
