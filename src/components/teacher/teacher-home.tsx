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
import {
  apiFetch,
  getStoredUser,
  updateStoredUser,
  type Course,
  type GeneratedQuestion,
  type ProfileUser,
} from "@/lib/api";
import { cn } from "cn";
import { useTimeGreeting } from "@/lib/time-greeting";
import { MaterialUploadPanel } from "./material-upload";
import { LessonDraftsPanel } from "./lesson-drafts-panel";
import { AssessmentsPanel } from "./assessments-panel";
import { PublishedContentList } from "./published-content-list";
import { ClassCodePanel } from "./class-code-panel";
import { ProfileEditor } from "@/components/auth/profile-editor";
import { TeacherApplicationPanel } from "./teacher-application-panel";
import { fetchTeacherApplication, type TeacherApplication } from "@/lib/api";

type Tab = "courses" | "students" | "materials" | "lessons" | "assessments" | "published" | "ai" | "application" | "profile";

const TABS: { id: Tab; label: string }[] = [
  { id: "students", label: "Students" },
  { id: "materials", label: "Learning Materials" },
  { id: "lessons", label: "AI Lessons" },
  { id: "assessments", label: "AI Assessments & Games" },
  { id: "published", label: "Published & Codes" },
  { id: "ai", label: "AI Questions" },
  { id: "application", label: "Application & Verification" },
  { id: "profile", label: "Profile" },
];

interface TeacherStudent {
  id: string;
  name: string;
  email: string;
  grade?: string | null;
  board?: string | null;
  attempts: number;
  averageScore: number;
  courses: string[];
}

