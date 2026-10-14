"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Sparkles,
  Award,
  CheckCircle2,
  FileText,
  ListOrdered,
  ArrowLeft,
  Share2,
  Check,
  Calendar,
  Gamepad2,
  Trophy,
  ChevronRight,
} from "lucide-react";
import {
  StudentPublishedContent,
  StudentPublishedLessonContent,
  StudentPublishedAssessmentContent,
  AssessmentSessionResponse,
  AssessmentSubmissionResponse,
} from "@/types/published-content";
import { startStudentAssessment, submitStudentAssessment } from "@/lib/api";
import { QuestionInteraction } from "./question-interaction";
import {
  Clock,
  PlayCircle,
  Loader2,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import { cn } from "cn";

interface PublishedLessonViewerProps {
  content: StudentPublishedContent;
  onBack?: () => void;
}

export function PublishedLessonViewer({
  content,
  onBack,
}: PublishedLessonViewerProps) {
  const isLesson = content.contentType === "LESSON";
  const lessonData = isLesson ? (content.content as StudentPublishedLessonContent) : null;
  const assessmentData = !isLesson ? (content.content as StudentPublishedAssessmentContent) : null;

  // Active section for Lessons
  const [activeTab, setActiveTab] = React.useState<"overview" | "steps" | "examples" | "terms" | "practice">("overview");

  // Track progress and score for Practice mode
  const [correctAnswersCount, setCorrectAnswersCount] = React.useState<number>(0);
  const [attemptedCount, setAttemptedCount] = React.useState<number>(0);
  const [copiedCode, setCopiedCode] = React.useState(false);

  // Full Assessment & Timed Blitz states
  const [asmtMode, setAsmtMode] = React.useState<"practice" | "test">("practice");
  const [asmtSession, setAsmtSession] = React.useState<AssessmentSessionResponse | null>(null);
  const [batchAnswers, setBatchAnswers] = React.useState<Record<string, unknown>>({});
  const [sessionLoading, setSessionLoading] = React.useState(false);
  const [submittingAsmt, setSubmittingAsmt] = React.useState(false);
  const [asmtSubmissionError, setAsmtSubmissionError] = React.useState<string | null>(null);
  const [asmtResult, setAsmtResult] = React.useState<AssessmentSubmissionResponse | null>(null);
  const [timeRemainingSeconds, setTimeRemainingSeconds] = React.useState<number | null>(null);

  // Timer countdown for timed assessment sessions
  React.useEffect(() => {
    if (!asmtSession?.deadline || asmtResult !== null) return;

    const tick = () => {
      const diffMs = asmtSession.deadline! - Date.now();
      const secs = Math.max(0, Math.floor(diffMs / 1000));
      setTimeRemainingSeconds(secs);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [asmtSession, asmtResult]);

  const handleStartAssessmentSession = async () => {
    setSessionLoading(true);
    setAsmtSubmissionError(null);
    try {
      const session = await startStudentAssessment(content.accessCode);
      setAsmtSession(session);
      setAsmtMode("test");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to start assessment.";
      setAsmtSubmissionError(msg);
    } finally {
      setSessionLoading(false);
    }
  };

  const handleSubmitAssessment = async () => {
    if (submittingAsmt) return;
    setSubmittingAsmt(true);
    setAsmtSubmissionError(null);

    try {
      const answerList = Object.entries(batchAnswers).map(([questionId, studentAnswer]) => ({
        questionId,
        studentAnswer,
      }));

      const res = await submitStudentAssessment({
        code: content.accessCode,
        sessionId: asmtSession?.sessionId,
        answers: answerList,
      });

      setAsmtResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit assessment.";
      setAsmtSubmissionError(msg);
    } finally {
      setSubmittingAsmt(false);
    }
  };

  const handleRetakeAssessment = () => {
    setAsmtResult(null);
    setBatchAnswers({});
    setAsmtSession(null);
    setTimeRemainingSeconds(null);
    setAsmtSubmissionError(null);
    setAsmtMode("practice");
  };

  const totalQuestions = isLesson
    ? lessonData?.reviewQuestions.length || 0
    : assessmentData?.questions.length || 0;

  const handleCopyCode = () => {
    if (content.accessCode) {
      navigator.clipboard.writeText(content.accessCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleAnswerChecked = (isCorrect: boolean) => {
    setAttemptedCount((prev) => prev + 1);
    if (isCorrect) {
      setCorrectAnswersCount((prev) => prev + 1);
    }
  };

  const formattedDate = content.publishedAt
    ? new Date(content.publishedAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-in fade-in-50 duration-300">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between gap-3">
        {onBack ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            className="h-8 px-2.5 text-xs text-muted-foreground gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Enter Another Code
          </Button>
        ) : (
          <Link
            href="/student/access"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-2.5 text-xs text-muted-foreground gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Enter Another Code
          </Link>
        )}

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyCode}
            className="h-8 px-2.5 text-xs gap-1.5"
          >
            {copiedCode ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                Copied Code
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" />
                Code: {content.accessCode}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Hero Banner Card */}
      <Card className="border-border/70 shadow-sm overflow-hidden bg-gradient-to-br from-card to-muted/30">
        <div className="h-1.5 w-full bg-gradient-to-r from-primary via-purple-500 to-indigo-500" />
        <CardHeader className="p-5 sm:p-6 pb-4">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-semibold">
              {content.subject}
            </Badge>
            {content.gradeOrSemester && (
              <Badge variant="outline" className="text-xs">
                {content.gradeOrSemester}
              </Badge>
            )}
            {content.boardOrScheme && (
              <Badge variant="outline" className="text-xs">
                {content.boardOrScheme}
              </Badge>
            )}
            <Badge
              variant="outline"
              className="text-xs font-mono font-bold text-purple-600 dark:text-purple-400 border-purple-500/30 bg-purple-500/10"
            >
              Code: {content.accessCode}
            </Badge>
            {formattedDate && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1 ml-auto">
                <Calendar className="w-3 h-3" /> Published {formattedDate}
              </span>
            )}
          </div>

          <CardTitle className="text-xl sm:text-2xl font-heading font-bold text-foreground">
            {content.title}
          </CardTitle>

          {(content.chapter || content.topic) && (
            <CardDescription className="text-xs sm:text-sm text-muted-foreground mt-1 flex flex-wrap items-center gap-2">
              {content.chapter && <span>Chapter: <strong className="text-foreground font-medium">{content.chapter}</strong></span>}
              {content.chapter && content.topic && <span>·</span>}
              {content.topic && <span>Topic: <strong className="text-foreground font-medium">{content.topic}</strong></span>}
            </CardDescription>
          )}
        </CardHeader>

        {/* Stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-border/60 bg-muted/20 divide-x divide-border/60">
          <div className="p-3 text-center">
            <p className="text-[10px] uppercase font-semibold text-muted-foreground">Type</p>
            <p className="text-xs sm:text-sm font-bold text-foreground">
              {isLesson ? "Curriculum Lesson" : `${content.difficulty || "Standard"} Assessment`}
            </p>
          </div>
          <div className="p-3 text-center">
            <p className="text-[10px] uppercase font-semibold text-muted-foreground">Practice Questions</p>
            <p className="text-xs sm:text-sm font-bold text-foreground">{totalQuestions}</p>
          </div>
          <div className="p-3 text-center">
            <p className="text-[10px] uppercase font-semibold text-muted-foreground">Score / XP</p>
            <p className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1">
              <Trophy className="w-3.5 h-3.5" />
              {correctAnswersCount * 10} XP ({correctAnswersCount}/{attemptedCount})
            </p>
          </div>
          <div className="p-3 text-center">
            <p className="text-[10px] uppercase font-semibold text-muted-foreground">Slogan</p>
            <p className="text-xs font-semibold text-primary truncate">Learn · Play · Test · Improve</p>
          </div>
        </div>
      </Card>

      {/* LESSON CONTENT VIEW */}
      {isLesson && lessonData && (
        <div className="space-y-6">
          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-muted/60 border border-border/60 rounded-xl overflow-x-auto text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all shrink-0 cursor-pointer",
                activeTab === "overview"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <BookOpen className="w-3.5 h-3.5 text-primary" />
              Overview & Objectives
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("steps")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all shrink-0 cursor-pointer",
                activeTab === "steps"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ListOrdered className="w-3.5 h-3.5 text-purple-500" />
              Explanations ({lessonData.explanationSteps.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("examples")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all shrink-0 cursor-pointer",
                activeTab === "examples"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Real Examples ({lessonData.sourceGroundedExamples.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("terms")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all shrink-0 cursor-pointer",
                activeTab === "terms"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <FileText className="w-3.5 h-3.5 text-indigo-500" />
              Key Terms ({lessonData.keyTerms.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("practice")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all shrink-0 cursor-pointer",
                activeTab === "practice"
                  ? "bg-card text-foreground shadow-xs font-semibold text-emerald-600 dark:text-emerald-400"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              Practice Questions ({lessonData.reviewQuestions.length})
            </button>
          </div>

          {/* Tab 1: Overview & Objectives */}
          {activeTab === "overview" && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              {lessonData.summary && (
                <Card className="border-border/70 shadow-xs">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-primary" />
                      Lesson Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-foreground/90 leading-relaxed">
                      {lessonData.summary}
                    </p>
                  </CardContent>
                </Card>
              )}

              <Card className="border-border/70 shadow-xs">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Award className="w-4 h-4 text-primary" />
                    What You Will Learn (Learning Objectives)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {lessonData.learningObjectives.map((obj, i) => (
                    <div key={i} className="flex items-start gap-2.5 p-2 rounded-lg bg-muted/30 text-xs sm:text-sm">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span className="text-foreground">{obj}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => setActiveTab("steps")}
                  className="gap-2 text-xs font-semibold"
                >
                  Start Reading Explanations
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Tab 2: Explanation Steps */}
          {activeTab === "steps" && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="grid grid-cols-1 gap-4">
                {lessonData.explanationSteps.map((step) => (
                  <Card key={step.stepNumber} className="border-border/70 shadow-xs hover:border-border transition-all">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold text-xs shrink-0">
                          {step.stepNumber}
                        </span>
                        <CardTitle className="text-sm sm:text-base font-semibold text-foreground">
                          {step.heading}
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                        {step.explanation}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex justify-between pt-2">
                <Button
                  variant="outline"
                  onClick={() => setActiveTab("overview")}
                  className="text-xs"
                >
                  Back to Overview
                </Button>
                <Button
                  onClick={() => setActiveTab("examples")}
                  className="gap-2 text-xs font-semibold"
                >
                  See Real Examples
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Tab 3: Real Examples */}
          {activeTab === "examples" && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {lessonData.sourceGroundedExamples.map((ex, i) => (
                  <Card key={i} className="border-border/70 shadow-xs flex flex-col justify-between">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                        <CardTitle className="text-sm font-semibold text-foreground">
                          {ex.title}
                        </CardTitle>
                      </div>
                      {ex.context && (
                        <p className="text-[11px] text-muted-foreground italic">
                          Context: {ex.context}
                        </p>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs sm:text-sm">
                      <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 font-mono text-xs">
                        <strong className="text-amber-800 dark:text-amber-300 block mb-1">Example:</strong>
                        <span className="text-foreground">{ex.example}</span>
                      </div>
                      <p className="text-muted-foreground leading-relaxed pt-1">
                        {ex.explanation}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex justify-between pt-2">
                <Button
                  variant="outline"
                  onClick={() => setActiveTab("steps")}
                  className="text-xs"
                >
                  Back to Explanations
                </Button>
                <Button
                  onClick={() => setActiveTab("terms")}
                  className="gap-2 text-xs font-semibold"
                >
                  Review Key Terms
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Tab 4: Key Terms */}
          {activeTab === "terms" && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {lessonData.keyTerms.map((t, i) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-xl border border-border/70 bg-card hover:border-border transition-all"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="font-semibold text-primary border-primary/20 bg-primary/5">
                        {t.term}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {t.definition}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex justify-between pt-2">
                <Button
                  variant="outline"
                  onClick={() => setActiveTab("examples")}
                  className="text-xs"
                >
                  Back to Examples
                </Button>
                <Button
                  onClick={() => setActiveTab("practice")}
                  className="gap-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Take Practice Questions
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Tab 5: Practice Questions */}
          {activeTab === "practice" && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="flex items-center justify-between pb-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Lesson Comprehension Questions
                </h3>
                <span className="text-xs text-muted-foreground">
                  Score: <strong className="text-emerald-500 font-bold">{correctAnswersCount}</strong> / {totalQuestions}
                </span>
              </div>

              <div className="space-y-4">
                {lessonData.reviewQuestions.map((q, idx) => (
                  <QuestionInteraction
                    key={q.id || idx}
                    accessCode={content.accessCode}
                    contentType="LESSON"
                    questionNumber={idx + 1}
                    question={q}
                    onAnswerChecked={handleAnswerChecked}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ASSESSMENT CONTENT VIEW */}
      {!isLesson && assessmentData && (
        <div className="space-y-6">
          {/* Mode Switcher */}
          {!asmtResult && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-1.5 bg-muted/60 border border-border/60 rounded-xl text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setAsmtMode("practice")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer",
                    asmtMode === "practice"
                      ? "bg-card text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Gamepad2 className="w-3.5 h-3.5 text-primary" />
                  Practice Mode (Instant Feedback)
                </button>
                <button
                  type="button"
                  onClick={() => setAsmtMode("test")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer",
                    asmtMode === "test"
                      ? "bg-card text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Trophy className="w-3.5 h-3.5 text-purple-500" />
                  Assessment Test Mode (Server-Graded)
                </button>
              </div>

              {asmtMode === "test" && asmtSession && timeRemainingSeconds !== null && (
                <Badge
                  variant="outline"
                  className={cn(
                    "font-mono font-semibold text-xs gap-1.5 py-1 px-2.5",
                    timeRemainingSeconds <= 30
                      ? "border-destructive text-destructive bg-destructive/10 animate-pulse"
                      : "border-primary/30 text-primary bg-primary/10"
                  )}
                >
                  <Clock className="w-3.5 h-3.5" />
                  Time Left: {Math.floor(timeRemainingSeconds / 60)}:
                  {String(timeRemainingSeconds % 60).padStart(2, "0")}
                </Badge>
              )}
            </div>
          )}

          {/* 1. PRACTICE MODE */}
          {asmtMode === "practice" && !asmtResult && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-1">
                <div>
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    <Gamepad2 className="w-5 h-5 text-purple-500" />
                    Interactive Practice Questions ({assessmentData.questions.length})
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Answer each question below. You&apos;ll get instant grading and step-by-step explanations!
                  </p>
                </div>
                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
                  {correctAnswersCount} / {assessmentData.questions.length} Correct
                </Badge>
              </div>

              <div className="space-y-4">
                {assessmentData.questions.map((q, idx) => (
                  <QuestionInteraction
                    key={q.id || idx}
                    accessCode={content.accessCode}
                    contentType="ASSESSMENT"
                    questionNumber={idx + 1}
                    question={q}
                    onAnswerChecked={handleAnswerChecked}
                  />
                ))}
              </div>

              {attemptedCount === totalQuestions && totalQuestions > 0 && (
                <Card className="border-emerald-500/40 bg-emerald-500/10 p-5 text-center space-y-2 animate-in zoom-in-95 duration-300">
                  <Trophy className="w-10 h-10 mx-auto text-emerald-500" />
                  <h4 className="text-lg font-bold text-foreground">
                    Great job completing all practice questions!
                  </h4>
                  <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
                    You answered <strong className="text-emerald-600 dark:text-emerald-400">{correctAnswersCount}</strong> out of {totalQuestions} correctly. Try taking the verified Assessment Test mode when you feel ready!
                  </p>
                  <div className="pt-2">
                    <Button
                      onClick={handleStartAssessmentSession}
                      className="text-xs font-semibold gap-1.5"
                    >
                      <PlayCircle className="w-4 h-4" /> Start Official Assessment Test
                    </Button>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* 2. TEST MODE (Pre-start) */}
          {asmtMode === "test" && !asmtSession && !asmtResult && (
            <Card className="border-border/70 shadow-sm p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto">
                <Trophy className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-foreground">{content.title}</h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Take this verified assessment to test your mastery. Answers will be scored securely on the server with full explanations revealed upon submission.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 max-w-md mx-auto">
                <Badge variant="outline" className="text-xs">
                  {assessmentData.questions.length} Questions
                </Badge>
                <Badge variant="outline" className="text-xs">
                  Difficulty: {content.difficulty || "Standard"}
                </Badge>
                <Badge variant="outline" className="text-xs font-mono">
                  Format: {content.gameFormat || "Mixed"}
                </Badge>
              </div>

              {asmtSubmissionError && (
                <p className="text-xs text-destructive flex items-center justify-center gap-1.5">
                  <AlertCircle className="w-4 h-4" /> {asmtSubmissionError}
                </p>
              )}

              <div className="pt-2">
                <Button
                  onClick={handleStartAssessmentSession}
                  disabled={sessionLoading}
                  className="font-semibold text-xs gap-2 px-6 h-10"
                >
                  {sessionLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Starting Assessment…
                    </>
                  ) : (
                    <>
                      <PlayCircle className="w-4 h-4" /> Begin Assessment Attempt
                    </>
                  )}
                </Button>
              </div>
            </Card>
          )}

          {/* 3. TEST MODE (Active Session) */}
          {asmtMode === "test" && asmtSession && !asmtResult && (
            <div className="space-y-5 animate-in fade-in-50 duration-200">
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-border/70 bg-card">
                <div>
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-purple-500" />
                    Official Assessment Session
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Progress: {Object.keys(batchAnswers).length} of {assessmentData.questions.length} questions answered
                  </p>
                </div>

                <Badge variant="outline" className="text-xs font-mono bg-muted/40">
                  Session: {asmtSession.sessionId.slice(0, 14)}…
                </Badge>
              </div>

              {/* Question list in batch mode */}
              <div className="space-y-4">
                {assessmentData.questions.map((q, idx) => {
                  const qId = q.id || `q_${idx + 1}`;
                  return (
                    <QuestionInteraction
                      key={qId}
                      accessCode={content.accessCode}
                      contentType="ASSESSMENT"
                      questionNumber={idx + 1}
                      question={q}
                      isBatchMode={true}
                      batchValue={batchAnswers[qId]}
                      onBatchChange={(val) => {
                        setBatchAnswers((prev) => ({ ...prev, [qId]: val }));
                      }}
                    />
                  );
                })}
              </div>

              {asmtSubmissionError && (
                <div className="p-3 rounded-xl border border-destructive/40 bg-destructive/5 text-destructive text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{asmtSubmissionError}</span>
                </div>
              )}

              {/* Submit footer bar */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-border/70 bg-card shadow-xs">
                <span className="text-xs text-muted-foreground">
                  Ready to finish? Click below to submit for secure server grading.
                </span>

                <Button
                  onClick={handleSubmitAssessment}
                  disabled={submittingAsmt}
                  className="font-semibold text-xs gap-2 px-5 h-9 bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {submittingAsmt ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Grading Answers…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Submit Assessment
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* 4. VERIFIED RESULTS EXPERIENCE */}
          {asmtResult && (
            <div className="space-y-6 animate-in zoom-in-95 duration-300">
              <Card className="border-border/70 overflow-hidden shadow-sm">
                <div
                  className={cn(
                    "h-2 w-full",
                    asmtResult.score >= 80
                      ? "bg-emerald-500"
                      : asmtResult.score >= 60
                      ? "bg-amber-500"
                      : "bg-destructive"
                  )}
                />
                <CardHeader className="p-5 sm:p-6 pb-4 text-center">
                  <div
                    className={cn(
                      "w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-2",
                      asmtResult.score >= 80
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : asmtResult.score >= 60
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        : "bg-destructive/10 text-destructive"
                    )}
                  >
                    <Trophy className="w-7 h-7" />
                  </div>

                  <CardTitle className="text-2xl font-heading font-bold text-foreground">
                    Verified Assessment Results
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-muted-foreground">
                    Topic: <strong className="text-foreground">{asmtResult.topic || content.topic || content.title}</strong>
                    {asmtResult.subject && <span> · Subject: <strong className="text-foreground">{asmtResult.subject}</strong></span>}
                  </CardDescription>

                  <div className="grid grid-cols-3 max-w-sm mx-auto gap-2 pt-4">
                    <div className="p-2.5 rounded-xl bg-muted/30 border border-border/60">
                      <p className="text-[10px] uppercase font-semibold text-muted-foreground">Score</p>
                      <p className="text-base sm:text-lg font-bold text-foreground">{asmtResult.score}%</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-muted/30 border border-border/60">
                      <p className="text-[10px] uppercase font-semibold text-muted-foreground">Correct</p>
                      <p className="text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400">
                        {asmtResult.correctCount} / {asmtResult.totalQuestions}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-muted/30 border border-border/60">
                      <p className="text-[10px] uppercase font-semibold text-muted-foreground">Status</p>
                      <p className="text-base sm:text-lg font-bold text-foreground">
                        {asmtResult.score >= 60 ? "Passed" : "Needs Review"}
                      </p>
                    </div>
                  </div>
                </CardHeader>

                <div className="flex flex-wrap items-center justify-center gap-2 p-3 bg-muted/20 border-t border-border/60">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRetakeAssessment}
                    className="text-xs gap-1.5 h-8"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Retake Assessment
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAsmtResult(null);
                      setAsmtMode("practice");
                    }}
                    className="text-xs gap-1.5 h-8 text-muted-foreground"
                  >
                    Switch to Practice Mode
                  </Button>
                </div>
              </Card>

              {/* Detailed Question Review */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  Detailed Question-by-Question Review ({asmtResult.results.length})
                </h4>

                {assessmentData.questions.map((q, idx) => {
                  const qId = q.id || `q_${idx + 1}`;
                  const questionGrading = asmtResult.results.find(
                    (r) => r.questionId === qId || r.questionId === q.id
                  ) || null;

                  return (
                    <QuestionInteraction
                      key={qId}
                      accessCode={content.accessCode}
                      contentType="ASSESSMENT"
                      questionNumber={idx + 1}
                      question={q}
                      isBatchMode={true}
                      batchValue={questionGrading ? questionGrading.studentAnswer : undefined}
                      readOnlyResult={questionGrading}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
