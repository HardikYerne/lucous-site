"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AssessmentDraft,
  AssessmentContent,
  AssessmentQuestion,
  updateTeacherAssessment,
  generateAssessment,
} from "@/lib/api";
import {
  RefreshCw,
  Save,
  CheckCircle2,
  AlertCircle,
  FileText,
  Plus,
  Trash2,
  ArrowLeft,
  Check,
  Info,
  Clock,
  HelpCircle,
  Send,
} from "lucide-react";
import { cn } from "cn";
import { PublishConfirmationDialog } from "./publish-confirmation-dialog";

interface AssessmentEditorProps {
  assessment: AssessmentDraft;
  onAssessmentUpdated?: (updated: AssessmentDraft) => void;
  onBack: () => void;
}

export function AssessmentEditor({
  assessment: initialAssessment,
  onAssessmentUpdated,
  onBack,
}: AssessmentEditorProps) {
  const [assessment, setAssessment] = React.useState<AssessmentDraft>(initialAssessment);
  const [content, setContent] = React.useState<AssessmentContent>(initialAssessment.content);

  // Status & notifications
  const [saving, setSaving] = React.useState(false);
  const [regenerating, setRegenerating] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [showPublishDialog, setShowPublishDialog] = React.useState(false);

  const [prevId, setPrevId] = React.useState(initialAssessment.id);
  if (prevId !== initialAssessment.id) {
    setPrevId(initialAssessment.id);
    setAssessment(initialAssessment);
    setContent(initialAssessment.content);
  }

  // Question editing handlers
  const handleUpdateQuestion = <K extends keyof AssessmentQuestion>(
    qIdx: number,
    field: K,
    value: AssessmentQuestion[K]
  ) => {
    setContent((prev) => {
      const updated = [...prev.questions];
      updated[qIdx] = { ...updated[qIdx], [field]: value };
      return { ...prev, questions: updated };
    });
  };

  const handleUpdateOption = (qIdx: number, optIdx: number, value: string) => {
    setContent((prev) => {
      const updated = [...prev.questions];
      const q = updated[qIdx];
      const options = q.options ? [...q.options] : [];
      const oldVal = options[optIdx];
      options[optIdx] = value;
      // If the old option was the correct answer, update correctAnswer too
      let correctAns = q.correctAnswer;
      if (correctAns === oldVal) {
        correctAns = value;
      }
      updated[qIdx] = { ...q, options, correctAnswer: correctAns };
      return { ...prev, questions: updated };
    });
  };

  const handleSetCorrectOption = (qIdx: number, optionVal: string) => {
    handleUpdateQuestion(qIdx, "correctAnswer", optionVal);
  };

  const handleUpdateMatchingPair = (
    qIdx: number,
    pairIdx: number,
    field: "left" | "right",
    val: string
  ) => {
    setContent((prev) => {
      const updated = [...prev.questions];
      const q = updated[qIdx];
      const pairs = q.matchingPairs ? [...q.matchingPairs] : [];
      const oldPair = pairs[pairIdx] || { left: "", right: "" };
      pairs[pairIdx] = { ...oldPair, [field]: val };

      // Update mapping in correctAnswer
      const mapping: Record<string, string> = {};
      pairs.forEach((p) => {
        if (p.left) mapping[p.left] = p.right || "";
      });

      updated[qIdx] = { ...q, matchingPairs: pairs, correctAnswer: mapping };
      return { ...prev, questions: updated };
    });
  };

  const handleAddMatchingPair = (qIdx: number) => {
    setContent((prev) => {
      const updated = [...prev.questions];
      const q = updated[qIdx];
      const pairs = q.matchingPairs ? [...q.matchingPairs] : [];
      pairs.push({ left: `Concept ${pairs.length + 1}`, right: `Description ${pairs.length + 1}` });

      const mapping: Record<string, string> = {};
      pairs.forEach((p) => {
        mapping[p.left] = p.right;
      });

      updated[qIdx] = { ...q, matchingPairs: pairs, correctAnswer: mapping };
      return { ...prev, questions: updated };
    });
  };

  const handleRemoveMatchingPair = (qIdx: number, pairIdx: number) => {
    setContent((prev) => {
      const updated = [...prev.questions];
      const q = updated[qIdx];
      if (!q.matchingPairs || q.matchingPairs.length <= 3) {
        setErrorMessage("Matching questions require at least 3 pairs.");
        return prev;
      }
      const pairs = q.matchingPairs.filter((_, i) => i !== pairIdx);
      const mapping: Record<string, string> = {};
      pairs.forEach((p) => {
        mapping[p.left] = p.right;
      });
      updated[qIdx] = { ...q, matchingPairs: pairs, correctAnswer: mapping };
      return { ...prev, questions: updated };
    });
  };

  const handleUpdateOrderingItem = (qIdx: number, itemIdx: number, text: string) => {
    setContent((prev) => {
      const updated = [...prev.questions];
      const q = updated[qIdx];
      const rawItems = q.items ? [...q.items] : [];
      const cleanItems = rawItems.map((item, idx) =>
        typeof item === "string" ? { id: `step_${idx + 1}`, text: item } : { ...item }
      );
      if (cleanItems[itemIdx]) {
        cleanItems[itemIdx].text = text;
      }
      const order = cleanItems.map((it) => it.id);
      updated[qIdx] = {
        ...q,
        items: cleanItems,
        correctOrder: order,
        correctAnswer: order,
      };
      return { ...prev, questions: updated };
    });
  };

  const handleAddOrderingItem = (qIdx: number) => {
    setContent((prev) => {
      const updated = [...prev.questions];
      const q = updated[qIdx];
      const rawItems = q.items ? [...q.items] : [];
      const cleanItems = rawItems.map((item, idx) =>
        typeof item === "string" ? { id: `step_${idx + 1}`, text: item } : { ...item }
      );
      const nextStepNum = cleanItems.length + 1;
      cleanItems.push({ id: `step_${nextStepNum}`, text: `Step ${nextStepNum}` });
      const order = cleanItems.map((it) => it.id);
      updated[qIdx] = {
        ...q,
        items: cleanItems,
        correctOrder: order,
        correctAnswer: order,
      };
      return { ...prev, questions: updated };
    });
  };

  const handleRemoveOrderingItem = (qIdx: number, itemIdx: number) => {
    setContent((prev) => {
      const updated = [...prev.questions];
      const q = updated[qIdx];
      const rawItems = q.items ? [...q.items] : [];
      if (rawItems.length <= 3) {
        setErrorMessage("Ordering questions require at least 3 sequence items.");
        return prev;
      }
      const cleanItems = rawItems
        .filter((_, idx) => idx !== itemIdx)
        .map((item, idx) =>
          typeof item === "string" ? { id: `step_${idx + 1}`, text: item } : { ...item }
        );
      const order = cleanItems.map((it) => it.id);
      updated[qIdx] = {
        ...q,
        items: cleanItems,
        correctOrder: order,
        correctAnswer: order,
      };
      return { ...prev, questions: updated };
    });
  };

  const handleAddQuestion = () => {
    const nextIdx = content.questions.length + 1;
    let newQ: AssessmentQuestion;
    const format = assessment.gameFormat;

    if (format === "FLASHCARD") {
      newQ = {
        id: `q_${nextIdx}`,
        type: "FLASHCARD",
        questionText: `Key Concept #${nextIdx}`,
        front: `Key Concept #${nextIdx}`,
        back: `Definition and explanation for concept #${nextIdx}.`,
        correctAnswer: `Definition and explanation for concept #${nextIdx}.`,
        explanation: `Pedagogical explanation for concept #${nextIdx}.`,
        sourceReference: `Excerpt from ${assessment.sourceMaterialName || "source document"}`,
      };
    } else if (format === "ORDERING") {
      newQ = {
        id: `q_${nextIdx}`,
        type: "ORDERING",
        questionText: `Arrange the steps in sequential order:`,
        items: [
          { id: "step_1", text: "First phase or initial condition" },
          { id: "step_2", text: "Intermediate process or reaction" },
          { id: "step_3", text: "Final outcome or equilibrium" },
        ],
        correctOrder: ["step_1", "step_2", "step_3"],
        correctAnswer: ["step_1", "step_2", "step_3"],
        explanation: "Step 1 leads to Step 2, which concludes at Step 3.",
        sourceReference: `Excerpt from ${assessment.sourceMaterialName || "source document"}`,
      };
    } else if (format === "MATCHING") {
      newQ = {
        id: `q_${nextIdx}`,
        type: "MATCHING",
        questionText: `Match each concept with its definition:`,
        matchingPairs: [
          { left: "Term A", right: "Definition A" },
          { left: "Term B", right: "Definition B" },
          { left: "Term C", right: "Definition C" },
        ],
        correctAnswer: { "Term A": "Definition A", "Term B": "Definition B", "Term C": "Definition C" },
        explanation: "Accurate associative connections based on source document.",
        sourceReference: `Excerpt from ${assessment.sourceMaterialName || "source document"}`,
      };
    } else if (format === "TIMED_BLITZ") {
      newQ = {
        id: `q_${nextIdx}`,
        type: "TIMED_BLITZ",
        questionText: `Rapid question #${nextIdx}`,
        options: ["Correct Option", "Distractor 1", "Distractor 2", "Distractor 3"],
        correctAnswer: "Correct Option",
        timeLimitSeconds: 15,
        explanation: "Explanation supporting the correct answer.",
        sourceReference: `Excerpt from ${assessment.sourceMaterialName || "source document"}`,
      };
    } else {
      newQ = {
        id: `q_${nextIdx}`,
        type: "MULTIPLE_CHOICE",
        questionText: `New assessment question #${nextIdx}`,
        options: ["Correct Option", "Distractor 1", "Distractor 2", "Distractor 3"],
        correctAnswer: "Correct Option",
        explanation: "Explanation supporting why this option is correct.",
        sourceReference: `Excerpt from ${assessment.sourceMaterialName || "source document"}`,
      };
    }

    setContent((prev) => ({
      ...prev,
      questionCount: prev.questions.length + 1,
      questions: [...prev.questions, newQ],
    }));
  };

  const handleRemoveQuestion = (qIdx: number) => {
    if (content.questions.length <= 1) {
      setErrorMessage("Assessment must contain at least 1 question.");
      return;
    }
    setContent((prev) => {
      const filtered = prev.questions.filter((_, i) => i !== qIdx);
      return {
        ...prev,
        questionCount: filtered.length,
        questions: filtered.map((q, i) => ({ ...q, id: `q_${i + 1}` })),
      };
    });
  };

  // Save changes via API
  const handleSave = async (newStatus?: "DRAFT" | "REVIEWED") => {
    setSaving(true);
    setErrorMessage(null);
    setSaveSuccess(false);

    try {
      const targetStatus = newStatus || assessment.status;
      const res = await updateTeacherAssessment(assessment.id, {
        title: content.title,
        description: content.description,
        content,
        status: targetStatus,
      });

      const updatedAsmt: AssessmentDraft = {
        ...assessment,
        title: res.assessment.title,
        description: res.assessment.description,
        content: res.assessment.content,
        status: res.assessment.status,
        updatedAt: res.assessment.updatedAt,
      };

      setAssessment(updatedAsmt);
      setSaveSuccess(true);
      if (onAssessmentUpdated) {
        onAssessmentUpdated(updatedAsmt);
      }
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to save assessment.");
    } finally {
      setSaving(false);
    }
  };

  // Regenerate assessment
  const handleRegenerate = async () => {
    if (!confirm("Regenerate assessment from source document? Unsaved changes will be replaced.")) {
      return;
    }

    setRegenerating(true);
    setErrorMessage(null);

    try {
      const res = await generateAssessment({
        materialId: assessment.sourceMaterialId,
        contentType: assessment.contentType,
        gameFormat: assessment.gameFormat || "MULTIPLE_CHOICE",
        difficulty: assessment.difficulty,
        questionCount: assessment.questionCount as 5 | 10 | 15 | 20,
      });

      setAssessment(res.assessment);
      setContent(res.assessment.content);
      if (onAssessmentUpdated) {
        onAssessmentUpdated(res.assessment);
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to regenerate assessment.");
    } finally {
      setRegenerating(false);
    }
  };

  const [regeneratingItemIdx, setRegeneratingItemIdx] = React.useState<number | null>(null);

  // Regenerate an individual question without replacing other edits
  const handleRegenerateQuestion = async (qIdx: number) => {
    setRegeneratingItemIdx(qIdx);
    setErrorMessage(null);
    try {
      const res = await generateAssessment({
        materialId: assessment.sourceMaterialId,
        contentType: assessment.contentType,
        gameFormat: assessment.gameFormat || "MULTIPLE_CHOICE",
        difficulty: assessment.difficulty,
        questionCount: 5,
      });

      if (res.assessment?.content?.questions?.length > 0) {
        const candidateQuestions = res.assessment.content.questions;
        const candidate = candidateQuestions[qIdx % candidateQuestions.length];
        const replacement: AssessmentQuestion = {
          ...candidate,
          id: content.questions[qIdx].id || `q_${qIdx + 1}`,
        };
        setContent((prev) => {
          const updated = [...prev.questions];
          updated[qIdx] = replacement;
          return { ...prev, questions: updated };
        });
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to regenerate question.");
    } finally {
      setRegeneratingItemIdx(null);
    }
  };

  const isPreviewMode = assessment.aiProvider === "unconfigured_preview";

  return (
    <div className="space-y-6">
      {/* Top Header */}
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
                {assessment.contentType === "GAME" ? "Educational Game Editor" : "Assessment & Test Editor"}
              </span>
              <Badge
                variant={assessment.status === "PUBLISHED" ? "default" : assessment.status === "REVIEWED" ? "default" : "secondary"}
                className={cn(
                  "text-[10px] font-medium tracking-wide",
                  assessment.status === "PUBLISHED"
                    ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30"
                    : assessment.status === "REVIEWED"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                )}
              >
                {assessment.status === "PUBLISHED" ? (
                  <span className="flex items-center gap-1">
                    <Send className="w-2.5 h-2.5" />
                    Published {(assessment as any).accessCode ? `(${(assessment as any).accessCode})` : ""}
                  </span>
                ) : assessment.status === "REVIEWED" ? (
                  "Reviewed"
                ) : (
                  "Draft"
                )}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <FileText className="w-3 h-3 text-primary" />
              Source: <span className="font-medium text-foreground">{assessment.sourceMaterialName || "Material"}</span>
              <span>·</span>
              <span>{content.questions.length} questions</span>
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
            {regenerating ? "Regenerating…" : "Regenerate"}
          </Button>

          {assessment.status === "DRAFT" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSave("REVIEWED")}
              disabled={saving || regenerating}
              className="h-8 text-xs text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              Mark Reviewed
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
            disabled={saving || regenerating}
            className="h-8 text-xs gap-1.5 font-medium bg-purple-600 hover:bg-purple-700 text-white shadow-xs"
          >
            <Send className="w-3.5 h-3.5" />
            {assessment.status === "PUBLISHED" ? "Manage Publish" : "Publish"}
          </Button>
        </div>
      </div>

      {/* Notice Banner: Unconfigured Preview Mode */}
      {isPreviewMode && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1">
            <p className="font-semibold text-xs">AI Provider Preview Mode</p>
            <p className="opacity-90 leading-relaxed">
              No live AI API key (<code className="bg-amber-500/20 px-1 py-0.5 rounded text-[11px]">GEMINI_API_KEY</code> or{" "}
              <code className="bg-amber-500/20 px-1 py-0.5 rounded text-[11px]">OPENAI_API_KEY</code>) is configured on the backend.
              This assessment was rule-based generated from &quot;{assessment.sourceMaterialName}&quot;. You can freely edit questions, options, and explanations.
            </p>
          </div>
        </div>
      )}

      {/* Error / Success Notifications */}
      {errorMessage && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1">{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-xs font-semibold hover:opacity-80">×</button>
        </div>
      )}

      {saveSuccess && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>All assessment modifications and answer keys have been saved successfully.</span>
        </div>
      )}

      {/* Meta Card */}
      <Card className="border-border/70 shadow-xs">
        <CardContent className="pt-4 space-y-3.5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Title
              </label>
              <Input
                value={content.title}
                onChange={(e) => setContent({ ...content, title: e.target.value })}
                className="font-heading text-base font-semibold h-10"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-[11px] font-medium text-muted-foreground">
                Description / Purpose
              </label>
              <Input
                value={content.description || ""}
                onChange={(e) => setContent({ ...content, description: e.target.value })}
                className="text-xs h-8"
                placeholder="Assessment overview..."
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40 text-xs">
            <Badge variant="outline" className="text-[11px] font-semibold py-0.5">
              {assessment.contentType === "GAME" ? "Game Challenge" : assessment.contentType === "TEST" ? "Formal Test" : "Practice"}
            </Badge>
            <Badge variant="outline" className="text-[11px] font-medium py-0.5">
              Difficulty: {assessment.difficulty}
            </Badge>
            {assessment.gameFormat && (
              <Badge variant="outline" className="text-[11px] font-medium py-0.5">
                Format: {assessment.gameFormat.replace("_", " ")}
              </Badge>
            )}
            <Badge variant="outline" className="text-[11px] font-medium py-0.5">
              Subject: {assessment.subject}
            </Badge>
            {assessment.topic && (
              <Badge variant="outline" className="text-[11px] font-medium py-0.5">
                Topic: {assessment.topic}
              </Badge>
            )}
            <span className="ml-auto text-[11px] text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(assessment.updatedAt).toLocaleDateString()}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Questions List Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-primary" />
            Questions & Answer Keys ({content.questions.length})
          </h3>
          <p className="text-xs text-muted-foreground">
            Review questions, verify answer keys, and refine pedagogical explanations.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddQuestion}
          className="h-7 text-xs gap-1"
        >
          <Plus className="w-3 h-3" /> Add Question
        </Button>
      </div>

      {/* Question Cards */}
      <div className="space-y-4">
        {content.questions.map((q, qIdx) => (
          <Card key={q.id || qIdx} className="border-border/70 shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs shrink-0">
                    {qIdx + 1}
                  </span>
                  <Badge variant="outline" className="text-[10px] font-medium uppercase">
                    {q.type.replace("_", " ")}
                  </Badge>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRegenerateQuestion(qIdx)}
                    disabled={regeneratingItemIdx === qIdx}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                    title="Regenerate this individual question from source"
                  >
                    <RefreshCw className={cn("w-3.5 h-3.5", regeneratingItemIdx === qIdx && "animate-spin text-primary")} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveQuestion(qIdx)}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    title="Remove question"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Question Text */}
              <div className="mt-2 space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">
                  Question Text
                </label>
                <textarea
                  value={q.questionText}
                  onChange={(e) => handleUpdateQuestion(qIdx, "questionText", e.target.value)}
                  className="w-full min-h-[60px] rounded-lg border border-input bg-background p-2.5 text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </CardHeader>

            <CardContent className="space-y-3.5 pt-0">
              {/* Type: Multiple Choice or Timed Blitz */}
              {(q.type === "MULTIPLE_CHOICE" || q.type === "TIMED_BLITZ") && (
                <div className="space-y-2">
                  <label className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
                    <span>Options (Select the correct answer below)</span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                      Selected: &quot;{String(q.correctAnswer ?? "")}&quot;
                    </span>
                  </label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(q.options || []).map((opt, oIdx) => {
                      const isCorrect = q.correctAnswer === opt;
                      return (
                        <div
                          key={oIdx}
                          className={cn(
                            "flex items-center gap-2 rounded-lg border p-2 text-xs transition-all",
                            isCorrect
                              ? "border-emerald-500 bg-emerald-500/10 text-foreground"
                              : "border-border/60 bg-muted/20"
                          )}
                        >
                          <input
                            type="radio"
                            name={`correct_${qIdx}`}
                            checked={isCorrect}
                            onChange={() => handleSetCorrectOption(qIdx, opt)}
                            className="text-emerald-600 focus:ring-emerald-500"
                          />
                          <Input
                            value={opt}
                            onChange={(e) => handleUpdateOption(qIdx, oIdx, e.target.value)}
                            className="h-7 text-xs flex-1 bg-background"
                          />
                          {isCorrect && (
                            <Badge className="bg-emerald-600 text-white text-[9px] px-1 py-0 h-4">
                              Correct
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {q.type === "TIMED_BLITZ" && (
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/40">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      <label className="text-[11px] font-medium text-muted-foreground">
                        Timer Limit (seconds):
                      </label>
                      <Input
                        type="number"
                        min={5}
                        max={60}
                        value={q.timeLimitSeconds || 15}
                        onChange={(e) => handleUpdateQuestion(qIdx, "timeLimitSeconds", parseInt(e.target.value, 10) || 15)}
                        className="h-7 w-20 text-xs"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Type: True / False */}
              {q.type === "TRUE_FALSE" && (
                <div className="space-y-2">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    Correct Answer
                  </label>
                  <div className="flex items-center gap-3">
                    {["True", "False"].map((opt) => {
                      const isCorrect = q.correctAnswer === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => handleUpdateQuestion(qIdx, "correctAnswer", opt)}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-lg border text-xs font-semibold transition-all",
                            isCorrect
                              ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted"
                          )}
                        >
                          <div
                            className={cn(
                              "w-3.5 h-3.5 rounded-full border flex items-center justify-center",
                              isCorrect ? "border-emerald-600 bg-emerald-600" : "border-muted-foreground"
                            )}
                          >
                            {isCorrect && <Check className="w-2.5 h-2.5 text-white" />}
                          </div>
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Type: Fill in the Blank */}
              {q.type === "FILL_BLANK" && (
                <div className="space-y-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      Primary Correct Answer
                    </label>
                    <Input
                      value={typeof q.correctAnswer === "string" ? q.correctAnswer : ""}
                      onChange={(e) => handleUpdateQuestion(qIdx, "correctAnswer", e.target.value)}
                      placeholder="e.g. gravitational force"
                      className="h-8 text-xs font-semibold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Accepted Variations (comma-separated)
                    </label>
                    <Input
                      value={(q.acceptedAnswers || []).join(", ")}
                      onChange={(e) => {
                        const arr = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
                        handleUpdateQuestion(qIdx, "acceptedAnswers", arr);
                      }}
                      placeholder="e.g. gravity, gravitational attraction"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              )}

              {/* Type: Matching */}
              {q.type === "MATCHING" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Matching Pairs (Left Item ➔ Right Match)
                    </label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddMatchingPair(qIdx)}
                      className="h-6 text-[11px] px-2 gap-1"
                    >
                      <Plus className="w-2.5 h-2.5" /> Add Pair
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {(q.matchingPairs || []).map((pair, pIdx) => (
                      <div key={pIdx} className="flex items-center gap-2">
                        <Input
                          value={pair.left}
                          onChange={(e) => handleUpdateMatchingPair(qIdx, pIdx, "left", e.target.value)}
                          placeholder="Term / Concept..."
                          className="h-7 text-xs flex-1"
                        />
                        <span className="text-xs text-muted-foreground font-bold">➔</span>
                        <Input
                          value={pair.right}
                          onChange={(e) => handleUpdateMatchingPair(qIdx, pIdx, "right", e.target.value)}
                          placeholder="Definition / Target..."
                          className="h-7 text-xs flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveMatchingPair(qIdx, pIdx)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          title="Remove pair"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Type: Flashcard */}
              {q.type === "FLASHCARD" && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Front Concept / Prompt
                    </label>
                    <Input
                      value={q.front || q.questionText || ""}
                      onChange={(e) => {
                        handleUpdateQuestion(qIdx, "front", e.target.value);
                        handleUpdateQuestion(qIdx, "questionText", e.target.value);
                      }}
                      placeholder="e.g. Mitochondria"
                      className="h-8 text-xs font-medium"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      Back Definition / Explanation (Answer)
                    </label>
                    <textarea
                      value={typeof q.correctAnswer === "string" ? q.correctAnswer : (q.back || "")}
                      onChange={(e) => {
                        handleUpdateQuestion(qIdx, "back", e.target.value);
                        handleUpdateQuestion(qIdx, "correctAnswer", e.target.value);
                      }}
                      placeholder="e.g. Organelle that generates most of the chemical energy needed to power the cell's biochemical reactions."
                      className="w-full min-h-[50px] rounded-lg border border-input bg-background p-2 text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                </div>
              )}

              {/* Type: Ordering */}
              {q.type === "ORDERING" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Sequence Items (Arrange in correct chronological or procedural order)
                    </label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddOrderingItem(qIdx)}
                      className="h-6 text-[11px] px-2 gap-1"
                    >
                      <Plus className="w-2.5 h-2.5" /> Add Step
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {(q.items || []).map((item, itemIdx) => {
                      const itemObj = typeof item === "string" ? { id: `step_${itemIdx + 1}`, text: item } : item;
                      return (
                        <div key={itemObj.id || itemIdx} className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
                            {itemIdx + 1}
                          </span>
                          <Input
                            value={itemObj.text}
                            onChange={(e) => handleUpdateOrderingItem(qIdx, itemIdx, e.target.value)}
                            placeholder={`Step ${itemIdx + 1}...`}
                            className="h-7 text-xs flex-1"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveOrderingItem(qIdx, itemIdx)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            title="Remove step"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Explanation */}
              <div className="space-y-1 pt-1 border-t border-border/40">
                <label className="text-[11px] font-medium text-muted-foreground">
                  Explanation & Pedagogical Rationale
                </label>
                <textarea
                  value={q.explanation}
                  onChange={(e) => handleUpdateQuestion(qIdx, "explanation", e.target.value)}
                  className="w-full min-h-[50px] rounded-lg border border-input bg-background p-2 text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              {/* Source Citation */}
              <div className="flex items-center gap-2 bg-muted/30 rounded-lg p-2 border border-border/40 text-[11px]">
                <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground font-medium shrink-0">
                  Source Grounding:
                </span>
                <Input
                  value={q.sourceReference || ""}
                  onChange={(e) => handleUpdateQuestion(qIdx, "sourceReference", e.target.value)}
                  placeholder="Section / page citation..."
                  className="h-6 text-[11px] bg-background"
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Grounding Notes Card */}
      {content.sourceGroundingNotes && (
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-primary" />
              Source Grounding Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              value={content.sourceGroundingNotes}
              onChange={(e) => setContent({ ...content, sourceGroundingNotes: e.target.value })}
              className="w-full min-h-[60px] rounded-lg border border-input bg-background p-2 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </CardContent>
        </Card>
      )}
      {/* Publish Confirmation Dialog */}
      <PublishConfirmationDialog
        open={showPublishDialog}
        onOpenChange={setShowPublishDialog}
        contentType="ASSESSMENT"
        contentId={assessment.id}
        title={assessment.title}
        subject={assessment.subject}
        grade={assessment.gradeOrSemester || (assessment as any).grade}
        chapter={assessment.chapter}
        existingAccessCode={assessment.accessCode}
        existingStatus={assessment.status}
        summary={{
          itemCount: content.questions.length,
          difficulty: assessment.difficulty,
        }}
        onPublished={(result: any) => {
          const code = typeof result === "string" ? result : result.accessCode;
          const time = typeof result === "object" && result?.publishedAt ? result.publishedAt : new Date().toISOString();
          const updated = {
            ...assessment,
            status: "PUBLISHED" as const,
            accessCode: code,
            publishedAt: time,
          };
          setAssessment(updated);
          if (onAssessmentUpdated) onAssessmentUpdated(updated);
        }}
        onUnpublished={() => {
          const updated = {
            ...assessment,
            status: "DRAFT" as any,
            accessCode: undefined,
            publishedAt: undefined,
          };
          setAssessment(updated);
          if (onAssessmentUpdated) onAssessmentUpdated(updated);
        }}
      />
    </div>
  );
}
