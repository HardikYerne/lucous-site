"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";
import {
  CLASS_GROUPS,
  DIPLOMA_BOARDS,
  SCHOOL_BOARDS,
  isDiplomaClass,
} from "@/lib/education-options";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Image as ImageIcon, Trash2, Upload } from "lucide-react";
import {
  ROLE_CONFIG,
  SIGNUP_FIELDS,
  type AuthRole,
} from "@/lib/auth";
import { uploadAvatar, getUserInitials } from "@/lib/api";

const API_URL = "/api";

const REGISTER_PATH: Partial<Record<AuthRole, string>> = {
  student: "/auth/register/student",
  teacher: "/auth/register/teacher",
  parent: "/auth/register/parent",
};

export function SignupForm({ role }: { role: AuthRole }) {
  const router = useRouter();
  const config = ROLE_CONFIG[role];
  const fields = SIGNUP_FIELDS[role];
  const [confirmError, setConfirmError] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [grade, setGrade] = React.useState("");
  const [board, setBoard] = React.useState("");
  const [verifyEmail, setVerifyEmail] = React.useState<string | null>(null);

  const boardGroups = isDiplomaClass(grade) ? DIPLOMA_BOARDS : SCHOOL_BOARDS;

  function handleGradeChange(next: string) {
    // School and diploma use different boards, so clear the board when switching.
    if (isDiplomaClass(next) !== isDiplomaClass(grade)) setBoard("");
    setGrade(next);
  }

  const [avatarFile, setAvatarFile] = React.useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = React.useState<string | null>(null);
  const [avatarError, setAvatarError] = React.useState<string>("");
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Clean up blob URL on unmount or preview change
  React.useEffect(() => {
    return () => {
      if (avatarPreview && avatarPreview.startsWith("blob:")) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    setAvatarError("");
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      setAvatarError("Please select a JPG, PNG, WebP, or GIF image.");
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setAvatarError("Profile picture must be under 3MB.");
      return;
    }

    if (avatarPreview && avatarPreview.startsWith("blob:")) {
      URL.revokeObjectURL(avatarPreview);
    }

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  function handleRemoveAvatar() {
    if (avatarPreview && avatarPreview.startsWith("blob:")) {
      URL.revokeObjectURL(avatarPreview);
    }
    setAvatarFile(null);
    setAvatarPreview(null);
    setAvatarError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") ?? "");
    const confirm = String(fd.get("confirmPassword") ?? "");
    if (password !== confirm) {
      setConfirmError(true);
      return;
    }
    setConfirmError(false);

    const email = String(fd.get("email") ?? "").trim();
    const name = String(fd.get("fullName") ?? fd.get("parentName") ?? "").trim();

    const optional = (key: string) => {
      const v = String(fd.get(key) ?? "").trim();
      return v ? v : undefined;
    };

    const path = REGISTER_PATH[role];
    if (!path) {
      setError("Signup is not available for this role.");
      return;
    }

    setLoading(true);

    try {
      // 1. Upload profile picture if provided
      let finalAvatarUrl: string | null = null;
      if (avatarFile) {
        try {
          const uploadRes = await uploadAvatar(avatarFile);
          if (!uploadRes.success || !uploadRes.avatarUrl) {
            setError(uploadRes.message || "Failed to upload profile picture. Please try again.");
            setLoading(false);
            return;
          }
          finalAvatarUrl = uploadRes.avatarUrl;
        } catch (uploadErr) {
          console.error("Avatar upload error:", uploadErr);
          setError("Failed to upload profile picture. You can remove it or try a different image.");
          setLoading(false);
          return;
        }
      }

      // 2. Register account with user details and avatar URL
      const response = await fetch(`${API_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          avatarUrl: finalAvatarUrl,
          phone: optional("mobile"),
          grade: optional("grade"),
          board: optional("board"),
          school: optional("school"),
          subject: optional("subject"),
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.message || "Signup failed. Please try again.");
        return;
      }

      // Registration succeeded. If the server wants the email verified, ask for the
      // emailed code first; otherwise continue straight to login.
      if (data.requiresVerification) {
        setVerifyEmail(email);
        return;
      }
      router.replace(`/auth/${role}/login`);
    } catch (err) {
      console.error("Signup error:", err);
      setError(
        "Unable to connect to LUCOUS server. Make sure the backend is running."
      );
    } finally {
      setLoading(false);
    }
  }

  if (verifyEmail) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-lg">Verify your email</CardTitle>
          <CardDescription>One last step to activate your account</CardDescription>
        </CardHeader>
        <CardContent>
          <VerifyEmailForm
            email={verifyEmail}
            onVerified={() => router.replace(`/auth/${role}/login`)}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg">
          Create your {config.label.toLowerCase()} account
        </CardTitle>
        <CardDescription>
          Join LUCOUS as a {config.label.toLowerCase()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-3.5"
          onSubmit={onSubmit}
          onChange={() => confirmError && setConfirmError(false)}
        >
          {/* Profile Picture Upload & Preview */}
          <div className="flex flex-col items-center justify-center gap-2 p-3 border rounded-lg bg-muted/20">
            <div className="relative group">
              <Avatar className="size-20 ring-2 ring-primary/20 shadow-sm">
                {avatarPreview ? (
                  <AvatarImage src={avatarPreview} alt="Preview" className="object-cover" />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold flex items-center justify-center">
                  <Camera className="size-7 opacity-70" />
                </AvatarFallback>
              </Avatar>
            </div>

            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                id="signup-avatar-input"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                disabled={loading}
                onChange={handleAvatarChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                disabled={loading}
                onClick={() => fileInputRef.current?.click()}
              >
                {avatarPreview ? (
                  <>
                    <ImageIcon className="size-3.5" />
                    Change photo
                  </>
                ) : (
                  <>
                    <Upload className="size-3.5" />
                    Upload picture (optional)
                  </>
                )}
              </Button>

              {avatarPreview ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                  disabled={loading}
                  onClick={handleRemoveAvatar}
                >
                  <Trash2 className="size-3.5 mr-1" />
                  Remove
                </Button>
              ) : null}
            </div>

            {avatarError ? (
              <p className="text-xs text-destructive text-center">{avatarError}</p>
            ) : (
              <p className="text-[11px] text-muted-foreground text-center">
                JPG, PNG, WebP, or GIF up to 3MB. Default avatar used if skipped.
              </p>
            )}
          </div>

          {fields.map((field) => {
            const common = {
              required: true,
              name: field.name,
              placeholder: field.placeholder,
              autoComplete: field.autoComplete,
              disabled: loading,
            };
            return (
              <label key={field.name} className="grid gap-1.5 text-sm font-medium">
                {field.label}
                {field.type === "select" ? (
                  <select
                    required
                    name={field.name}
                    disabled={loading}
                    value={field.name === "grade" ? grade : board}
                    onChange={(e) =>
                      field.name === "grade"
                        ? handleGradeChange(e.target.value)
                        : setBoard(e.target.value)
                    }
                    className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 [&_option]:bg-card [&_option]:text-foreground [&_optgroup]:bg-card [&_optgroup]:text-foreground"
                  >
                    <option value="" disabled>
                      {field.placeholder}
                    </option>
                    {(field.name === "grade"
                      ? CLASS_GROUPS
                      : boardGroups
                    ).map((group) => (
                      <optgroup key={group.label} label={group.label}>
                        {group.options.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                ) : field.type === "password" ? (
                  <PasswordInput
                    {...common}
                    minLength={8}
                    aria-invalid={
                      field.name === "confirmPassword" && confirmError
                        ? true
                        : undefined
                    }
                    className="h-10"
                  />
                ) : (
                  <Input
                    {...common}
                    type={field.type}
                    className="h-10"
                  />
                )}
                {field.name === "confirmPassword" && confirmError ? (
                  <span className="text-xs font-normal text-destructive">
                    Passwords do not match
                  </span>
                ) : null}
              </label>
            );
          })}

          {error ? (
            <p className="text-sm font-normal text-destructive">{error}</p>
          ) : null}

          <Button
            type="submit"
            className="mt-1 h-10 w-full text-sm"
            disabled={loading}
          >
            {loading ? "Creating account..." : "Create account"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href={`/auth/${role}/login`}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Log in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

