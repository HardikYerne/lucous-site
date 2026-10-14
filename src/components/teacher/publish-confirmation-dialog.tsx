"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AccessCodeDisplay } from "./access-code-display";
import {
  publishTeacherContent,
  type PublishedContentType,
} from "@/lib/api";
import {
  Sparkles,
  AlertCircle,
  Loader2,
  FileText,
} from "lucide-react";

interface PublishConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentType: PublishedContentType;
  contentId: string;
  title: string;
  subject: string;
  chapter?: string | null;
  topic?: string | null;
  grade?: string | null;
  existingAccessCode?: string | null;
  existingStatus?: string;
  summary?: {
    itemCount?: number;
    topicsCount?: number;
    difficulty?: string;
  };
  itemSummary?: string | null;
  itemCount?: number;
  onPublished?: (result: any) => void;
  onUnpublished?: () => void;
}

export function PublishConfirmationDialog({
  open,
  onOpenChange,
  contentType,
  contentId,
  title,
  subject,
  chapter,
  topic,
  itemSummary,
  itemCount,
  onPublished,
}: PublishConfirmationDialogProps) {
  const [publishing, setPublishing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [publishedCode, setPublishedCode] = React.useState<string | null>(null);
  const [publishedTimestamp, setPublishedTimestamp] = React.useState<string | null>(null);

  // Reset local state when dialog closes
  React.useEffect(() => {
    if (!open) {
      setError(null);
      setPublishing(false);
      setPublishedCode(null);
      setPublishedTimestamp(null);
    }
  }, [open]);

  const handleConfirmPublish = async () => {
    setPublishing(true);
    setError(null);
    try {
      const res = await publishTeacherContent(contentType, contentId);
      if (res.success && res.accessCode) {
        setPublishedCode(res.accessCode);
        setPublishedTimestamp(res.publishedAt);
        if (onPublished) {
          onPublished({
            accessCode: res.accessCode,
            publishedAt: res.publishedAt,
          });
        }
      } else {
        throw new Error(res.message || "Failed to publish content.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Publication failed. Please verify all draft fields.");
    } finally {
      setPublishing(false);
    }
  };

  const isLesson = contentType === "LESSON";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 bg-card border-border/80">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
            <Sparkles className="h-5 w-5 text-emerald-500" />
            {publishedCode ? "Content Published" : `Publish ${isLesson ? "Lesson" : "Assessment"}`}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {publishedCode
              ? "Your content is live. Share the access code below with students."
              : `Review and confirm publication. Once published, students can view this ${
                  isLesson ? "lesson" : "assessment"
                } using their unique access code.`}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {publishedCode ? (
          <AccessCodeDisplay
            accessCode={publishedCode}
            title={title}
            publishedAt={publishedTimestamp || undefined}
            onDone={() => onOpenChange(false)}
          />
        ) : (
          <div className="space-y-4 py-2">
            {/* Content Preview Summary Card */}
            <div className="rounded-xl border border-border/70 bg-muted/30 p-4 space-y-2.5 overflow-hidden">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="text-[10px] font-semibold text-primary">
                  {isLesson ? "Educational Lesson" : "Assessment & Practice"}
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  {subject}
                </Badge>
                {chapter && (
                  <Badge variant="secondary" className="text-[10px]">
                    {chapter}
                  </Badge>
                )}
              </div>

              <h4 className="text-sm font-semibold text-foreground line-clamp-2 break-words [overflow-wrap:anywhere]">
                {title}
              </h4>

              {topic && (
                <p className="text-xs text-muted-foreground break-words [overflow-wrap:anywhere]">
                  Topic: <span className="font-medium text-foreground">{topic}</span>
                </p>
              )}

              {itemSummary && (
                <div className="bg-card/60 p-2 rounded-lg border border-border/40 overflow-hidden">
                  <p className="text-xs text-muted-foreground line-clamp-3 break-words [overflow-wrap:anywhere]">
                    {itemSummary}
                  </p>
                </div>
              )}

              {itemCount !== undefined && itemCount > 0 && (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  Contains <strong className="text-foreground">{itemCount}</strong>{" "}
                  {isLesson ? "explanation steps & review questions" : "interactive practice questions"}
                </p>
              )}
            </div>

            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-700 dark:text-amber-400 space-y-1">
              <p className="font-semibold">Student Visibility Note</p>
              <p className="text-[11px] leading-relaxed">
                Publishing generates an official access code and activates student access. You can unpublish anytime to revoke access immediately.
              </p>
            </div>

            <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={publishing}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleConfirmPublish}
                disabled={publishing}
                className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600"
              >
                {publishing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    Confirm & Publish
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
