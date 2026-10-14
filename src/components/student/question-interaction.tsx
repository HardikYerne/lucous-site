"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  Loader2,
  ArrowRight,
  RotateCcw,
  BookOpen,
  ArrowUp,
  ArrowDown,
  Clock,
  Eye,
  Sparkles,
} from "lucide-react";
import { checkStudentAnswer } from "@/lib/api";
import {
  CheckAnswerResponse,
  PublishedContentType,
  QuestionGradingResult,
  StudentAssessmentQuestion,
  StudentLessonReviewQuestion,
} from "@/types/published-content";
import { cn } from "cn";

interface QuestionInteractionProps {
  accessCode: string;
  contentType: PublishedContentType;
  questionNumber: number;
  question: StudentAssessmentQuestion | StudentLessonReviewQuestion;
  onAnswerChecked?: (isCorrect: boolean) => void;
  // Optional batch / assessment runner props
  isBatchMode?: boolean;
  batchValue?: unknown;
  onBatchChange?: (val: unknown) => void;
  readOnlyResult?: QuestionGradingResult | null;
}

export function QuestionInteraction({
  accessCode,
  contentType,
  questionNumber,
  question,
  onAnswerChecked,
  isBatchMode = false,
  batchValue,
  onBatchChange,
  readOnlyResult = null,
}: QuestionInteractionProps) {
  // Discriminate question type
  const isAssessmentQuestion = "type" in question;
  const qType = isAssessmentQuestion ? question.type : "SHORT_ANSWER";
  const questionText = isAssessmentQuestion ? question.questionText : question.question;
  const options = isAssessmentQuestion ? question.options : undefined;

  // Derive matching items
  const matchingLeft: string[] = React.useMemo(() => {
    if (!isAssessmentQuestion) return [];
    if (question.matchingLeft && Array.isArray(question.matchingLeft)) {
      return question.matchingLeft;
    }
    if (question.matchingPairs && Array.isArray(question.matchingPairs)) {
      return question.matchingPairs.map((p) => p.left);
    }
    return [];
  }, [isAssessmentQuestion, question]);

  const matchingRight: string[] = React.useMemo(() => {
    if (!isAssessmentQuestion) return [];
    if (question.matchingRight && Array.isArray(question.matchingRight)) {
      return question.matchingRight;
    }
    if (question.matchingPairs && Array.isArray(question.matchingPairs)) {
      return question.matchingPairs.map((p) => p.right).filter(Boolean);
    }
    return [];
  }, [isAssessmentQuestion, question]);

  // Derive ordering items
  const initialOrderingItems = React.useMemo(() => {
    if (!isAssessmentQuestion || !question.items) return [];
    return [...question.items];
  }, [isAssessmentQuestion, question]);

  // Local state for single practice mode
  const [selectedOption, setSelectedOption] = React.useState<string>("");
  const [textAnswer, setTextAnswer] = React.useState<string>("");
  const [matchingAnswers, setMatchingAnswers] = React.useState<Record<string, string>>({});
  const [orderItems, setOrderItems] = React.useState<{ id: string; text: string }[]>(initialOrderingItems);
  const [cardFlipped, setCardFlipped] = React.useState<boolean>(false);
  const [flashcardSelfAssessment, setFlashcardSelfAssessment] = React.useState<boolean | null>(null);

  // Timed Blitz countdown
  const timeLimitSeconds = isAssessmentQuestion && question.timeLimitSeconds ? question.timeLimitSeconds : 20;
  const [timeLeft, setTimeLeft] = React.useState<number>(timeLimitSeconds);
  const [timerExpired, setTimerExpired] = React.useState<boolean>(false);

  const [loading, setLoading] = React.useState(false);
  const [localResult, setLocalResult] = React.useState<CheckAnswerResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Sync batch value when parent provides it
  React.useEffect(() => {
    if (isBatchMode && batchValue !== undefined) {
      if (qType === "MULTIPLE_CHOICE" || qType === "TRUE_FALSE" || qType === "TIMED_BLITZ") {
        if (typeof batchValue === "string") setSelectedOption(batchValue);
      } else if (qType === "FILL_BLANK" || qType === "SHORT_ANSWER") {
        if (typeof batchValue === "string") setTextAnswer(batchValue);
      } else if (qType === "MATCHING") {
        if (typeof batchValue === "object" && batchValue !== null) {
          setMatchingAnswers(batchValue as Record<string, string>);
        }
      } else if (qType === "ORDERING") {
        if (Array.isArray(batchValue)) {
          // Reorder items to reflect batchValue array of IDs
          const idList = batchValue as string[];
          const currentMap = new Map(initialOrderingItems.map((it) => [it.id, it]));
          const sorted = idList.map((id) => currentMap.get(id)).filter(Boolean) as { id: string; text: string }[];
          if (sorted.length === initialOrderingItems.length) {
            setOrderItems(sorted);
          }
        }
      } else if (qType === "FLASHCARD") {
        if (typeof batchValue === "boolean") {
          setFlashcardSelfAssessment(batchValue);
        }
      }
    }
  }, [isBatchMode, batchValue, qType, initialOrderingItems]);

  // Timed Blitz timer effect
  React.useEffect(() => {
    if (qType !== "TIMED_BLITZ" || localResult !== null || readOnlyResult !== null) return;
    if (timeLeft <= 0) {
      setTimerExpired(true);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setTimerExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [qType, localResult, readOnlyResult, timeLeft]);

  // Combined result state
  const isChecked = readOnlyResult !== null || localResult !== null;
  const isCorrect = readOnlyResult ? readOnlyResult.isCorrect : localResult?.isCorrect;
  const explanation = readOnlyResult ? readOnlyResult.explanation : localResult?.explanation;
  const correctAnswer = readOnlyResult ? readOnlyResult.correctAnswer : localResult?.correctAnswer;
  const sourceRef = readOnlyResult ? readOnlyResult.sourceReference : localResult?.sourceReference;

  // Single practice check
  const handleCheck = async () => {
    let answerToSubmit: unknown = null;

    if (qType === "MULTIPLE_CHOICE" || qType === "TRUE_FALSE" || qType === "TIMED_BLITZ") {
      if (!selectedOption) {
        setError("Please select an option before checking.");
        return;
      }
      answerToSubmit = selectedOption;
    } else if (qType === "FILL_BLANK" || qType === "SHORT_ANSWER") {
      if (!textAnswer.trim()) {
        setError("Please type your answer before checking.");
        return;
      }
      answerToSubmit = textAnswer.trim();
    } else if (qType === "MATCHING") {
      const matchedKeys = Object.keys(matchingAnswers).filter((k) => Boolean(matchingAnswers[k]));
      if (matchingLeft.length > 0 && matchedKeys.length < matchingLeft.length) {
        setError("Please select a match for every item on the left.");
        return;
      }
      answerToSubmit = matchingAnswers;
    } else if (qType === "ORDERING") {
      answerToSubmit = orderItems.map((it) => it.id);
    } else if (qType === "FLASHCARD") {
      if (flashcardSelfAssessment === null) {
        setError("Please flip the card and indicate if you remembered this concept.");
        return;
      }
      answerToSubmit = flashcardSelfAssessment;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await checkStudentAnswer({
        accessCode,
        contentType,
        questionId: question.id,
        submittedAnswer: answerToSubmit,
      });

      setLocalResult(res);
      if (onAnswerChecked) {
        onAnswerChecked(res.isCorrect);
      }
    } catch (err: unknown) {
      console.error("Check answer error:", err);
      const msg = err instanceof Error ? err.message : "Failed to check answer. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedOption("");
    setTextAnswer("");
    setMatchingAnswers({});
    setOrderItems(initialOrderingItems);
    setCardFlipped(false);
    setFlashcardSelfAssessment(null);
    setTimeLeft(timeLimitSeconds);
    setTimerExpired(false);
    setLocalResult(null);
    setError(null);
  };

  // Reorder helpers for ORDERING
  const moveOrderItem = (fromIndex: number, toIndex: number) => {
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= orderItems.length || toIndex >= orderItems.length) return;
    const next = [...orderItems];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setOrderItems(next);
    if (isBatchMode && onBatchChange) {
      onBatchChange(next.map((it) => it.id));
    }
  };

  // Matching update helper
  const handleMatchSelect = (leftItem: string, rightVal: string) => {
    const next = { ...matchingAnswers, [leftItem]: rightVal };
    setMatchingAnswers(next);
    if (error) setError(null);
    if (isBatchMode && onBatchChange) {
      onBatchChange(next);
    }
  };

  return (
    <Card
      className={cn(
        "border transition-all duration-200 overflow-hidden",
        isChecked
          ? isCorrect
            ? "border-emerald-500/40 bg-emerald-500/5 shadow-xs"
            : "border-destructive/40 bg-destructive/5 shadow-xs"
          : "border-border/70 hover:border-border shadow-xs"
      )}
    >
      <CardContent className="p-4 sm:p-5 space-y-4">
        {/* Question Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
              {questionNumber}
            </span>
            <Badge variant="outline" className="text-[10px] font-mono uppercase tracking-wide">
              {qType.replace("_", " ")}
            </Badge>

            {qType === "TIMED_BLITZ" && !isChecked && (
              <Badge
                variant="outline"
                className={cn(
                  "text-xs gap-1 font-mono font-semibold transition-colors",
                  timeLeft <= 5
                    ? "border-destructive text-destructive bg-destructive/10 animate-pulse"
                    : "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                )}
              >
                <Clock className="w-3 h-3" /> {timeLeft}s remaining
              </Badge>
            )}
          </div>

          {isChecked && (
            <Badge
              className={cn(
                "text-xs font-medium gap-1",
                isCorrect
                  ? "bg-emerald-500 text-white"
                  : "bg-destructive text-destructive-foreground"
              )}
            >
              {isCorrect ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Correct!
                </>
              ) : (
                <>
                  <XCircle className="w-3.5 h-3.5" /> Incorrect
                </>
              )}
            </Badge>
          )}
        </div>

        {/* Question Text */}
        <p className="text-sm sm:text-base font-medium text-foreground leading-relaxed">
          {questionText || (isAssessmentQuestion ? question.front : "")}
        </p>

        {/* 1. MULTIPLE CHOICE & TIMED BLITZ */}
        {(qType === "MULTIPLE_CHOICE" || qType === "TIMED_BLITZ") && options && options.length > 0 && (
          <div className="space-y-2 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {options.map((opt, idx) => {
                const isSelected = selectedOption === opt;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      if (!isChecked && (!timerExpired || isBatchMode)) {
                        setSelectedOption(opt);
                        if (error) setError(null);
                        if (isBatchMode && onBatchChange) {
                          onBatchChange(opt);
                        }
                      }
                    }}
                    disabled={isChecked || loading || (qType === "TIMED_BLITZ" && timerExpired && !isBatchMode)}
                    className={cn(
                      "flex items-center gap-3 p-3 text-left rounded-xl border text-xs sm:text-sm font-medium transition-all duration-150 cursor-pointer disabled:cursor-default",
                      isSelected
                        ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                        : "border-border/60 hover:border-border hover:bg-muted/50 text-foreground bg-card"
                    )}
                  >
                    <span
                      className={cn(
                        "w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold shrink-0",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground"
                      )}
                    >
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="leading-snug">{opt}</span>
                  </button>
                );
              })}
            </div>
            {timerExpired && !isChecked && qType === "TIMED_BLITZ" && (
              <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1">
                <Clock className="w-3.5 h-3.5" /> Time expired for this question!
              </p>
            )}
          </div>
        )}

        {/* 2. TRUE / FALSE */}
        {qType === "TRUE_FALSE" && (
          <div className="space-y-2 pt-1">
            <div className="grid grid-cols-2 gap-2 max-w-xs">
              {["True", "False"].map((opt) => {
                const isSelected = selectedOption.toLowerCase() === opt.toLowerCase();
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      if (!isChecked) {
                        setSelectedOption(opt);
                        if (error) setError(null);
                        if (isBatchMode && onBatchChange) {
                          onBatchChange(opt);
                        }
                      }
                    }}
                    disabled={isChecked || loading}
                    className={cn(
                      "p-3 rounded-xl border text-center text-xs sm:text-sm font-semibold transition-all duration-150 cursor-pointer disabled:cursor-default",
                      isSelected
                        ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                        : "border-border/60 hover:border-border hover:bg-muted/50 text-foreground bg-card"
                    )}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. FILL IN THE BLANK / SHORT ANSWER */}
        {(qType === "FILL_BLANK" || qType === "SHORT_ANSWER") && (
          <div className="space-y-2 pt-1">
            <Input
              type="text"
              placeholder="Type your answer here..."
              value={textAnswer}
              onChange={(e) => {
                setTextAnswer(e.target.value);
                if (error) setError(null);
                if (isBatchMode && onBatchChange) {
                  onBatchChange(e.target.value);
                }
              }}
              disabled={isChecked || loading}
              className="h-10 text-xs sm:text-sm rounded-lg"
            />
          </div>
        )}

        {/* 4. MATCHING CHALLENGE */}
        {qType === "MATCHING" && (
          <div className="space-y-3 pt-1">
            <p className="text-xs text-muted-foreground">
              Match each term on the left with the correct definition on the right:
            </p>
            <div className="space-y-2.5">
              {matchingLeft.map((leftItem, idx) => (
                <div
                  key={idx}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl border border-border/70 bg-card text-xs"
                >
                  <span className="font-semibold text-foreground sm:w-1/2 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] shrink-0 font-bold">
                      {idx + 1}
                    </span>
                    {leftItem}
                  </span>

                  <select
                    value={matchingAnswers[leftItem] || ""}
                    onChange={(e) => handleMatchSelect(leftItem, e.target.value)}
                    disabled={isChecked || loading}
                    aria-label={`Match for ${leftItem}`}
                    className="h-9 px-3 rounded-lg border border-input bg-background text-foreground text-xs font-medium focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer sm:w-1/2"
                  >
                    <option value="">— Select matching pair —</option>
                    {matchingRight.map((rOpt, rIdx) => (
                      <option key={rIdx} value={rOpt}>
                        {rOpt}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. ORDERING CHALLENGE */}
        {qType === "ORDERING" && (
          <div className="space-y-3 pt-1">
            <p className="text-xs text-muted-foreground">
              Use the up and down arrows to place these steps in the correct chronological order:
            </p>
            <div className="space-y-2">
              {orderItems.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border/70 bg-card text-xs sm:text-sm transition-all duration-150"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-medium text-foreground">{item.text}</span>
                  </div>

                  {!isChecked && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={idx === 0 || loading}
                        onClick={() => moveOrderItem(idx, idx - 1)}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                        aria-label={`Move ${item.text} up`}
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={idx === orderItems.length - 1 || loading}
                        onClick={() => moveOrderItem(idx, idx + 1)}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                        aria-label={`Move ${item.text} down`}
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. FLASHCARD REVEAL & SELF-ASSESSMENT */}
        {qType === "FLASHCARD" && (
          <div className="space-y-3 pt-1">
            <div
              onClick={() => {
                if (!isChecked) setCardFlipped((prev) => !prev);
              }}
              className={cn(
                "min-h-[110px] p-4 rounded-xl border border-dashed border-primary/40 bg-gradient-to-br from-primary/5 to-purple-500/5 flex flex-col items-center justify-center text-center cursor-pointer hover:border-primary transition-all",
                cardFlipped ? "bg-primary/10 border-solid" : ""
              )}
            >
              <div className="flex items-center gap-1.5 text-xs text-primary font-semibold mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{cardFlipped ? "Revealed Back / Key Concept" : "Front Prompt (Click to Flip)"}</span>
              </div>
              <p className="text-sm sm:text-base font-semibold text-foreground">
                {cardFlipped
                  ? correctAnswer
                    ? String(correctAnswer)
                    : "Review the definition and explanation below."
                  : isAssessmentQuestion
                  ? question.front || question.questionText
                  : questionText}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCardFlipped((prev) => !prev)}
                className="text-xs gap-1.5 h-8"
              >
                <Eye className="w-3.5 h-3.5" />
                {cardFlipped ? "Flip Back" : "Reveal Answer"}
              </Button>

              {cardFlipped && !isChecked && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Self-Check:</span>
                  <Button
                    type="button"
                    size="sm"
                    variant={flashcardSelfAssessment === true ? "default" : "outline"}
                    onClick={() => {
                      setFlashcardSelfAssessment(true);
                      if (error) setError(null);
                      if (isBatchMode && onBatchChange) {
                        onBatchChange(true);
                      }
                    }}
                    className="text-xs h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    I Knew This
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={flashcardSelfAssessment === false ? "destructive" : "outline"}
                    onClick={() => {
                      setFlashcardSelfAssessment(false);
                      if (error) setError(null);
                      if (isBatchMode && onBatchChange) {
                        onBatchChange(false);
                      }
                    }}
                    className="text-xs h-7 px-2.5"
                  >
                    Needs Review
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <p className="text-xs text-destructive flex items-center gap-1.5 pt-1">
            <XCircle className="w-3.5 h-3.5" /> {error}
          </p>
        )}

        {/* Feedback & Explanation Box (Shown only after verification) */}
        {isChecked && (
          <div className="rounded-xl border border-border/70 bg-card p-3.5 space-y-2 text-xs animate-in fade-in-50 duration-200">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <HelpCircle className="w-3.5 h-3.5 text-primary" />
              <span>Explanation & Verified Answer Key</span>
            </div>

            {correctAnswer !== undefined && correctAnswer !== null && (
              <div className="p-2 rounded-lg bg-muted/40 font-mono text-xs text-foreground">
                <strong className="text-primary mr-1">Correct Answer:</strong>
                {typeof correctAnswer === "object"
                  ? JSON.stringify(correctAnswer)
                  : String(correctAnswer)}
              </div>
            )}

            <p className="text-muted-foreground leading-relaxed">
              {explanation || "Concept verified against curriculum source material."}
            </p>

            {sourceRef && (
              <p className="text-[11px] text-primary/80 flex items-center gap-1 pt-1 border-t border-border/40">
                <BookOpen className="w-3 h-3" />
                <span>Source Grounding: {sourceRef}</span>
              </p>
            )}
          </div>
        )}

        {/* Action Buttons for Single Practice Mode */}
        {!isBatchMode && (
          <div className="flex items-center justify-between pt-2">
            {!isChecked ? (
              <Button
                size="sm"
                onClick={handleCheck}
                disabled={loading}
                className="text-xs font-semibold gap-1.5 h-8 px-4 ml-auto"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking…
                  </>
                ) : (
                  <>
                    Check Answer <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="text-xs gap-1.5 h-8 px-3 ml-auto text-muted-foreground"
              >
                <RotateCcw className="w-3 h-3" /> Try Again
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
