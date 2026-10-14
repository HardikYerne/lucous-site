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
  AssessmentDraft,
  TeacherMaterial,
  fetchTeacherAssessments,
  fetchTeacherMaterials,
  generateAssessment,
  deleteTeacherAssessment,
} from "@/lib/api";
import { AssessmentEditor } from "./assessment-editor";
import {
  Sparkles,
  Gamepad2,
  FileCheck2,
  RefreshCw,
  Trash2,
  FileText,
  Search,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  HelpCircle,
  Layers,
  Brain,
} from "lucide-react";
import { cn } from "cn";

interface AssessmentsPanelProps {
  initialMaterialId?: string;
  onSelectMaterial?: (id: string) => void;
}

export function AssessmentsPanel({ initialMaterialId }: AssessmentsPanelProps) {
  const [assessments, setAssessments] = React.useState<AssessmentDraft[]>([]);
  const [materials, setMaterials] = React.useState<TeacherMaterial[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Active assessment selected for editing
  const [activeAssessment, setActiveAssessment] = React.useState<AssessmentDraft | null>(null);

  // Generator form state
  const [selectedMaterialId, setSelectedMaterialId] = React.useState<string>(initialMaterialId || "");
  const [contentType, setContentType] = React.useState<"PRACTICE" | "TEST" | "GAME">("PRACTICE");
  const [gameFormat, setGameFormat] = React.useState<
    "MULTIPLE_CHOICE" | "TRUE_FALSE" | "FILL_BLANK" | "MATCHING" | "FLASHCARD" | "ORDERING" | "TIMED_BLITZ" | "MIXED"
  >("MULTIPLE_CHOICE");
  const [difficulty, setDifficulty] = React.useState<"EASY" | "MEDIUM" | "HARD">("MEDIUM");
  const [questionCount, setQuestionCount] = React.useState<5 | 10 | 15 | 20>(5);

  const [isGenerating, setIsGenerating] = React.useState(false);
  const [generationError, setGenerationError] = React.useState<string | null>(null);
  const [generationSuccess, setGenerationSuccess] = React.useState<string | null>(null);

  // Search & Filtering
  const [searchQuery, setSearchQuery] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  // Deletion state
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [assessmentsRes, materialsRes] = await Promise.all([
        fetchTeacherAssessments(),
        fetchTeacherMaterials(),
      ]);
      setAssessments(assessmentsRes.assessments);
      setMaterials(materialsRes.materials);

      if (initialMaterialId && !selectedMaterialId) {
        setSelectedMaterialId(initialMaterialId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load assessments and materials.");
    } finally {
      setLoading(false);
    }
  }, [initialMaterialId, selectedMaterialId]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleGenerate = async () => {
    if (!selectedMaterialId) {
      setGenerationError("Please select an uploaded learning material first.");
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);
    setGenerationSuccess(null);

    try {
      const res = await generateAssessment({
        materialId: selectedMaterialId,
        contentType,
        gameFormat,
        difficulty,
        questionCount,
      });

      setGenerationSuccess(res.message || "Assessment draft generated successfully.");
      await loadData();
      setActiveAssessment(res.assessment);
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : "Failed to generate assessment.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteTeacherAssessment(id);
      setAssessments((prev) => prev.filter((a) => a.id !== id));
      if (activeAssessment?.id === id) {
        setActiveAssessment(null);
      }
      setConfirmDeleteId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete assessment.");
    } finally {
      setDeletingId(null);
    }
  };

  // If editing an assessment, show the rich AssessmentEditor
  if (activeAssessment) {
    return (
      <AssessmentEditor
        assessment={activeAssessment}
        onBack={() => {
          setActiveAssessment(null);
          void loadData();
        }}
        onAssessmentUpdated={(updated) => {
          setAssessments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
          setActiveAssessment(updated);
        }}
      />
    );
  }

  // Filtered list
  const filteredAssessments = assessments.filter((a) => {
    const matchSearch =
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.sourceMaterialName && a.sourceMaterialName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (a.topic && a.topic.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchType = typeFilter === "all" || a.contentType === typeFilter;
    const matchStatus = statusFilter === "all" || a.status === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl font-bold text-foreground flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 text-primary" />
            AI Assessments & Educational Games
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Generate source-grounded practice questions, tests, answer keys, explanations, and game challenges from your uploaded materials.
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

      {/* Generator Configuration Card */}
      <Card className="border-primary/20 bg-primary/5 shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <Sparkles className="w-4 h-4 text-primary" />
            Configure & Generate Assessment
          </CardTitle>
          <CardDescription className="text-xs">
            Select an uploaded document, choose an activity type and format, and generate verifiable questions with answer keys.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {/* 1. Material Selector */}
            <div className="space-y-1.5 lg:col-span-2">
              <label className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-primary" />
                Source Learning Material
              </label>
              <select
                value={selectedMaterialId}
                onChange={(e) => setSelectedMaterialId(e.target.value)}
                disabled={isGenerating || materials.length === 0}
                className="w-full h-9 rounded-lg border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">
                  {materials.length === 0
                    ? "No materials uploaded yet. Upload materials first."
                    : "-- Select Source Document --"}
                </option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.originalName} ({m.subjectName}{m.topicName ? ` · ${m.topicName}` : ""})
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Content Type */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-primary" />
                Content Type
              </label>
              <select
                value={contentType}
                onChange={(e) => setContentType(e.target.value as "PRACTICE" | "TEST" | "GAME")}
                disabled={isGenerating}
                className="w-full h-9 rounded-lg border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="PRACTICE">Practice Questions</option>
                <option value="TEST">Test & Assessment</option>
                <option value="GAME">Educational Game</option>
              </select>
            </div>

            {/* 3. Question Format */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5 text-primary" />
                Question Format
              </label>
              <select
                value={gameFormat}
                onChange={(e) =>
                  setGameFormat(
                    e.target.value as
                      | "MULTIPLE_CHOICE"
                      | "TRUE_FALSE"
                      | "FILL_BLANK"
                      | "MATCHING"
                      | "FLASHCARD"
                      | "ORDERING"
                      | "TIMED_BLITZ"
                      | "MIXED"
                  )
                }
                disabled={isGenerating}
                className="w-full h-9 rounded-lg border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="MULTIPLE_CHOICE">Multiple Choice (4 options)</option>
                <option value="TRUE_FALSE">True / False Challenge</option>
                <option value="FILL_BLANK">Fill-in-the-Blank</option>
                <option value="MATCHING">Match-the-Following / Memory Pairs</option>
                <option value="FLASHCARD">Flashcard Concept Cards</option>
                <option value="ORDERING">Step Ordering Challenge</option>
                <option value="TIMED_BLITZ">Timed Quiz Blitz (Rapid Fire)</option>
                <option value="MIXED">Mixed Formats</option>
              </select>
            </div>

            {/* 4. Difficulty & Question Count */}
            <div className="space-y-1.5 flex gap-2">
              <div className="flex-1">
                <label className="text-[11px] font-semibold text-foreground">Difficulty</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as "EASY" | "MEDIUM" | "HARD")}
                  disabled={isGenerating}
                  className="w-full h-9 rounded-lg border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="EASY">Easy</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HARD">Hard</option>
                </select>
              </div>

              <div className="w-20">
                <label className="text-[11px] font-semibold text-foreground">Count</label>
                <select
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value) as 5 | 10 | 15 | 20)}
                  disabled={isGenerating}
                  className="w-full h-9 rounded-lg border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value={5}>5 Qs</option>
                  <option value={10}>10 Qs</option>
                  <option value={15}>15 Qs</option>
                  <option value={20}>20 Qs</option>
                </select>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>
                Questions are strictly source-grounded in the selected document with verifiable answer keys and explanations.
              </span>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !selectedMaterialId}
              className="h-9 text-xs gap-1.5 font-medium shrink-0 w-full sm:w-auto"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Generating Questions…
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Generate Assessment Draft
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

      {/* Assessments List Card */}
      <Card className="border-border/70 shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-primary" />
                Saved Assessments & Games ({assessments.length})
              </CardTitle>
              <CardDescription className="text-xs">
                Review, edit questions, inspect answer keys, and verify supporting source excerpts.
              </CardDescription>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  placeholder="Search assessments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs w-full sm:w-44"
                />
              </div>

              {/* Type Filter */}
              <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/40 shrink-0">
                <button
                  type="button"
                  onClick={() => setTypeFilter("all")}
                  className={cn(
                    "px-2 py-1 text-[11px] font-medium rounded-md transition-all",
                    typeFilter === "all"
                      ? "bg-background shadow-xs text-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter("PRACTICE")}
                  className={cn(
                    "px-2 py-1 text-[11px] font-medium rounded-md transition-all",
                    typeFilter === "PRACTICE"
                      ? "bg-background shadow-xs text-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Practice
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter("TEST")}
                  className={cn(
                    "px-2 py-1 text-[11px] font-medium rounded-md transition-all",
                    typeFilter === "TEST"
                      ? "bg-background shadow-xs text-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Tests
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter("GAME")}
                  className={cn(
                    "px-2 py-1 text-[11px] font-medium rounded-md transition-all",
                    typeFilter === "GAME"
                      ? "bg-background shadow-xs text-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Games
                </button>
              </div>

              {/* Status Filter */}
              <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/40 shrink-0">
                <button
                  type="button"
                  onClick={() => setStatusFilter("all")}
                  className={cn(
                    "px-2 py-1 text-[11px] font-medium rounded-md transition-all",
                    statusFilter === "all"
                      ? "bg-background shadow-xs text-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  All Status
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("DRAFT")}
                  className={cn(
                    "px-2 py-1 text-[11px] font-medium rounded-md transition-all",
                    statusFilter === "DRAFT"
                      ? "bg-background shadow-xs text-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Draft
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("REVIEWED")}
                  className={cn(
                    "px-2 py-1 text-[11px] font-medium rounded-md transition-all",
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
              <p className="text-xs">Loading assessments...</p>
            </div>
          ) : error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Failed to load assessments</p>
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
          ) : filteredAssessments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
              <div className="p-3 rounded-full bg-muted/60 text-muted-foreground">
                <Gamepad2 className="w-8 h-8 opacity-60" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  {assessments.length === 0 ? "No assessments generated yet" : "No matching assessments found"}
                </p>
                <p className="text-xs text-muted-foreground max-w-sm">
                  {assessments.length === 0
                    ? "Generate practice questions, tests, or interactive games from your uploaded materials above."
                    : "Try adjusting your search query or filters."}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredAssessments.map((a) => (
                <div
                  key={a.id}
                  className="rounded-xl border border-border/70 bg-card p-4 hover:border-border transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-semibold text-foreground line-clamp-1">
                        {a.title}
                      </h4>
                      <Badge
                        variant={a.status === "REVIEWED" ? "default" : "secondary"}
                        className={cn(
                          "text-[10px] shrink-0 font-medium py-0.5",
                          a.status === "REVIEWED"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                        )}
                      >
                        {a.status === "REVIEWED" ? "Reviewed" : "Draft"}
                      </Badge>
                    </div>

                    {/* Metadata Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                      <Badge variant="outline" className="text-[10px] font-semibold uppercase bg-muted/30">
                        {a.contentType}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {(a.gameFormat || "MULTIPLE_CHOICE").replace("_", " ")}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-normal",
                          a.difficulty === "EASY"
                            ? "text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                            : a.difficulty === "HARD"
                            ? "text-rose-600 dark:text-rose-400 border-rose-500/30"
                            : "text-amber-600 dark:text-amber-400 border-amber-500/30"
                        )}
                      >
                        {a.difficulty}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {a.questionCount} Questions
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="font-medium text-foreground">{a.subject}</span>
                      {a.topic && (
                        <>
                          <span>·</span>
                          <span className="truncate max-w-[140px]">{a.topic}</span>
                        </>
                      )}
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        <span className="truncate max-w-[120px]">{a.sourceMaterialName || "Material"}</span>
                      </span>
                    </div>

                    {a.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 bg-muted/20 rounded p-2">
                        {a.description}
                      </p>
                    )}
                  </div>

                  {/* Footer actions & tags */}
                  <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <span>{new Date(a.createdAt).toLocaleDateString()}</span>
                      {a.aiProvider && (
                        <>
                          <span>·</span>
                          <span
                            className={cn(
                              "capitalize",
                              a.aiProvider === "deterministic_preview"
                                ? "text-amber-600 dark:text-amber-400 font-medium"
                                : ""
                            )}
                          >
                            {a.aiProvider.replace("_", " ")}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {confirmDeleteId === a.id ? (
                        <div className="flex items-center gap-1 bg-destructive/10 border border-destructive/30 rounded-lg p-1 text-[11px]">
                          <span className="text-destructive font-medium px-1 text-[10px]">Delete?</span>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-6 px-2 text-[10px]"
                            disabled={deletingId === a.id}
                            onClick={() => handleDelete(a.id)}
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
                          disabled={deletingId === a.id}
                          onClick={() => setConfirmDeleteId(a.id)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          title="Delete assessment"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}

                      <Button
                        size="sm"
                        onClick={() => setActiveAssessment(a)}
                        className="h-7 text-xs px-2.5 gap-1 font-medium"
                      >
                        Review & Edit
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
