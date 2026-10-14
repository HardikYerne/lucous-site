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
  fetchTeacherApplication,
  submitTeacherApplication,
  uploadTeacherDocument,
  getUserInitials,
  type TeacherApplication,
  type TeacherDocument,
} from "@/lib/api";

interface TeacherApplicationPanelProps {
  onApplicationUpdated?: (app: TeacherApplication) => void;
}

export function TeacherApplicationPanel({ onApplicationUpdated }: TeacherApplicationPanelProps) {
  const [app, setApp] = React.useState<TeacherApplication | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [uploadingDoc, setUploadingDoc] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");

  // Form fields
  const [name, setName] = React.useState("");
  const [institution, setInstitution] = React.useState("");
  const [subjects, setSubjects] = React.useState("");
  const [qualifications, setQualifications] = React.useState("");
  const [experience, setExperience] = React.useState("");
  const [documents, setDocuments] = React.useState<TeacherDocument[]>([]);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchTeacherApplication();
      if (res.application) {
        setApp(res.application);
        setName(res.application.name || "");
        setInstitution(res.application.school || "");
        setSubjects(res.application.subject || "");
        setQualifications(res.application.qualifications || "");
        setExperience(res.application.experience || "");
        setDocuments(res.application.documents || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load application");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!name.trim()) {
      setError("Legal full name is required.");
      return;
    }
    if (!qualifications.trim()) {
      setError("Please describe your educational qualifications & degrees.");
      return;
    }
    if (!institution.trim()) {
      setError("Please specify your current or most recent educational institution.");
      return;
    }
    if (!subjects.trim()) {
      setError("Please specify the subjects you are qualified to teach.");
      return;
    }

    setSaving(true);
    try {
      const res = await submitTeacherApplication({
        name: name.trim(),
        avatarUrl: app?.avatarUrl || null,
        institution: institution.trim(),
        subjects: subjects.trim(),
        qualifications: qualifications.trim(),
        experience: experience.trim(),
        documents,
      });

      setApp(res.application);
      setSuccess("Application submitted successfully! Your credentials are now pending admin review.");
      if (onApplicationUpdated) onApplicationUpdated(res.application);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit application");
    } finally {
      setSaving(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError("Document exceeds 10MB limit.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setError("");
    setUploadingDoc(true);
    try {
      const res = await uploadTeacherDocument(file);
      if (res.success && res.document) {
        setDocuments((prev) => [...prev, res.document!]);
        setSuccess(`Document "${file.name}" uploaded securely.`);
      } else {
        setError(res.message || "Failed to upload document");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Document upload failed");
    } finally {
      setUploadingDoc(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleRemoveDoc(id: string) {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Loading teacher application...
        </CardContent>
      </Card>
    );
  }

  const isApproved = app?.status === "APPROVED";
  const isPending = app?.status === "PENDING";
  const isRejected = app?.status === "REJECTED";

  return (
    <div className="grid gap-6">
      {/* Application Status Banner */}
      <Card className={isApproved ? "border-emerald-500/30 bg-emerald-500/5" : isRejected ? "border-red-500/30 bg-red-500/5" : "border-amber-500/30 bg-amber-500/5"}>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                Teacher Identity Verification
                {isApproved && (
                  <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    Approved
                  </Badge>
                )}
                {isPending && (
                  <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    Pending Review
                  </Badge>
                )}
                {isRejected && (
                  <Badge variant="outline" className="border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400">
                    Action Required
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {isApproved && "Your teacher credentials have been verified and approved by administration. All teaching and publishing tools are active."}
                {isPending && "Your application is currently under review by administrators. Content publishing will unlock upon approval."}
                {isRejected && "Your application requires correction. Please review the feedback below, make necessary updates, and resubmit."}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        {isRejected && app?.rejectionReason && (
          <CardContent className="pt-0">
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-800 dark:text-red-300">
              <p className="font-semibold mb-1">Feedback from Administrator:</p>
              <p>{app.rejectionReason}</p>
              {app.reviewedAt && (
                <p className="mt-2 text-xs opacity-80">
                  Reviewed on {new Date(app.reviewedAt).toLocaleDateString()}
                  {app.reviewedByName ? ` by ${app.reviewedByName}` : ""}
                </p>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Main Form */}
      <Card>
        <CardHeader>
          <CardTitle>{isApproved ? "Verified Teacher Credentials" : "Teacher Verification Application"}</CardTitle>
          <CardDescription>
            Provide your legal identity, academic qualifications, and supporting documentation for administrative verification.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-5">
            {error && (
              <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400">
                {success}
              </div>
            )}

            {/* Profile Avatar Snapshot */}
            <div className="flex items-center gap-4 p-4 rounded-lg border bg-muted/20">
              <Avatar className="size-16 ring-1 ring-border">
                {app?.avatarUrl ? (
                  <AvatarImage src={app.avatarUrl} alt={name || "Teacher"} className="object-cover" />
                ) : null}
                <AvatarFallback className="text-base font-semibold">
                  {getUserInitials(name, app?.email)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">Profile Picture</p>
                <p className="text-xs text-muted-foreground">
                  Synchronized with your account profile. You can update your picture anytime on the Profile tab.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Legal Full Name *</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Dr. Sarah Parker"
                  disabled={saving}
                  className="mt-1"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium">Educational Institution / School *</label>
                <Input
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="e.g. Springfield Senior High School"
                  disabled={saving}
                  className="mt-1"
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Teaching Subjects *</label>
                <Input
                  value={subjects}
                  onChange={(e) => setSubjects(e.target.value)}
                  placeholder="e.g. Mathematics, Physics, Chemistry"
                  disabled={saving}
                  className="mt-1"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium">Teaching Experience</label>
                <Input
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  placeholder="e.g. 8 years teaching CBSE & State Board"
                  disabled={saving}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Qualifications & Degrees *</label>
              <Input
                value={qualifications}
                onChange={(e) => setQualifications(e.target.value)}
                placeholder="e.g. M.Sc. Physics (University of Delhi), B.Ed, Certified STEM Educator"
                disabled={saving}
                className="mt-1"
                required
              />
              <p className="mt-1 text-xs text-muted-foreground">
                List your academic degrees, certifications, or specialized teaching credentials.
              </p>
            </div>

            {/* Supporting Documents Section */}
            <div className="border-t pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <h3 className="text-sm font-semibold">Supporting Documents</h3>
                  <p className="text-xs text-muted-foreground">
                    Upload degree certificates, institution ID, or teaching licenses (PDF, DOCX, PNG, JPG up to 10MB).
                    Documents are private and only viewable by platform administrators.
                  </p>
                </div>
                <div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".pdf,.docx,.png,.jpg,.jpeg"
                    className="hidden"
                    disabled={uploadingDoc || saving}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingDoc || saving}
                  >
                    {uploadingDoc ? "Uploading..." : "+ Add Document"}
                  </Button>
                </div>
              </div>

              {documents.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                  No supporting documents attached yet. Attach your teaching certificate or institutional ID.
                </div>
              ) : (
                <div className="grid gap-2">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3 text-sm"
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="font-mono text-xs uppercase text-primary font-bold">
                          {doc.mimeType.includes("pdf") ? "PDF" : doc.mimeType.includes("word") ? "DOC" : "IMG"}
                        </span>
                        <div className="truncate">
                          <p className="font-medium truncate">{doc.originalName || doc.filename}</p>
                          <p className="text-xs text-muted-foreground">
                            {(doc.size / 1024).toFixed(0)} KB · Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary underline hover:opacity-80"
                        >
                          View Secure Document
                        </a>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveDoc(doc.id)}
                          disabled={saving}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3">
              <Button type="submit" disabled={saving || uploadingDoc}>
                {saving
                  ? "Submitting Application..."
                  : isApproved
                  ? "Update Credentials"
                  : isRejected
                  ? "Resubmit Application for Approval"
                  : "Submit Application for Review"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
