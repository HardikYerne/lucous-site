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
  LessonDraftContent,
  LessonExplanationStep,
  LessonExample,
  LessonKeyTerm,
  LessonReviewQuestion,
  updateTeacherLesson,
  generateLessonDraft,
} from "@/lib/api";
import {
  BookOpen,
  Sparkles,
  RefreshCw,
  Save,
  CheckCircle2,
  AlertCircle,
  FileText,
  ListOrdered,
  HelpCircle,
  Layers,
  Plus,
  Trash2,
  Info,
  Clock,
  ArrowLeft,
  Check,
} from "lucide-react";
import { cn } from "cn";

import { PublishConfirmationDialog } from "./publish-confirmation-dialog";

interface LessonDraftEditorProps {
  draft: LessonDraft;
  onDraftUpdated?: (updated: LessonDraft) => void;
  onBack?: () => void;
}

type EditorSection = "overview" | "steps" | "examples" | "terms" | "questions" | "grounding";

export function LessonDraftEditor({
  draft: initialDraft,
  onDraftUpdated,
  onBack,
}: LessonDraftEditorProps) {
  const [draft, setDraft] = React.useState<LessonDraft>(initialDraft);
  const [content, setContent] = React.useState<LessonDraftContent>(initialDraft.content);
  const [activeSection, setActiveSection] = React.useState<EditorSection>("overview");

  // Status & notifications
  const [saving, setSaving] = React.useState(false);
  const [regenerating, setRegenerating] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [showPublishDialog, setShowPublishDialog] = React.useState(false);

  // Sync state if initialDraft changes
  React.useEffect(() => {
    setDraft(initialDraft);
    setContent(initialDraft.content);
  }, [initialDraft]);

  // Section handlers: Learning Objectives
  const handleAddObjective = () => {
    setContent((prev) => ({
      ...prev,
      learningObjectives: [...prev.learningObjectives, "New learning objective"],
    }));
  };

  const handleUpdateObjective = (index: number, val: string) => {
    setContent((prev) => {
      const updated = [...prev.learningObjectives];
      updated[index] = val;
      return { ...prev, learningObjectives: updated };
    });
  };

  const handleRemoveObjective = (index: number) => {
    if (content.learningObjectives.length <= 1) {
      setErrorMessage("At least one learning objective is required.");
      return;
    }
    setContent((prev) => ({
      ...prev,
      learningObjectives: prev.learningObjectives.filter((_, i) => i !== index),
    }));
  };

  // Section handlers: Prerequisites
  const handleAddPrerequisite = () => {
    setContent((prev) => ({
      ...prev,
      prerequisiteKnowledge: [...prev.prerequisiteKnowledge, "New prerequisite concept"],
    }));
  };

  const handleUpdatePrerequisite = (index: number, val: string) => {
    setContent((prev) => {
      const updated = [...prev.prerequisiteKnowledge];
      updated[index] = val;
      return { ...prev, prerequisiteKnowledge: updated };
    });
  };

  const handleRemovePrerequisite = (index: number) => {
    setContent((prev) => ({
      ...prev,
      prerequisiteKnowledge: prev.prerequisiteKnowledge.filter((_, i) => i !== index),
    }));
  };

  // Section handlers: Explanation Steps
  const handleAddStep = () => {
    const nextNum = content.stepByStepExplanation.length + 1;
    setContent((prev) => ({
      ...prev,
      stepByStepExplanation: [
        ...prev.stepByStepExplanation,
        {
          stepNumber: nextNum,
          heading: `Concept Step ${nextNum}`,
          explanation: "Detailed explanation text grounded in the source document.",
          sourceReferences: `Section from ${draft.sourceMaterialName || "source document"}`,
        },
      ],
    }));
  };

  const handleUpdateStep = (index: number, field: keyof LessonExplanationStep, val: any) => {
    setContent((prev) => {
      const updated = [...prev.stepByStepExplanation];
      updated[index] = { ...updated[index], [field]: val };
      return { ...prev, stepByStepExplanation: updated };
    });
  };

  const handleRemoveStep = (index: number) => {
    if (content.stepByStepExplanation.length <= 1) {
      setErrorMessage("At least one explanation step is required.");
      return;
    }
    setContent((prev) => {
      const filtered = prev.stepByStepExplanation.filter((_, i) => i !== index);
      // Re-index stepNumber
      const reindexed = filtered.map((s, i) => ({ ...s, stepNumber: i + 1 }));
      return { ...prev, stepByStepExplanation: reindexed };
    });
  };

  // Section handlers: Examples
  const handleAddExample = () => {
    setContent((prev) => ({
      ...prev,
      sourceGroundedExamples: [
        ...prev.sourceGroundedExamples,
        {
          title: "New Practical Example",
          context: "Real-world context or scenario",
          example: "Problem statement or code demonstration",
          explanation: "Walkthrough of how the concept applies",
        },
      ],
    }));
  };

  const handleUpdateExample = (index: number, field: keyof LessonExample, val: string) => {
    setContent((prev) => {
      const updated = [...prev.sourceGroundedExamples];
      updated[index] = { ...updated[index], [field]: val };
      return { ...prev, sourceGroundedExamples: updated };
    });
  };

  const handleRemoveExample = (index: number) => {
    setContent((prev) => ({
      ...prev,
      sourceGroundedExamples: prev.sourceGroundedExamples.filter((_, i) => i !== index),
    }));
  };

  // Section handlers: Key Terms
  const handleAddKeyTerm = () => {
    setContent((prev) => ({
      ...prev,
      keyTerms: [
        ...prev.keyTerms,
        {
          term: "New Term",
          definition: "Definition based on the source material.",
        },
      ],
    }));
  };

  const handleUpdateKeyTerm = (index: number, field: keyof LessonKeyTerm, val: string) => {
    setContent((prev) => {
      const updated = [...prev.keyTerms];
      updated[index] = { ...updated[index], [field]: val };
      return { ...prev, keyTerms: updated };
    });
  };

  const handleRemoveKeyTerm = (index: number) => {
    setContent((prev) => ({
      ...prev,
      keyTerms: prev.keyTerms.filter((_, i) => i !== index),
    }));
  };

  // Section handlers: Review Questions
  const handleAddQuestion = () => {
    setContent((prev) => ({
      ...prev,
      reviewQuestions: [
        ...prev.reviewQuestions,
        {
          question: "New review question testing student comprehension",
          answer: "Accurate answer",
          explanation: "Explanation grounded in source material",
        },
      ],
    }));
  };

  const handleUpdateQuestion = (index: number, field: keyof LessonReviewQuestion, val: string) => {
    setContent((prev) => {
      const updated = [...prev.reviewQuestions];
      updated[index] = { ...updated[index], [field]: val };
      return { ...prev, reviewQuestions: updated };
    });
  };

  const handleRemoveQuestion = (index: number) => {
    if (content.reviewQuestions.length <= 1) {
      setErrorMessage("At least one review question is required.");
      return;
    }
    setContent((prev) => ({
      ...prev,
      reviewQuestions: prev.reviewQuestions.filter((_, i) => i !== index),
    }));
  };

  // Save changes via API
  const handleSave = async (newStatus?: "DRAFT" | "REVIEWED") => {
    setSaving(true);
    setErrorMessage(null);
    setSaveSuccess(false);

    try {
      const targetStatus = newStatus || draft.status;
      const res = await updateTeacherLesson(draft.id, {
        title: content.title,
        content,
        status: targetStatus,
      });

      const updatedDraft: LessonDraft = {
        ...draft,
        title: res.draft.title,
        content: res.draft.content,
        status: res.draft.status,
        updatedAt: res.draft.updatedAt,
      };

      setDraft(updatedDraft);
      setSaveSuccess(true);
      if (onDraftUpdated) {
        onDraftUpdated(updatedDraft);
      }
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to save lesson draft.");
    } finally {
      setSaving(false);
    }
  };

  // Regenerate draft from source
  const handleRegenerate = async () => {
    if (!confirm("Regenerate draft from source document? Unsaved changes will be replaced with fresh AI generation.")) {
      return;
    }

    setRegenerating(true);
    setErrorMessage(null);

    try {
      const res = await generateLessonDraft(draft.sourceMaterialId);
      setDraft(res.draft);
      setContent(res.draft.content);
      if (onDraftUpdated) {
        onDraftUpdated(res.draft);
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to regenerate lesson draft.");
    } finally {
      setRegenerating(false);
    }
  };

  const isPreviewMode = draft.aiProvider === "unconfigured_preview";

  return (
    <div className="space-y-6">
      {/* Top Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button
              variant="outline"
              size="sm"
              onClick={onBack}
              className="h-8 px-2.5 text-xs text-muted-foreground gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </Button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-heading text-lg font-bold text-foreground">
                Lesson Draft Editor
              </span>
              <Badge
                variant={draft.status === "PUBLISHED" ? "default" : draft.status === "REVIEWED" ? "default" : "secondary"}
                className={cn(
                  "text-[10px] font-medium tracking-wide",
                  draft.status === "PUBLISHED"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                    : draft.status === "REVIEWED"
                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                )}
              >
                {draft.status === "PUBLISHED"
                  ? `Published · ${draft.accessCode || ""}`
                  : draft.status === "REVIEWED"
                  ? "Reviewed Draft"
                  : "Working Draft"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <FileText className="w-3 h-3 text-primary" />
              Source: <span className="font-medium text-foreground">{draft.sourceMaterialName || "Uploaded Material"}</span>
              {draft.sourceWordCount && (
                <>
                  <span>·</span>
                  <span>{draft.sourceWordCount} words parsed</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRegenerate}
            disabled={regenerating || saving}
            className="h-8 text-xs gap-1.5"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", regenerating && "animate-spin")} />
            {regenerating ? "Regenerating…" : "Regenerate Draft"}
          </Button>

          {draft.status === "DRAFT" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSave("REVIEWED")}
              disabled={saving || regenerating}
              className="h-8 text-xs text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              Mark as Reviewed
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSave("DRAFT")}
              disabled={saving || regenerating}
              className="h-8 text-xs text-muted-foreground gap-1.5"
            >
              Revert to Draft
            </Button>
          )}

          <Button
            size="sm"
            onClick={() => handleSave()}
            disabled={saving || regenerating}
            className="h-8 text-xs gap-1.5 font-medium shadow-xs"
          >
            {saving ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : saveSuccess ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {saving ? "Saving…" : saveSuccess ? "Saved!" : "Save Changes"}
          </Button>

          <Button
            size="sm"
            onClick={() => setShowPublishDialog(true)}
            className="h-8 text-xs gap-1.5 font-medium bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600 shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {draft.status === "PUBLISHED" ? "Published (View Code)" : "Publish Lesson"}
          </Button>
        </div>
      </div>

      {/* Notice Banner: Unconfigured Preview vs Live AI */}
      {isPreviewMode && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1">
            <p className="font-semibold text-xs">AI Provider Preview Mode</p>
            <p className="opacity-90 leading-relaxed">
              No live AI API key (<code className="bg-amber-500/20 px-1 py-0.5 rounded text-[11px]">GEMINI_API_KEY</code> or{" "}
              <code className="bg-amber-500/20 px-1 py-0.5 rounded text-[11px]">OPENAI_API_KEY</code>) is configured on the backend.
              This draft was assembled using honest rule-based extraction from &quot;{draft.sourceMaterialName}&quot;. You can freely edit and refine every section below.
            </p>
          </div>
        </div>
      )}

      {/* Error / Success Notifications */}
      {errorMessage && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1">{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-xs font-semibold hover:opacity-80"
          >
            ×
          </button>
        </div>
      )}

      {saveSuccess && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>All lesson draft modifications have been saved successfully to persistent storage.</span>
        </div>
      )}

      {/* Draft Meta Card */}
      <Card className="border-border/70 shadow-xs">
        <CardContent className="pt-4 space-y-3.5">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Lesson Title
            </label>
            <Input
              value={content.title}
              onChange={(e) => setContent({ ...content, title: e.target.value })}
              className="font-heading text-base font-semibold h-10"
              placeholder="e.g. Newton's Laws of Motion — Foundations & Mechanics"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/40 text-xs">
            <Badge variant="outline" className="text-[11px] font-medium py-0.5">
              {draft.educationLevel === "diploma" ? "Diploma / Polytechnic" : "School (K-12)"}
            </Badge>
            {draft.gradeOrSemester && (
              <Badge variant="outline" className="text-[11px] font-medium py-0.5">
                {draft.gradeOrSemester}
              </Badge>
            )}
            {draft.boardOrScheme && (
              <Badge variant="outline" className="text-[11px] font-medium py-0.5 uppercase">
                {draft.boardOrScheme}
              </Badge>
            )}
            <Badge variant="outline" className="text-[11px] font-medium py-0.5">
              Subject: {draft.subject}
            </Badge>
            {draft.chapter && (
              <Badge variant="outline" className="text-[11px] font-medium py-0.5">
                Chapter: {draft.chapter}
              </Badge>
            )}
            {draft.topic && (
              <Badge variant="outline" className="text-[11px] font-medium py-0.5">
                Topic: {draft.topic}
              </Badge>
            )}
            <span className="ml-auto text-[11px] text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(draft.updatedAt).toLocaleDateString()}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Section Navigation Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-border/60 pb-2">
        {[
          { id: "overview", label: "Overview & Objectives", icon: BookOpen },
          { id: "steps", label: `Step Explanation (${content.stepByStepExplanation.length})`, icon: ListOrdered },
          { id: "examples", label: `Examples (${content.sourceGroundedExamples.length})`, icon: Sparkles },
          { id: "terms", label: `Key Terms (${content.keyTerms.length})`, icon: Layers },
          { id: "questions", label: `Review Questions (${content.reviewQuestions.length})`, icon: HelpCircle },
          { id: "grounding", label: "Grounding & Citations", icon: FileText },
        ].map((sec) => {
          const Icon = sec.icon;
          const isActive = activeSection === sec.id;
          return (
            <button
              key={sec.id}
              type="button"
              onClick={() => setActiveSection(sec.id as EditorSection)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                isActive
                  ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {sec.label}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT: 1. Overview & Objectives */}
      {activeSection === "overview" && (
        <div className="space-y-5">
          {/* High-Yield Summary */}
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                Lesson Summary & High-Yield Takeaway
              </CardTitle>
              <CardDescription className="text-xs">
                Concise executive summary grounded in the uploaded material.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <textarea
                value={content.summary}
                onChange={(e) => setContent({ ...content, summary: e.target.value })}
                className="w-full min-h-[90px] rounded-lg border border-input bg-background p-3 text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="High-yield lesson takeaway..."
              />
            </CardContent>
          </Card>

          {/* Learning Objectives */}
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    Learning Objectives
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Clear, measurable student competencies addressed in this lesson.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddObjective}
                  className="h-7 text-xs gap-1"
                >
                  <Plus className="w-3 h-3" /> Add Objective
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {content.learningObjectives.map((obj, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-primary w-5 text-center shrink-0">
                    {i + 1}.
                  </span>
                  <Input
                    value={obj}
                    onChange={(e) => handleUpdateObjective(i, e.target.value)}
                    className="text-xs h-8 flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveObjective(i)}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    title="Remove objective"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Prerequisites */}
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary" />
                    Prerequisite Knowledge
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Foundational concepts required before undertaking this lesson.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddPrerequisite}
                  className="h-7 text-xs gap-1"
                >
                  <Plus className="w-3 h-3" /> Add Prerequisite
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {content.prerequisiteKnowledge.map((req, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground w-5 text-center shrink-0">
                    •
                  </span>
                  <Input
                    value={req}
                    onChange={(e) => handleUpdatePrerequisite(i, e.target.value)}
                    className="text-xs h-8 flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemovePrerequisite(i)}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    title="Remove prerequisite"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB CONTENT: 2. Step-by-Step Explanation */}
      {activeSection === "steps" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Pedagogical progression breaking down the concept with source citations.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddStep}
              className="h-7 text-xs gap-1"
            >
              <Plus className="w-3 h-3" /> Add Step
            </Button>
          </div>

          {content.stepByStepExplanation.map((step, idx) => (
            <Card key={idx} className="border-border/70 shadow-xs">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs shrink-0">
                      {step.stepNumber}
                    </span>
                    <Input
                      value={step.heading}
                      onChange={(e) => handleUpdateStep(idx, "heading", e.target.value)}
                      placeholder="Step Heading..."
                      className="text-xs font-semibold h-8 flex-1"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveStep(idx)}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0"
                    title="Remove step"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <textarea
                  value={step.explanation}
                  onChange={(e) => handleUpdateStep(idx, "explanation", e.target.value)}
                  className="w-full min-h-[90px] rounded-lg border border-input bg-background p-3 text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="Detailed concept explanation..."
                />

                <div className="flex items-center gap-2 bg-muted/30 rounded-lg p-2 border border-border/40">
                  <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-[11px] font-medium text-muted-foreground shrink-0">
                    Source Citation:
                  </span>
                  <Input
                    value={step.sourceReferences || ""}
                    onChange={(e) => handleUpdateStep(idx, "sourceReferences", e.target.value)}
                    placeholder="e.g. Page 4, Section 2.1 or Source excerpt"
                    className="text-[11px] h-7 bg-background"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* TAB CONTENT: 3. Source-Grounded Examples */}
      {activeSection === "examples" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Concrete scenarios, problems, or case demonstrations grounded in the material.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddExample}
              className="h-7 text-xs gap-1"
            >
              <Plus className="w-3 h-3" /> Add Example
            </Button>
          </div>

          {content.sourceGroundedExamples.map((ex, idx) => (
            <Card key={idx} className="border-border/70 shadow-xs">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <Input
                    value={ex.title}
                    onChange={(e) => handleUpdateExample(idx, "title", e.target.value)}
                    placeholder="Example Title..."
                    className="text-xs font-semibold h-8 flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveExample(idx)}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0"
                    title="Remove example"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    Context / Real-World Setup
                  </label>
                  <Input
                    value={ex.context}
                    onChange={(e) => handleUpdateExample(idx, "context", e.target.value)}
                    placeholder="Context or application domain..."
                    className="text-xs h-8"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    Problem / Scenario / Case Demonstration
                  </label>
                  <textarea
                    value={ex.example}
                    onChange={(e) => handleUpdateExample(idx, "example", e.target.value)}
                    className="w-full min-h-[70px] rounded-lg border border-input bg-background p-2.5 text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder="Problem text or scenario..."
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    Walkthrough & Explanation
                  </label>
                  <textarea
                    value={ex.explanation}
                    onChange={(e) => handleUpdateExample(idx, "explanation", e.target.value)}
                    className="w-full min-h-[70px] rounded-lg border border-input bg-background p-2.5 text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder="Step-by-step resolution..."
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* TAB CONTENT: 4. Key Terms */}
      {activeSection === "terms" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Technical terminology and precise definitions directly drawn from the source.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddKeyTerm}
              className="h-7 text-xs gap-1"
            >
              <Plus className="w-3 h-3" /> Add Key Term
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {content.keyTerms.map((kt, idx) => (
              <Card key={idx} className="border-border/70 shadow-xs">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <Input
                      value={kt.term}
                      onChange={(e) => handleUpdateKeyTerm(idx, "term", e.target.value)}
                      placeholder="Term name..."
                      className="text-xs font-semibold h-8 flex-1 text-primary"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveKeyTerm(idx)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
                      title="Remove term"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <textarea
                    value={kt.definition}
                    onChange={(e) => handleUpdateKeyTerm(idx, "definition", e.target.value)}
                    className="w-full min-h-[60px] rounded-lg border border-input bg-background p-2 text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder="Definition text..."
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT: 5. Review Questions */}
      {activeSection === "questions" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Formative evaluation questions to assess learner comprehension.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddQuestion}
              className="h-7 text-xs gap-1"
            >
              <Plus className="w-3 h-3" /> Add Question
            </Button>
          </div>

          {content.reviewQuestions.map((q, idx) => (
            <Card key={idx} className="border-border/70 shadow-xs">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="flex items-center justify-center w-5 h-5 rounded-md bg-primary/10 text-primary font-bold text-xs shrink-0">
                      Q{idx + 1}
                    </span>
                    <Input
                      value={q.question}
                      onChange={(e) => handleUpdateQuestion(idx, "question", e.target.value)}
                      placeholder="Question text..."
                      className="text-xs font-medium h-8 flex-1"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveQuestion(idx)}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0"
                    title="Remove question"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    Correct Answer
                  </label>
                  <textarea
                    value={q.answer}
                    onChange={(e) => handleUpdateQuestion(idx, "answer", e.target.value)}
                    className="w-full min-h-[50px] rounded-lg border border-input bg-background p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder="Correct answer..."
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    Explanation / Pedagogical Rationale
                  </label>
                  <textarea
                    value={q.explanation}
                    onChange={(e) => handleUpdateQuestion(idx, "explanation", e.target.value)}
                    className="w-full min-h-[50px] rounded-lg border border-input bg-background p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder="Why this answer is correct based on the source material..."
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* TAB CONTENT: 6. Grounding & Citations */}
      {activeSection === "grounding" && (
        <div className="space-y-4">
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Source Grounding & Gap Notes
              </CardTitle>
              <CardDescription className="text-xs">
                Audited notes regarding how this lesson was grounded in &quot;{draft.sourceMaterialName}&quot;, including any gaps or missing details in the source.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <textarea
                value={content.sourceGroundingNotes || ""}
                onChange={(e) => setContent({ ...content, sourceGroundingNotes: e.target.value })}
                className="w-full min-h-[120px] rounded-lg border border-input bg-background p-3 text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Grounding notes..."
              />

              <div className="rounded-lg bg-muted/40 p-3 border border-border/50 text-xs space-y-2">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-primary" />
                  Pedagogical Integrity Standards
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground text-[11px]">
                  <li>All factual statements must match the uploaded material.</li>
                  <li>Page numbers and section citations are grounded strictly in detectable document headers.</li>
                  <li>Uncovered curriculum elements must be highlighted for the teacher to supplement manually.</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <PublishConfirmationDialog
        open={showPublishDialog}
        onOpenChange={setShowPublishDialog}
        contentType="LESSON"
        contentId={draft.id}
        title={content.title || draft.title}
        subject={draft.subject}
        chapter={draft.chapter}
        topic={draft.topic}
        itemSummary={content.summary}
        itemCount={
          (content.stepByStepExplanation?.length || 0) + (content.reviewQuestions?.length || 0)
        }
        onPublished={(res) => {
          const accessCode = typeof res === "string" ? res : res.accessCode;
          const publishedAt = typeof res === "object" && res.publishedAt ? res.publishedAt : new Date().toISOString();
          const updated: LessonDraft = {
            ...draft,
            status: "PUBLISHED",
            accessCode,
            publishedAt,
          };
          setDraft(updated);
          if (onDraftUpdated) {
            onDraftUpdated(updated);
          }
        }}
      />
    </div>
  );
}
