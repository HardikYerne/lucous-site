"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Check, Clock, Copy, KeyRound, Link2, Loader2, ShieldOff } from "lucide-react";
import {
  createClassCode,
  fetchClassCodes,
  revokeClassCode,
  type ClassCodeItem,
} from "@/lib/api";

const DURATIONS = [
  { label: "1 hour", minutes: 60 },
  { label: "6 hours", minutes: 6 * 60 },
  { label: "24 hours", minutes: 24 * 60 },
  { label: "3 days", minutes: 3 * 24 * 60 },
  { label: "7 days", minutes: 7 * 24 * 60 },
  { label: "30 days", minutes: 30 * 24 * 60 },
];

function timeLeft(expiresAt: string, now: number): string {
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return "Expired";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${Math.max(mins, 1)} min left`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours} h ${mins % 60} min left`;
  return `${Math.floor(hours / 24)} days left`;
}

export function ClassCodePanel() {
  const [items, setItems] = React.useState<ClassCodeItem[]>([]);
  const [publishedCount, setPublishedCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [minutes, setMinutes] = React.useState(24 * 60);
  const [copied, setCopied] = React.useState("");
  const [now, setNow] = React.useState(() => Date.now());

  const load = React.useCallback(async () => {
    try {
      const data = await fetchClassCodes();
      setItems(data.items);
      setPublishedCount(data.publishedCount);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load class codes");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  // Keep the "time left" labels fresh.
  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  async function onCreate() {
    setCreating(true);
    setError("");
    try {
      await createClassCode({ title: title.trim() || undefined, durationMinutes: minutes });
      setTitle("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create code");
    } finally {
      setCreating(false);
    }
  }

  async function onRevoke(id: string) {
    setError("");
    try {
      await revokeClassCode(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to turn off code");
    }
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(""), 2200);
    } catch {
      /* clipboard not available */
    }
  }

  const link = (code: string) =>
    `${typeof window !== "undefined" ? window.location.origin : ""}/student/access?code=${encodeURIComponent(code)}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-5 text-primary" aria-hidden />
          Class access code
        </CardTitle>
        <CardDescription>
          Create one secure code for your students. While it is active they can open all{" "}
          <strong>{publishedCount}</strong> of your published lessons and assessments. When the
          time ends, the code stops working.
        </CardDescription>
      </CardHeader>

      <CardContent className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
          <label className="grid gap-1.5 text-sm font-medium">
            Name (optional)
            <Input
              value={title}
              maxLength={80}
              placeholder="e.g. Class 10 A – Science"
              onChange={(e) => setTitle(e.target.value)}
              disabled={creating}
              className="h-10"
            />
          </label>

          <label className="grid gap-1.5 text-sm font-medium">
            Valid for
            <select
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              disabled={creating}
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {DURATIONS.map((d) => (
                <option key={d.minutes} value={d.minutes}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>

          <Button onClick={onCreate} disabled={creating || publishedCount === 0} className="h-10">
            {creating ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {creating ? "Creating…" : "Generate code"}
          </Button>
        </div>

        {publishedCount === 0 && !loading ? (
          <p className="text-xs text-muted-foreground">
            Publish at least one lesson or assessment first, then generate a class code.
          </p>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No class codes yet.</p>
        ) : (
          <div className="grid gap-2">
            {items.map((item) => {
              const active = item.status === "ACTIVE" && new Date(item.expiresAt).getTime() > now;
              return (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="font-mono text-base font-bold tracking-widest">{item.code}</code>
                      <Badge variant={active ? "secondary" : "outline"}>
                        {active ? "Active" : item.status === "REVOKED" ? "Turned off" : "Expired"}
                      </Badge>
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="size-3" aria-hidden />
                      {item.title ? `${item.title} · ` : ""}
                      {active
                        ? timeLeft(item.expiresAt, now)
                        : `Ended ${new Date(item.revokedAt ?? item.expiresAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`}
                    </p>
                  </div>

                  {active ? (
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => copy(item.code, `c-${item.id}`)}>
                        {copied === `c-${item.id}` ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
                        Copy code
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => copy(link(item.code), `l-${item.id}`)}>
                        {copied === `l-${item.id}` ? <Check className="size-3.5" aria-hidden /> : <Link2 className="size-3.5" aria-hidden />}
                        Copy link
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => onRevoke(item.id)}>
                        <ShieldOff className="size-3.5" aria-hidden />
                        Turn off
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
