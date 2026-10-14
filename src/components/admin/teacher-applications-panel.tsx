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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  fetchAdminTeacherApplications,
  reviewAdminTeacherApplication,
  getUserInitials,
  type TeacherApplication,
} from "@/lib/api";

export function TeacherApplicationsPanel() {
  const [applications, setApplications] = React.useState<TeacherApplication[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [search, setSearch] = React.useState("");
  const [error, setError] = React.useState("");
  const [actionSuccess, setActionSuccess] = React.useState("");

  // Reject modal / inline state
  const [rejectingAppId, setRejectingAppId] = React.useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = React.useState("");
  const [submittingDecision, setSubmittingDecision] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchAdminTeacherApplications(statusFilter, search);
      setApplications(res.applications || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load teacher applications");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function handleApprove(app: TeacherApplication) {
    if (!confirm(`Are you sure you want to approve ${app.name} as a verified teacher?`)) {
      return;
    }

    setSubmittingDecision(true);
    setError("");
    setActionSuccess("");
    try {
      const res = await reviewAdminTeacherApplication(app.userId, { status: "APPROVED" });
      setActionSuccess(`Successfully approved ${app.name}. Teaching permissions and publishing are now active.`);
      setApplications((prev) => prev.map((a) => (a.userId === app.userId ? res.application : a)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve application");
    } finally {
      setSubmittingDecision(false);
    }
  }

  async function handleRejectSubmit(userId: string) {
    if (!rejectionReason.trim()) {
      setError("Please provide a reason for rejecting the application.");
      return;
    }

    setSubmittingDecision(true);
    setError("");
    setActionSuccess("");
    try {
      const res = await reviewAdminTeacherApplication(userId, {
        status: "REJECTED",
        reason: rejectionReason.trim(),
      });
      setActionSuccess(`Application for ${res.application.name} marked as rejected with feedback.`);
      setApplications((prev) => prev.map((a) => (a.userId === userId ? res.application : a)));
      setRejectingAppId(null);
      setRejectionReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject application");
    } finally {
      setSubmittingDecision(false);
    }
  }

  const pendingCount = applications.filter((a) => a.status === "PENDING").length;

  return (
    <div className="grid gap-6">
      {/* Top Controls */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                Teacher Verification Applications
                {pendingCount > 0 && (
                  <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    {pendingCount} Pending Review
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Review applicant identities, credentials, academic qualifications, and supporting documents before granting teacher access.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={load} disabled={loading || submittingDecision}>
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1.5">
              {(["ALL", "PENDING", "APPROVED", "REJECTED"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1 text-xs rounded-md border transition-colors ${
                    statusFilter === s
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border hover:bg-muted/50 text-muted-foreground"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search candidate by name, email, school, or subject..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {actionSuccess && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400">
          {actionSuccess}
        </div>
      )}

      {/* Applications List */}
      {loading ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Loading teacher applications...
          </CardContent>
        </Card>
      ) : applications.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No teacher applications found matching the selected filter.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {applications.map((app) => (
            <Card key={app.id || app.userId} className="overflow-hidden">
              <CardHeader className="bg-muted/10 pb-3 border-b">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-12 ring-1 ring-border">
                      {app.avatarUrl ? (
                        <AvatarImage src={app.avatarUrl} alt={app.name} className="object-cover" />
                      ) : null}
                      <AvatarFallback className="font-semibold text-sm">
                        {getUserInitials(app.name, app.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-base">{app.name}</span>
                        {app.status === "APPROVED" && (
                          <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs">
                            Approved
                          </Badge>
                        )}
                        {app.status === "PENDING" && (
                          <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs">
                            Pending Review
                          </Badge>
                        )}
                        {app.status === "REJECTED" && (
                          <Badge variant="outline" className="border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400 text-xs">
                            Rejected
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {app.email} · Submitted {new Date(app.submittedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* Decision Actions */}
                  <div className="flex items-center gap-2">
                    {app.status !== "APPROVED" && (
                      <Button
                        size="sm"
                        variant="default"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => handleApprove(app)}
                        disabled={submittingDecision}
                      >
                        Approve Teacher
                      </Button>
                    )}
                    {app.status !== "REJECTED" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-500/30 hover:bg-red-500/10"
                        onClick={() => {
                          setRejectingAppId(app.userId);
                          setRejectionReason("");
                        }}
                        disabled={submittingDecision}
                      >
                        Reject...
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-4 grid gap-4">
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                      Institution / School
                    </span>
                    <p className="mt-0.5">{app.school || "Not specified"}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                      Qualified Subjects
                    </span>
                    <p className="mt-0.5">{app.subject || "Not specified"}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                      Qualifications & Degrees
                    </span>
                    <p className="mt-0.5">{app.qualifications || "Pending submission"}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                      Teaching Experience
                    </span>
                    <p className="mt-0.5">{app.experience || "Not specified"}</p>
                  </div>
                </div>

                {/* Supporting Documents */}
                <div className="border-t pt-3">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                    Supporting Documents ({app.documents?.length || 0})
                  </span>
                  {!app.documents || app.documents.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No supporting documents uploaded.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {app.documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-1.5 text-xs"
                        >
                          <span className="font-mono font-bold text-primary">DOC</span>
                          <span className="truncate max-w-[180px]" title={doc.originalName}>
                            {doc.originalName}
                          </span>
                          <span className="text-muted-foreground">({(doc.size / 1024).toFixed(0)} KB)</span>
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary font-medium hover:underline ml-1"
                          >
                            Inspect
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Rejection / Decision Notes */}
                {app.status === "REJECTED" && app.rejectionReason && (
                  <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-800 dark:text-red-300">
                    <span className="font-semibold block mb-0.5">Rejection Feedback Given:</span>
                    <p>{app.rejectionReason}</p>
                    {app.reviewedAt && (
                      <span className="text-[10px] opacity-75 block mt-1">
                        Decision recorded on {new Date(app.reviewedAt).toLocaleString()}
                        {app.reviewedByName ? ` by ${app.reviewedByName}` : ""}
                      </span>
                    )}
                  </div>
                )}

                {app.status === "APPROVED" && app.reviewedAt && (
                  <div className="text-[11px] text-muted-foreground border-t pt-2">
                    Approved by {app.reviewedByName || "Administrator"} on {new Date(app.reviewedAt).toLocaleDateString()}
                  </div>
                )}

                {/* Inline Rejection Reason Prompt */}
                {rejectingAppId === app.userId && (
                  <div className="rounded-lg border border-red-500/40 bg-red-500/5 p-4 mt-2">
                    <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2">
                      Reject Application for {app.name}
                    </p>
                    <p className="text-xs text-muted-foreground mb-2">
                      Provide constructive feedback explaining what credentials, documents, or details need correction before this teacher can be approved.
                    </p>
                    <Input
                      placeholder="e.g. Please provide a clear copy of your teaching license or institutional ID."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="text-sm mb-3"
                      disabled={submittingDecision}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setRejectingAppId(null);
                          setRejectionReason("");
                        }}
                        disabled={submittingDecision}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleRejectSubmit(app.userId)}
                        disabled={submittingDecision || !rejectionReason.trim()}
                      >
                        {submittingDecision ? "Saving..." : "Confirm Rejection"}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
