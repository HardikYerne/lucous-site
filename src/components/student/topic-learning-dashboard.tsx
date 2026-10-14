"use client";

import * as React from "react";
import Link from "next/link";
import {
  Sparkles,
  Gamepad2,
  Video,
  BookOpen,
  ArrowLeft,
  Play,
  ExternalLink,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  AlertCircle,
  KeyRound,
  Flag,
  PenLine,
  ClipboardList,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TutorView } from "@/components/student/tutor-view";
import { TopicGamesRunner } from "@/components/student/games-view";
import {
  apiFetch,
  reportVideo,
  type CurriculumSelection,
  type ContentItem,
  type EducationalVideo,
  type VideoSearchResponse,
} from "@/lib/api";

export type DashboardTab = "tutor" | "games" | "videos" | "material";

interface TopicLearningDashboardProps {
  curriculum: CurriculumSelection;
  onChangeSelection: () => void;
  initialTab?: DashboardTab;
}

function getSafeEmbedUrl(video: EducationalVideo): string | null {
  const rawId = video.id?.trim();
  if (!rawId || !/^[a-zA-Z0-9_-]{11}$/.test(rawId)) {
    return null;
  }
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(rawId)}?autoplay=1&rel=0`;
}

export function TopicLearningDashboard({
  curriculum,
  onChangeSelection,
  initialTab = "tutor",
}: TopicLearningDashboardProps) {
  const [activeTab, setActiveTab] = React.useState<DashboardTab>(initialTab);
  const { board, grade, subject, chapter, topic } = curriculum;

  return (
    <div className="grid gap-6">
      {/* Top Curriculum Context Bar */}
      <section className="rounded-xl border bg-card p-4 shadow-xs sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            {/* Breadcrumb Hierarchy */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{board.name}</span>
              <span>/</span>
              <span>{grade.name}</span>
              {curriculum.branch ? (
                <>
                  <span>/</span>
                  <span>{curriculum.branch}</span>
                </>
              ) : null}
              {curriculum.semester ? (
                <>
                  <span>/</span>
                  <span>{curriculum.semester}</span>
                </>
              ) : null}
              <span>/</span>
              <span>{subject.name}</span>
              <span>/</span>
              <span>{chapter.name}</span>
            </div>

            {/* Active Topic Title */}
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                {topic.name}
              </h1>
              <Badge variant="outline" className="border-primary/40 bg-primary/5 text-primary text-xs">
                Active Topic
              </Badge>
            </div>
          </div>

          {/* Actions: Practice, Test, and Change topic */}
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
            <Link href={`/student/practice?topicId=${topic.id}`}>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <PenLine className="h-3.5 w-3.5" />
                Practice
              </Button>
            </Link>
            <Link href={`/student/test?topicId=${topic.id}`}>
              <Button variant="default" size="sm" className="gap-1.5 text-xs">
                <ClipboardList className="h-3.5 w-3.5" />
                Take Test
              </Button>
            </Link>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onChangeSelection}
              className="gap-1.5 text-xs"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Change Topic
            </Button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mt-5 flex flex-wrap gap-2 border-t pt-4">
          <button
            type="button"
            onClick={() => setActiveTab("tutor")}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors cursor-pointer",
              activeTab === "tutor"
                ? "border-primary bg-primary text-primary-foreground shadow-xs font-semibold"
                : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Sparkles className="h-4 w-4" />
            <span>AI Tutor</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("games")}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors cursor-pointer",
              activeTab === "games"
                ? "border-primary bg-primary text-primary-foreground shadow-xs font-semibold"
                : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Gamepad2 className="h-4 w-4" />
            <span>Games</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("material")}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors cursor-pointer",
              activeTab === "material"
                ? "border-primary bg-primary text-primary-foreground shadow-xs font-semibold"
                : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <BookOpen className="h-4 w-4" />
            <span>Study Material</span>
          </button>
        </div>
      </section>

      {/* Main Tab Panels */}
      <main className="min-h-[450px]">
        {/* TAB 1: AI TUTOR */}
        {activeTab === "tutor" ? (
          <section className="space-y-4">
            <TutorView
              key={topic.id}
              embedded
              initialContext={{
                topic: topic.name,
                subject: subject.name,
                chapter: chapter.name,
                board: board.name,
                classGrade: grade.name,
                grade: grade.name.toLowerCase().includes("diploma")
                  ? "diploma"
                  : grade.name.toLowerCase().includes("10")
                  ? "secondary"
                  : "all",
                educationLevel: curriculum.branch ? "diploma" : "school",
                branch: curriculum.branch || undefined,
                semester: curriculum.semester || undefined,
              }}
            />
          </section>
        ) : null}

        {/* TAB 2: GAMES */}
        {activeTab === "games" ? (
          <section className="space-y-4">
            <TopicGamesRunner key={topic.id} topic={topic} />
          </section>
        ) : null}

        {/* TAB 4: STUDY MATERIAL */}
        {activeTab === "material" ? (
          <TopicStudyMaterialSection
            curriculum={curriculum}
            onAskAi={() => setActiveTab("tutor")}
          />
        ) : null}
      </main>
    </div>
  );
}

// ============================================================================
// TOPIC YOUTUBE VIDEOS SECTION
// ============================================================================
interface TopicVideosSectionProps {
  curriculum: CurriculumSelection;
  onAskAi: () => void;
}

function TopicVideosSection({ curriculum, onAskAi }: TopicVideosSectionProps) {
  const { topic, subject } = curriculum;
  const [videos, setVideos] = React.useState<EducationalVideo[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [activeVideo, setActiveVideo] = React.useState<EducationalVideo | null>(null);

  const [reportingVideoId, setReportingVideoId] = React.useState<string | null>(null);
  const [reportReason, setReportReason] = React.useState("");
  const [reportingLoading, setReportingLoading] = React.useState(false);
  const [reportSuccess, setReportSuccess] = React.useState(false);
  const [reportError, setReportError] = React.useState("");

  const ytSearchQuery = [
    curriculum.board?.name,
    curriculum.grade?.name,
    curriculum.branch,
    curriculum.semester,
    curriculum.subject?.name,
    curriculum.topic?.name,
  ]
    .filter(Boolean)
    .join(" ");
  const ytSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(ytSearchQuery)}`;

  const handleReport = async () => {
    if (!reportingVideoId) return;
    setReportingLoading(true);
    setReportError("");
    try {
      await reportVideo({
        videoId: reportingVideoId,
        reason: reportReason.trim() || "Video unavailable or irrelevant to topic",
        topicId: String(topic.id),
      });
      setReportSuccess(true);
      setTimeout(() => {
        setReportingVideoId(null);
        setReportReason("");
        setReportSuccess(false);
      }, 1400);
    } catch (err) {
      setReportError(err instanceof Error ? err.message : "Failed to report video");
    } finally {
      setReportingLoading(false);
    }
  };

  React.useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        // Query videos relevant to this topic or subject
        const queryParams = new URLSearchParams();
        queryParams.set("q", topic.name);
        queryParams.set("limit", "12");

        let res = await apiFetch<VideoSearchResponse>(`/videos?${queryParams.toString()}`);
        let list = res && Array.isArray(res.videos) ? res.videos : [];

        // If no videos match the exact topic name, search by subject
        if (list.length === 0 && subject.name) {
          const fallbackParams = new URLSearchParams();
          fallbackParams.set("q", subject.name);
          fallbackParams.set("limit", "12");
          res = await apiFetch<VideoSearchResponse>(`/videos?${fallbackParams.toString()}`);
          list = res && Array.isArray(res.videos) ? res.videos : [];
        }

        if (active) {
          setVideos(list);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load video lessons.");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [topic.name, subject.name]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">Educational Videos for {topic.name}</h2>
          <p className="text-xs text-muted-foreground">
            Watch verified video lessons and visual explanations from the educational library.
          </p>
        </div>
        <Badge variant="outline" className="text-xs self-start sm:self-auto">
          {videos.length} verified videos found
        </Badge>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[250px] gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">Searching relevant educational videos…</p>
        </div>
      ) : videos.length === 0 ? (
        <Card className="p-8 text-center space-y-4 border-dashed">
          <Video className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <div className="space-y-1.5">
            <h3 className="text-sm font-semibold text-foreground">No verified curated videos for this topic yet</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Our educational team continuously validates safe, high-quality video lessons. In the meantime, you can search YouTube directly for this exact topic:
            </p>
          </div>

          <div className="rounded-lg border bg-muted/40 p-3 max-w-md mx-auto text-left space-y-2">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-muted-foreground">External Search Query:</span>
              <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30">External Link</Badge>
            </div>
            <p className="text-xs font-semibold text-foreground truncate">{ytSearchQuery}</p>
            <a
              href={ytSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Search YouTube for &quot;{topic.name}&quot;</span>
            </a>
          </div>

          <div className="flex justify-center gap-2 pt-2">
            <Link href="/student/videos">
              <Button variant="outline" size="sm" className="text-xs">
                Browse Curated Library
              </Button>
            </Link>
            <Button size="sm" className="gap-1.5 text-xs" onClick={onAskAi}>
              <Sparkles className="h-3.5 w-3.5" />
              Ask AI Tutor Instead
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((v) => (
            <Card key={v.id} className="flex flex-col justify-between overflow-hidden group">
              <div>
                {/* Thumbnail Preview */}
                <div
                  className="relative aspect-video w-full overflow-hidden bg-black/40 cursor-pointer"
                  onClick={() => setActiveVideo(v)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={v.thumbnailUrl}
                    alt={v.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    loading="lazy"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = `https://img.youtube.com/vi/${v.id}/hqdefault.jpg`;
                    }}
                  />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-primary/90 text-primary-foreground flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Play className="w-4 h-4 ml-0.5 fill-current" />
                    </div>
                  </div>
                  {v.duration ? (
                    <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-sm bg-black/80 text-[10px] font-medium text-white flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {v.duration}
                    </div>
                  ) : null}
                  {v.isVerified ? (
                    <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-sm bg-brand-green/90 text-[10px] font-medium text-white flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Verified
                    </div>
                  ) : null}
                </div>

                {/* Video Info */}
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="truncate">{v.channel}</span>
                    {v.language ? <span>• {v.language.toUpperCase()}</span> : null}
                  </div>
                  <CardTitle
                    className="text-sm font-semibold line-clamp-2 hover:text-primary transition-colors cursor-pointer"
                    onClick={() => setActiveVideo(v)}
                  >
                    {v.title}
                  </CardTitle>
                </CardHeader>

                <CardContent className="p-4 pt-0">
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {v.description || "Educational video explaining this core curriculum topic."}
                  </p>
                </CardContent>
              </div>

              <CardFooter className="p-4 pt-2 border-t flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="default"
                  className="gap-1.5 text-xs h-8 flex-1"
                  onClick={() => setActiveVideo(v)}
                >
                  <Play className="h-3 w-3 fill-current" />
                  Watch
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs h-8"
                  onClick={onAskAi}
                  title="Ask AI questions about this lesson"
                >
                  <Sparkles className="h-3 w-3 text-primary" />
                  Study AI
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Safe Video Player Modal */}
      <Dialog open={!!activeVideo} onOpenChange={(open) => !open && setActiveVideo(null)}>
        <DialogContent className="sm:max-w-3xl p-0 overflow-hidden bg-background">
          {activeVideo ? (
            <div className="space-y-3">
              <div className="relative aspect-video w-full bg-black">
                {getSafeEmbedUrl(activeVideo) ? (
                  <iframe
                    src={getSafeEmbedUrl(activeVideo)!}
                    title={activeVideo.title}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center p-4 text-center text-sm text-destructive">
                    Unable to safely embed this video.
                  </div>
                )}
              </div>

              <div className="p-4 sm:p-5 space-y-2">
                <DialogHeader className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{activeVideo.channel}</span>
                    {activeVideo.duration ? <span>• {activeVideo.duration}</span> : null}
                  </div>
                  <DialogTitle className="text-base sm:text-lg font-bold">
                    {activeVideo.title}
                  </DialogTitle>
                  <DialogDescription className="text-xs line-clamp-3">
                    {activeVideo.description}
                  </DialogDescription>
                </DialogHeader>

                {reportingVideoId === activeVideo.id ? (
                  <div className="rounded-lg border bg-muted/30 p-3 space-y-2 mt-2">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span>Report Video: {activeVideo.title.slice(0, 40)}…</span>
                      <button
                        type="button"
                        onClick={() => setReportingVideoId(null)}
                        className="text-muted-foreground hover:text-foreground text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                    {reportSuccess ? (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                        <Check className="h-4 w-4" />
                        <span>Report submitted. Thank you for your feedback!</span>
                      </div>
                    ) : (
                      <>
                        <input
                          type="text"
                          value={reportReason}
                          onChange={(e) => setReportReason(e.target.value)}
                          placeholder="e.g. Video is unavailable, broken, or irrelevant to this topic"
                          className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs focus:outline-hidden focus:ring-1 focus:ring-primary"
                        />
                        {reportError ? <p className="text-xs text-destructive">{reportError}</p> : null}
                        <div className="flex justify-end gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 text-xs"
                            onClick={handleReport}
                            disabled={reportingLoading}
                          >
                            {reportingLoading ? "Submitting…" : "Submit Report"}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs"
                      onClick={() => {
                        setActiveVideo(null);
                        onAskAi();
                      }}
                    >
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      Discuss with AI Tutor
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => setReportingVideoId(activeVideo.id)}
                    >
                      <Flag className="h-3.5 w-3.5" />
                      Report Video
                    </Button>
                  </div>

                  <a
                    href={`https://www.youtube.com/watch?v=${activeVideo.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <span>Open on YouTube</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// TOPIC STUDY MATERIAL SECTION
// ============================================================================
interface TopicStudyMaterialSectionProps {
  curriculum: CurriculumSelection;
  onAskAi: () => void;
}

function TopicStudyMaterialSection({ curriculum, onAskAi }: TopicStudyMaterialSectionProps) {
  const { topic } = curriculum;
  const [contents, setContents] = React.useState<ContentItem[]>([]);
  const [completedIds, setCompletedIds] = React.useState<Array<string | number>>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const topicId = topic.id;

  React.useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await apiFetch<{
          contents: ContentItem[];
          completedIds: Array<string | number>;
        }>(`/student/content?topicId=${encodeURIComponent(String(topicId))}`);
        if (active) {
          setContents(data.contents || []);
          setCompletedIds(data.completedIds || []);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load study material");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [topicId]);

  async function markComplete(contentId: string | number) {
    try {
      await apiFetch("/student/progress", {
        method: "POST",
        body: { contentId },
      });
      setCompletedIds((prev) =>
        prev.includes(contentId) ? prev : [...prev, contentId]
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save progress");
    }
  }

  const completedCount = contents.filter((c) => completedIds.includes(c.id)).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">Study Material for {topic.name}</h2>
          <p className="text-xs text-muted-foreground">
            Structured written lessons, formulas, explanations, and key takeaways.
          </p>
        </div>

        {contents.length > 0 ? (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {completedCount} of {contents.length} completed
            </Badge>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[200px] gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">Loading study lessons…</p>
        </div>
      ) : contents.length === 0 ? (
        <Card className="p-8 text-center space-y-3">
          <BookOpen className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">
              No written lessons available for this topic yet
            </h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Our curriculum team regularly publishes new structured lessons. You can ask the AI Tutor to generate an in-depth lesson or check video lessons.
            </p>
          </div>
          <div className="flex justify-center gap-2 pt-2">
            <Button size="sm" className="gap-1.5 text-xs" onClick={onAskAi}>
              <Sparkles className="h-3.5 w-3.5" />
              Generate Lesson with AI Tutor
            </Button>
            <Link href="/student/access">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <KeyRound className="h-3.5 w-3.5" />
                Enter Access Code
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {contents.map((item, idx) => {
            const isDone = completedIds.includes(item.id);
            return (
              <Card key={item.id} className="transition-all">
                <CardHeader className="p-4 sm:p-5 pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {item.order || idx + 1}
                      </span>
                      <CardTitle className="text-base font-semibold">
                        {item.title}
                      </CardTitle>
                    </div>
                    {isDone ? (
                      <Badge variant="outline" className="border-brand-green/30 bg-brand-green/10 text-brand-green text-xs gap-1">
                        <Check className="h-3 w-3" />
                        Completed
                      </Badge>
                    ) : null}
                  </div>
                </CardHeader>

                <CardContent className="p-4 sm:p-5 pt-0 space-y-4">
                  <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground leading-relaxed whitespace-pre-line text-sm bg-muted/30 p-4 rounded-lg border">
                    {item.body}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <Button
                      variant={isDone ? "secondary" : "default"}
                      size="sm"
                      disabled={isDone}
                      onClick={() => markComplete(item.id)}
                      className="gap-1.5 text-xs font-medium"
                    >
                      {isDone ? <Check className="h-3.5 w-3.5" /> : null}
                      {isDone ? "Completed" : "Mark as completed"}
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onAskAi}
                      className="gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      Ask AI doubt on this lesson
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
