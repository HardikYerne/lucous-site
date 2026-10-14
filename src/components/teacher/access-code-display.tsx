"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy, Share2, Sparkles, ExternalLink } from "lucide-react";
import Link from "next/link";

interface AccessCodeDisplayProps {
  accessCode: string;
  title: string;
  publishedAt?: string | Date;
  onDone?: () => void;
}

export function AccessCodeDisplay({
  accessCode,
  title,
  publishedAt,
  onDone,
}: AccessCodeDisplayProps) {
  const [copiedCode, setCopiedCode] = React.useState(false);
  const [copiedLink, setCopiedLink] = React.useState(false);

  const shareableUrl = React.useMemo(() => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/student/access?code=${encodeURIComponent(accessCode)}`;
    }
    return `/student/access?code=${encodeURIComponent(accessCode)}`;
  }, [accessCode]);

  const handleCopyCode = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(accessCode);
      }
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleCopyLink = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(shareableUrl);
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // Fallback
    }
  };

  const formattedDate = publishedAt
    ? new Date(publishedAt).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Just now";

  return (
    <div className="space-y-5 py-2">
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center space-y-4 dark:bg-emerald-950/20">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <Sparkles className="h-3.5 w-3.5" />
          Published Successfully
        </div>

        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground line-clamp-1">
            {title}
          </h3>
          <p className="text-xs text-muted-foreground">
            Published on {formattedDate} · Ready for student access
          </p>
        </div>

        {/* Big Access Code Card */}
        <div className="mx-auto max-w-sm rounded-xl border border-border/80 bg-card p-5 shadow-sm space-y-2 dark:bg-card">
          <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
            Unique Student Access Code
          </p>
          <div className="flex items-center justify-center gap-2">
            <span className="font-mono text-3xl sm:text-4xl font-extrabold tracking-wider text-primary select-all">
              {accessCode}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Share this code with your students to grant access.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleCopyCode}
            className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600"
          >
            {copiedCode ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copiedCode ? "Code Copied!" : "Copy Code"}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            className="gap-1.5 text-xs border-border/80"
          >
            {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
            {copiedLink ? "Link Copied!" : "Copy Student Link"}
          </Button>

          <Link href={`/student/access?code=${encodeURIComponent(accessCode)}`} target="_blank">
            <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground">
              Preview as Student
              <ExternalLink className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </div>

      {onDone && (
        <div className="flex justify-end pt-2">
          <Button type="button" onClick={onDone} className="text-xs px-4">
            Done
          </Button>
        </div>
      )}
    </div>
  );
}
