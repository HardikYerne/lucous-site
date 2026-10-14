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
import {
  LessonDraft,
  TeacherMaterial,
  fetchTeacherLessons,
  fetchTeacherMaterials,
  generateLessonDraft,
  deleteTeacherLesson,
} from "@/lib/api";
import { LessonDraftEditor } from "./lesson-draft-editor";
import {
  Sparkles,
  BookOpen,
  RefreshCw,
  Trash2,
  FileText,
  Search,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { cn } from "cn";

interface LessonDraftsPanelProps {
  initialMaterialId?: string;
  onSelectMaterial?: (id: string) => void;
}

export function LessonDraftsPanel({ initialMaterialId }: LessonDraftsPanelProps) {
  const [drafts, setDrafts] = React.useState<LessonDraft[]>([]);
  const [materials, setMaterials] = React.useState<TeacherMaterial[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Selected draft for editing
  const [activeDraft, setActiveDraft] = React.useState<LessonDraft | null>(null);

  // Generation modal / workflow state
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [generationError, setGenerationError] = React.useState<string | null>(null);
  const [generationSuccess, setGenerationSuccess] = React.useState<string | null>(null);
  const [selectedMaterialId, setSelectedMaterialId] = React.useState<string>(initialMaterialId || "");

  // Filtering
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  // Deletion
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [lessonsRes, materialsRes] = await Promise.all([
        fetchTeacherLessons(),
        fetchTeacherMaterials(),
      ]);
      setDrafts(lessonsRes.drafts);
      setMaterials(materialsRes.materials);

      if (initialMaterialId && !selectedMaterialId) {
        setSelectedMaterialId(initialMaterialId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load lesson drafts and materials.");
    } finally {
      setLoading(false);
    }
  }, [initialMaterialId, selectedMaterialId]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  // Handle generation trigger
  const handleGenerate = async (matId?: string) => {
    const targetId = matId || selectedMaterialId;
    if (!targetId) {
      setGenerationError("Please select an uploaded material to generate a lesson from.");
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);
    setGenerationSuccess(null);

    try {
      const res = await generateLessonDraft(targetId);
      setGenerationSuccess(res.message || "Lesson draft generated successfully.");
      // Refresh list and open newly generated draft in editor
      await loadData();
      setActiveDraft(res.draft);
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : "Failed to generate lesson draft.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteTeacherLesson(id);
      setDrafts((prev) => prev.filter((d) => d.id !== id));
      if (activeDraft?.id === id) {
        setActiveDraft(null);
      }
      setConfirmDeleteId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete lesson draft.");
    } finally {
      setDeletingId(null);
    }
  };

  // If a draft is currently selected for editing, show the editor view
  if (activeDraft) {
    return (
      <LessonDraftEditor
        draft={activeDraft}
        onBack={() => {
          setActiveDraft(null);
          void loadData();
        }}
        onDraftUpdated={(updated) => {
          setDrafts((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
          setActiveDraft(updated);
        }}
      />
    );
  }

  // Filtered drafts list
  const filteredDrafts = drafts.filter((d) => {
    const matchSearch =
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.sourceMaterialName && d.sourceMaterialName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (d.topic && d.topic.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchStatus = statusFilter === "all" || d.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header section with generation quick action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            AI Lesson Drafts
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Generate and refine curriculum-aligned lesson plans grounded in your uploaded materials.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          disabled={loading || isGenerating}
          className="h-8 text-xs gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Quick Generator Card */}
      <Card className="border-primary/20 bg-primary/5 shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <BookOpen className="w-4 h-4 text-primary" />
            Generate New Lesson Draft
          </CardTitle>
          <CardDescription className="text-xs">
            Select one of your uploaded PDF, Word (.docx), or plain text (.txt) documents to generate a structured lesson plan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <select
              value={selectedMaterialId}
              onChange={(e) => setSelectedMaterialId(e.target.value)}
              disabled={isGenerating || materials.length === 0}
              className="flex-1 h-9 rounded-lg border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">
                {materials.length === 0
                  ? "No materials uploaded yet. Upload materials first."
                  : "-- Select an Uploaded Material --"}
              </option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.originalName} ({m.subjectName}{m.topicName ? ` · ${m.topicName}` : ""})
                </option>
              ))}
            </select>

            <Button
              onClick={() => handleGenerate()}
              disabled={isGenerating || !selectedMaterialId}
              className="h-9 text-xs gap-1.5 font-medium shrink-0"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Generating Lesson…
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Generate Lesson
                </>
              )}
            </Button>
          </div>

          {generationError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{generationError}</span>
            </div>
          )}

          {generationSuccess && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{generationSuccess}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drafts List Card */}
      <Card className="border-border/70 shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Saved Lesson Drafts ({drafts.length})
              </CardTitle>
              <CardDescription className="text-xs">
                Review, edit, and maintain lesson plans associated with your materials.
              </CardDescription>
            </div>

            {/* Filter controls */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  placeholder="Search drafts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs w-full sm:w-48"
                />
              </div>

              <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/40 shrink-0">
                <button
                  type="button"
                  onClick={() => setStatusFilter("all")}
                  className={cn(
                    "px-2.5 py-1 text-[11px] font-medium rounded-md transition-all",
                    statusFilter === "all"
                      ? "bg-background shadow-xs text-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  All ({drafts.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("DRAFT")}
                  className={cn(
                    "px-2.5 py-1 text-[11px] font-medium rounded-md transition-all",
                    statusFilter === "DRAFT"
                      ? "bg-background shadow-xs text-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Drafts
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("REVIEWED")}
                  className={cn(
                    "px-2.5 py-1 text-[11px] font-medium rounded-md transition-all",
                    statusFilter === "REVIEWED"
                      ? "bg-background shadow-xs text-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Reviewed
                </button>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-2 text-muted-foreground">
              <RefreshCw className="w-6 h-6 animate-spin text-primary" />
              <p className="text-xs">Loading lesson drafts...</p>
            </div>
          ) : error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Failed to load drafts</p>
                <p className="text-[11px] opacity-90 mt-0.5">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadData}
                  className="h-6 text-[11px] px-2 mt-2"
                >
                  Retry
                </Button>
              </div>
            </div>
          ) : filteredDrafts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
              <div className="p-3 rounded-full bg-muted/60 text-muted-foreground">
                <BookOpen className="w-8 h-8 opacity-60" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  {drafts.length === 0 ? "No lesson drafts yet" : "No matching lesson drafts"}
                </p>
                <p className="text-xs text-muted-foreground max-w-sm">
                  {drafts.length === 0
                    ? "Generate your first educational lesson draft from an uploaded material above."
                    : "Try adjusting your search query or status filter."}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredDrafts.map((d) => (
                <div
                  key={d.id}
                  className="rounded-xl border border-border/70 bg-card p-4 hover:border-border transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-semibold text-foreground line-clamp-1">
                        {d.title}
                      </h4>
                      <Badge
                        variant={d.status === "REVIEWED" ? "default" : "secondary"}
                        className={cn(
                          "text-[10px] shrink-0 font-medium py-0.5",
                          d.status === "REVIEWED"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                        )}
                      >
                        {d.status === "REVIEWED" ? "Reviewed" : "Draft"}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="font-medium text-foreground">{d.subject}</span>
                      {d.topic && (
                        <>
                          <span>·</span>
                          <span className="truncate max-w-[150px]">{d.topic}</span>
                        </>
                      )}
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        <span className="truncate max-w-[120px]">{d.sourceMaterialName || "Material"}</span>
                      </span>
                    </div>

                    {d.content?.summary && (
                      <p className="text-xs text-muted-foreground line-clamp-2 bg-muted/20 rounded p-2">
                        {d.content.summary}
                      </p>
                    )}
                  </div>

                  {/* Footer actions & tags */}
                  <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <span>{new Date(d.createdAt).toLocaleDateString()}</span>
                      {d.aiProvider && (
                        <>
                          <span>·</span>
                          <span className="capitalize">{d.aiProvider.replace("_", " ")}</span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {confirmDeleteId === d.id ? (
                        <div className="flex items-center gap-1 bg-destructive/10 border border-destructive/30 rounded-lg p-1 text-[11px]">
                          <span className="text-destructive font-medium px-1 text-[10px]">Delete?</span>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-6 px-2 text-[10px]"
                            disabled={deletingId === d.id}
                            onClick={() => handleDelete(d.id)}
                          >
                            Yes
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1.5 text-[10px]"
                            onClick={() => setConfirmDeleteId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={deletingId === d.id}
                          onClick={() => setConfirmDeleteId(d.id)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          title="Delete draft"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}

                      <Button
                        size="sm"
                        onClick={() => setActiveDraft(d)}
                        className="h-7 text-xs px-2.5 gap-1 font-medium"
                      >
                        Edit Draft
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
