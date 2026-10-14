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
  fetchTeacherPublishedContent,
  unpublishTeacherContent,
  type PublishedItemSummary,
} from "@/lib/api";
import {
  Copy,
  Check,
  Search,
  Sparkles,
  ExternalLink,
  RotateCcw,
  BookOpen,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { cn } from "cn";

export function PublishedContentList() {
  const [items, setItems] = React.useState<PublishedItemSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");

  // Copy tracking
  const [copiedCode, setCopiedCode] = React.useState<string | null>(null);

  // Unpublish tracking
  const [unpublishingId, setUnpublishingId] = React.useState<string | null>(null);
  const [confirmUnpublishId, setConfirmUnpublishId] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchTeacherPublishedContent();
      if (res && Array.isArray(res.items)) {
        setItems(res.items);
      } else {
        setItems([]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load published content.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCopy = async (code: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(code);
      }
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {}
  };

  const handleUnpublish = async (item: PublishedItemSummary) => {
    setUnpublishingId(item.id);
    try {
      await unpublishTeacherContent(item.contentType, item.id);
      setConfirmUnpublishId(null);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to unpublish content.");
    } finally {
      setUnpublishingId(null);
    }
  };

  const filteredItems = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.title.toLowerCase().includes(q) ||
        it.accessCode.toLowerCase().includes(q) ||
        it.subject.toLowerCase().includes(q) ||
        (it.topic && it.topic.toLowerCase().includes(q))
    );
  }, [items, searchQuery]);

  return (
    <Card className="border-border/80 shadow-sm bg-card">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
        <div className="space-y-1">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-500" />
            Published Learning Content & Access Codes
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Manage your live curriculum lessons and assessments. Students enter the access code to study.
          </CardDescription>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="text-xs gap-1.5 h-8"
          >
            <RotateCcw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Search input */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by title, subject, or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-8"
            />
          </div>
          <span className="text-xs text-muted-foreground ml-auto">
            Total Published: <strong className="text-foreground">{items.length}</strong>
          </span>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-32 rounded-xl border border-border/40 bg-muted/20 animate-pulse p-4"
              />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/80 p-10 text-center space-y-3 bg-muted/10">
            <BookOpen className="h-8 w-8 text-muted-foreground mx-auto" />
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-foreground">
                {items.length === 0 ? "No Published Content Yet" : "No Matches Found"}
              </h4>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                {items.length === 0
                  ? "Open any generated lesson or assessment draft and click 'Publish' to generate a student access code."
                  : "Try a different search query or clear the filter."}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-border/80 bg-card p-4 hover:border-emerald-500/40 transition-all flex flex-col justify-between space-y-3 shadow-xs"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-semibold text-foreground line-clamp-1">
                      {item.title}
                    </h4>
                    <Badge
                      variant="outline"
                      className="text-[10px] shrink-0 font-medium py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                    >
                      {item.contentType === "LESSON" ? "Lesson" : "Assessment"}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground">{item.subject}</span>
                    {item.topic && (
                      <>
                        <span>·</span>
                        <span className="truncate max-w-[140px]">{item.topic}</span>
                      </>
                    )}
                    {item.gradeOrSemester && (
                      <>
                        <span>·</span>
                        <span>{item.gradeOrSemester}</span>
                      </>
                    )}
                  </div>

                  {/* Prominent Access Code Bar */}
                  <div className="flex items-center justify-between rounded-lg bg-muted/40 p-2 border border-border/60">
                    <div className="space-y-0.5">
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                        Access Code
                      </p>
                      <p className="font-mono text-base font-bold text-primary tracking-wide">
                        {item.accessCode}
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(item.accessCode)}
                      className="h-7 text-xs gap-1 border-border/80"
                      title="Copy access code"
                    >
                      {copiedCode === item.accessCode ? (
                        <Check className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      {copiedCode === item.accessCode ? "Copied" : "Copy"}
                    </Button>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    Published: {new Date(item.publishedAt).toLocaleDateString()}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`/student/access?code=${encodeURIComponent(item.accessCode)}`}
                      target="_blank"
                    >
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground">
                        Preview
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </Link>

                    {confirmUnpublishId === item.id ? (
                      <div className="flex items-center gap-1 bg-destructive/10 border border-destructive/30 rounded-lg p-1 text-[11px]">
                        <span className="text-destructive font-medium px-1 text-[10px]">Revoke?</span>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-6 px-2 text-[10px]"
                          disabled={unpublishingId === item.id}
                          onClick={() => handleUnpublish(item)}
                        >
                          Yes
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5 text-[10px]"
                          onClick={() => setConfirmUnpublishId(null)}
                        >
                          No
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={unpublishingId === item.id}
                        onClick={() => setConfirmUnpublishId(item.id)}
                        className="h-7 text-xs px-2 text-muted-foreground hover:text-destructive"
                        title="Unpublish content and revoke access"
                      >
                        Unpublish
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