export function TeacherHome() {
  const [tab, setTab] = React.useState<Tab>("materials");
  const [app, setApp] = React.useState<TeacherApplication | null>(null);
  const [loadingApp, setLoadingApp] = React.useState(true);
  // Once the admin has approved this teacher, remember it on this device so a later login (or a slow /
  // failed status request) never shows "Approval Pending" again. The server status always wins when it answers.
  const [rememberedApproved, setRememberedApproved] = React.useState(false);
  const user = getStoredUser();
  const { personalizedGreeting } = useTimeGreeting(user?.name);
  const approvedKey = user?.id ?? user?.email ? `lucous_teacher_approved:${user?.id ?? user?.email}` : "";

  function applyApplication(next: TeacherApplication) {
    setApp(next);
    const approved = next.status === "APPROVED";
    setRememberedApproved(approved);
    if (approvedKey && typeof window !== "undefined") {
      if (approved) window.localStorage.setItem(approvedKey, "1");
      else window.localStorage.removeItem(approvedKey);
    }
  }

  React.useEffect(() => {
    let active = true;
    const remembered =
      !!approvedKey && typeof window !== "undefined" && window.localStorage.getItem(approvedKey) === "1";
    if (remembered) setRememberedApproved(true);
    (async () => {
      try {
        const res = await fetchTeacherApplication();
        if (active && res.application) {
          applyApplication(res.application);
          if (res.application.status !== "APPROVED") {
            setTab("application");
          }
        }
      } catch {
        // Fallback: use the freshest stored session data, unless we already know the teacher is approved
        const stored = getStoredUser();
        if (active && !remembered && stored?.teacherApplication) {
          applyApplication(stored.teacherApplication);
          if (stored.teacherApplication.status !== "APPROVED") {
            setTab("application");
          }
        }
      } finally {
        if (active) setLoadingApp(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const isApproved = rememberedApproved || app?.status === "APPROVED";
  const isPending = !isApproved && app?.status === "PENDING";
  const isRejected = !isApproved && app?.status === "REJECTED";

  return (
    <RequireRole role="teacher" title="Teacher">
      <div className="grid gap-5">
        <section className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 suppressHydrationWarning className="font-heading text-2xl font-semibold flex items-center gap-2">
              {personalizedGreeting}
              {isApproved && (
                <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs">
                  Approved Teacher
                </Badge>
              )}
            </h1>
            <p className="text-sm text-muted-foreground">
              {user?.email ?? ""} · Manage your courses, students and content.
            </p>
          </div>
        </section>

        {/* Global Notice Banner when unapproved */}
        {!loadingApp && isPending && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-300">
            <div>
              <p className="font-semibold">Teacher Application Pending Review</p>
              <p className="text-xs">Your credentials are being reviewed by platform administrators. Teaching tools and publishing unlock automatically once approved.</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-amber-500/40 bg-background text-amber-800 dark:text-amber-200"
              onClick={() => setTab("application")}
            >
              View Application
            </Button>
          </div>
        )}

        {!loadingApp && isRejected && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-800 dark:text-red-300">
            <div>
              <p className="font-semibold">Application Requires Action (Rejected)</p>
              <p className="text-xs">
                Feedback: {app?.rejectionReason || "Please review your details and resubmit."}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-red-500/40 bg-background text-red-800 dark:text-red-200"
              onClick={() => setTab("application")}
            >
              Correct & Resubmit
            </Button>
          </div>
        )}

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
              {t.id === "application" && isPending && (
                <span className="ml-1.5 size-2 rounded-full bg-amber-500 inline-block" />
              )}
              {t.id === "application" && isRejected && (
                <span className="ml-1.5 size-2 rounded-full bg-red-500 inline-block" />
              )}
            </button>
          ))}
        </div>

        {tab === "application" ? (
          <TeacherApplicationPanel onApplicationUpdated={(updated) => applyApplication(updated)} />
        ) : null}

        {/* If teacher is not approved and attempts to access protected teaching panels, show friendly locked screen */}
        {!isApproved && tab !== "application" && tab !== "profile" ? (
          loadingApp ? (
            <p className="text-sm text-muted-foreground">Checking your approval status…</p>
          ) : (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <div className="mx-auto max-w-md space-y-3">
                <Badge variant="outline" className={isRejected ? "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400" : "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"}>
                  {isRejected ? "Application Rejected" : "Approval Pending"}
                </Badge>
                <h3 className="font-semibold text-lg">Teaching Tools Locked</h3>
                <p className="text-sm text-muted-foreground">
                  {isRejected
                    ? "Your teacher application was rejected by the administrator. Please make required corrections on the application tab to resubmit for review."
                    : "Your application is currently being reviewed by platform administrators. Content creation, courses, and lesson publishing will unlock automatically upon approval."}
                </p>
                <Button onClick={() => setTab("application")}>
                  {isRejected ? "Correct & Resubmit Application" : "View Application Status"}
                </Button>
              </div>
            </CardContent>
          </Card>
          )
        ) : (
          <>
            {tab === "courses" ? <CoursesPanel /> : null}
            {tab === "students" ? <StudentsPanel /> : null}
            {tab === "materials" ? <MaterialUploadPanel /> : null}
            {tab === "lessons" ? <LessonDraftsPanel /> : null}
            {tab === "assessments" ? <AssessmentsPanel /> : null}
            {tab === "published" ? (
              <>
                <ClassCodePanel />
                <PublishedContentList />
              </>
            ) : null}
            {tab === "ai" ? <AiPanel /> : null}
          </>
        )}

        {tab === "profile" ? <ProfilePanel /> : null}
      </div>
    </RequireRole>
  );
}

function CoursesPanel() {
  const [courses, setCourses] = React.useState<Course[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [editing, setEditing] = React.useState<Course | null>(null);
  const [form, setForm] = React.useState({ title: "", description: "", subject: "", board: "", price: "0" });
  const [saving, setSaving] = React.useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const d = await apiFetch<{ courses: Course[] }>("/teacher/courses");
      setCourses(d.courses);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load courses");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void load();
  }, []);

  function startEdit(c: Course) {
    setEditing(c);
    setForm({
      title: c.title,
      description: c.description,
      subject: c.subject,
      board: c.board,
      price: String(c.price ?? 0),
    });
  }

  function startCreate() {
    setEditing(null);
    setForm({ title: "", description: "", subject: "", board: "", price: "0" });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = {
        title: form.title,
        description: form.description,
        subject: form.subject,
        board: form.board,
        price: Number(form.price) || 0,
      };
      if (editing) {
        await apiFetch(`/courses/${editing.id}`, { method: "PUT", body });
      } else {
        await apiFetch("/courses", { method: "POST", body });
      }
      startCreate();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save course");
    } finally {
      setSaving(false);
    }
  }

  const field = "h-10";

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <CardTitle>{editing ? "Edit course" : "Create course"}</CardTitle>
          <CardDescription>
            {editing ? `Editing “${editing.title}”` : "Add a new course to your catalogue"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3.5" onSubmit={save}>
            <label className="grid gap-1.5 text-sm font-medium">
              Title
              <Input required className={field} value={form.title} disabled={saving}
                onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Description
              <Input required className={field} value={form.description} disabled={saving}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium">
                Subject
                <Input required className={field} value={form.subject} disabled={saving}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })} />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Board
                <Input required className={field} value={form.board} disabled={saving}
                  onChange={(e) => setForm({ ...form, board: e.target.value })} />
              </label>
            </div>
            <label className="grid gap-1.5 text-sm font-medium">
              Price (paise, 0 = free)
              <Input type="number" min={0} className={field} value={form.price} disabled={saving}
                onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </label>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : editing ? "Update course" : "Create course"}
              </Button>
              {editing ? (
                <Button type="button" variant="outline" onClick={startCreate}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your courses</CardTitle>
          <CardDescription>{courses.length} total</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : error && courses.length === 0 ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : courses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No courses yet. Create your first above.</p>
          ) : (
            courses.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{c.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.subject} · {c.board} · {c._count?.enrollments ?? 0} enrolled
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={c.price > 0 ? "secondary" : "outline"}>
                    {c.price > 0 ? `₹${(c.price / 100).toFixed(0)}` : "Free"}
                  </Badge>
                  <Button variant="outline" size="sm" onClick={() => startEdit(c)}>
                    Edit
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StudentsPanel() {
  const [students, setStudents] = React.useState<TeacherStudent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const d = await apiFetch<{ students: TeacherStudent[] }>("/teacher/students");
        if (active) setStudents(d.students);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Failed to load students");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enrolled students</CardTitle>
        <CardDescription>Students across all your courses</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : students.length === 0 ? (
          <p className="text-sm text-muted-foreground">No students enrolled yet.</p>
        ) : (
          students.map((s) => (
            <div key={s.id} className="rounded-lg border px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{s.name}</p>
                <Badge variant={s.averageScore >= 60 ? "secondary" : "destructive"}>
                  avg {s.averageScore}%
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {s.email}
                {s.grade ? ` · ${s.grade}` : ""}
                {s.board ? ` · ${s.board}` : ""} · {s.attempts} attempts
              </p>
              {s.courses.length > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">Courses: {s.courses.join(", ")}</p>
              ) : null}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function AiPanel() {
  const [form, setForm] = React.useState({
    subject: "",
    chapter: "",
    topic: "",
    difficulty: "MEDIUM",
    count: "5",
  });
  const [topicId, setTopicId] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [savingDrafts, setSavingDrafts] = React.useState(false);
  const [error, setError] = React.useState("");
  const [info, setInfo] = React.useState("");
  const [questions, setQuestions] = React.useState<GeneratedQuestion[]>([]);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");
    try {
      const d = await apiFetch<{ questions: GeneratedQuestion[] }>("/ai/generate-content", {
        method: "POST",
        body: {
          subject: form.subject || undefined,
          chapter: form.chapter || undefined,
          topic: form.topic,
          difficulty: form.difficulty,
          count: Number(form.count) || 5,
        },
      });
      setQuestions(d.questions);
      setInfo(`Generated ${d.questions.length} questions. Review, edit options, or remove items before saving as drafts.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      if (/not configured/i.test(msg)) {
        setInfo(msg);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  function updateQuestion(index: number, patch: Partial<GeneratedQuestion>) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, ...patch } : q))
    );
  }

  function removeQuestion(index: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  }

  function addBlankQuestion() {
    setQuestions((prev) => [
      ...prev,
      {
        text: "",
        optionA: "",
        optionB: "",
        optionC: "",
        optionD: "",
        correct: 0,
        explanation: "",
      },
    ]);
  }

  async function saveDrafts() {
    const tid = topicId.trim();
    if (!tid) {
      setError("Please provide a Topic ID to save draft questions to.");
      return;
    }
    if (questions.length === 0) {
      setError("No questions to save.");
      return;
    }

    // Client-side validation before draft submission
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim()) {
        setError(`Question #${i + 1} has empty question text.`);
        return;
      }
      if (!q.optionA.trim() || !q.optionB.trim() || !q.optionC.trim() || !q.optionD.trim()) {
        setError(`Question #${i + 1} must have all four options filled.`);
        return;
      }
      if (typeof q.correct !== "number" || q.correct < 0 || q.correct > 3) {
        setError(`Question #${i + 1} has an invalid correct option.`);
        return;
      }
    }

    setSavingDrafts(true);
    setError("");
    setInfo("");
    try {
      const d = await apiFetch<{ success: boolean; count: number; message: string }>("/teacher/questions", {
        method: "POST",
        body: {
          topicId: tid,
          questions,
          difficulty: form.difficulty,
        },
      });
      setInfo(d.message || `Saved ${d.count} questions as drafts.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save drafts");
    } finally {
      setSavingDrafts(false);
    }
  }

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <CardTitle>AI content generation</CardTitle>
          <CardDescription>
            Generate curriculum MCQs. You can review, edit answers, adjust explanations, and explicitly save as drafts before publishing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3.5" onSubmit={generate}>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium">
                Subject
                <Input
                  className="h-10"
                  value={form.subject}
                  disabled={loading || savingDrafts}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Chapter
                <Input
                  className="h-10"
                  value={form.chapter}
                  disabled={loading || savingDrafts}
                  onChange={(e) => setForm({ ...form, chapter: e.target.value })}
                />
              </label>
            </div>
            <label className="grid gap-1.5 text-sm font-medium">
              Topic
              <Input
                required
                className="h-10"
                value={form.topic}
                disabled={loading || savingDrafts}
                onChange={(e) => setForm({ ...form, topic: e.target.value })}
              />
            </label>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium">
                Difficulty
                <select
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
                  value={form.difficulty}
                  disabled={loading || savingDrafts}
                  onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                >
                  <option value="EASY">Easy</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HARD">Hard</option>
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Count
                <Input
                  type="number"
                  min={1}
                  max={20}
                  className="h-10"
                  value={form.count}
                  disabled={loading || savingDrafts}
                  onChange={(e) => setForm({ ...form, count: e.target.value })}
                />
              </label>
            </div>

            {error ? (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}
            {info ? (
              <div className="rounded-lg border border-primary/20 bg-primary/10 p-3 text-sm text-foreground">
                {info}
              </div>
            ) : null}

            <Button type="submit" disabled={loading || savingDrafts}>
              {loading ? "Generating questions…" : "Generate questions"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {questions.length > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>Review & Edit Questions ({questions.length})</CardTitle>
                <CardDescription>
                  Modify question text, options, correct answers, or explanations before saving as draft.
                </CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addBlankQuestion} disabled={savingDrafts}>
                + Add question
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            {questions.map((q, idx) => (
              <div key={idx} className="grid gap-3 rounded-xl border p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Question {idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeQuestion(idx)}
                    disabled={savingDrafts}
                    className="text-xs font-medium text-destructive hover:underline"
                  >
                    Delete question
                  </button>
                </div>

                <label className="grid gap-1 text-sm font-medium">
                  Prompt
                  <Input
                    value={q.text}
                    disabled={savingDrafts}
                    onChange={(e) => updateQuestion(idx, { text: e.target.value })}
                    placeholder="Enter question text…"
                  />
                </label>

                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="grid gap-1 text-xs">
                    <span className="font-semibold text-muted-foreground">Option A</span>
                    <Input
                      value={q.optionA}
                      disabled={savingDrafts}
                      onChange={(e) => updateQuestion(idx, { optionA: e.target.value })}
                      placeholder="Option A"
                    />
                  </label>
                  <label className="grid gap-1 text-xs">
                    <span className="font-semibold text-muted-foreground">Option B</span>
                    <Input
                      value={q.optionB}
                      disabled={savingDrafts}
                      onChange={(e) => updateQuestion(idx, { optionB: e.target.value })}
                      placeholder="Option B"
                    />
                  </label>
                  <label className="grid gap-1 text-xs">
                    <span className="font-semibold text-muted-foreground">Option C</span>
                    <Input
                      value={q.optionC}
                      disabled={savingDrafts}
                      onChange={(e) => updateQuestion(idx, { optionC: e.target.value })}
                      placeholder="Option C"
                    />
                  </label>
                  <label className="grid gap-1 text-xs">
                    <span className="font-semibold text-muted-foreground">Option D</span>
                    <Input
                      value={q.optionD}
                      disabled={savingDrafts}
                      onChange={(e) => updateQuestion(idx, { optionD: e.target.value })}
                      placeholder="Option D"
                    />
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-xs font-medium">
                    Correct Option
                    <select
                      className="h-9 rounded-md border border-input bg-background px-3 text-xs"
                      value={q.correct}
                      disabled={savingDrafts}
                      onChange={(e) => updateQuestion(idx, { correct: Number(e.target.value) })}
                    >
                      <option value={0}>Option A</option>
                      <option value={1}>Option B</option>
                      <option value={2}>Option C</option>
                      <option value={3}>Option D</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-xs font-medium">
                    Explanation
                    <Input
                      value={q.explanation ?? ""}
                      disabled={savingDrafts}
                      onChange={(e) => updateQuestion(idx, { explanation: e.target.value })}
                      placeholder="Reasoning for the answer…"
                    />
                  </label>
                </div>
              </div>
            ))}

            <div className="mt-2 rounded-xl border bg-muted/30 p-4">
              <h4 className="text-sm font-semibold">Save Drafts to Topic</h4>
              <p className="mt-0.5 text-xs text-muted-foreground">
                All reviewed questions will be saved strictly with status &quot;DRAFT&quot; and will not be published automatically.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Input
                  className="h-10 max-w-xs flex-1"
                  placeholder="Target Topic ID (required)"
                  value={topicId}
                  disabled={savingDrafts}
                  onChange={(e) => setTopicId(e.target.value)}
                />
                <Button type="button" onClick={saveDrafts} disabled={savingDrafts || !topicId.trim()}>
                  {savingDrafts ? "Saving drafts…" : "Save all as drafts"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function ProfilePanel() {
  return <ProfileEditor role="teacher" showXp={false} />;
}
