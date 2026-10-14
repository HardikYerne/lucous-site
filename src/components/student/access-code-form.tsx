"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  KeyRound,
  ArrowRight,
  AlertCircle,
  Loader2,
  BookOpen,
  GraduationCap,
  ShieldCheck,
} from "lucide-react";
import { verifyStudentAccessCode, verifyClassCode, looksLikeClassCode, type ClassBundle } from "@/lib/api";
import { StudentPublishedContent } from "@/types/published-content";
import { cn } from "cn";

interface AccessCodeFormProps {
  onSuccess?: (content: StudentPublishedContent) => void;
  onClassSuccess?: (bundle: ClassBundle) => void;
  className?: string;
  autoFocus?: boolean;
}

export function AccessCodeForm({
  onSuccess,
  onClassSuccess,
  className,
  autoFocus = true,
}: AccessCodeFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCode = searchParams?.get("code") || "";

  const [code, setCode] = React.useState(initialCode);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleVerify = React.useCallback(
    async (codeToVerify?: string) => {
      const targetCode = (codeToVerify || code).trim();
      if (!targetCode) {
        setError("Please enter your access code.");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Teacher class codes (LC-...) unlock all of a teacher's material at once.
        if (onClassSuccess && looksLikeClassCode(targetCode)) {
          const classRes = await verifyClassCode(targetCode);
          if (classRes.success && classRes.bundle) {
            onClassSuccess(classRes.bundle);
          } else {
            setError("Invalid or expired class code. Please check with your teacher.");
          }
          return;
        }

        const res = await verifyStudentAccessCode(targetCode);
        if (res.success && res.item) {
          if (onSuccess) {
            onSuccess(res.item);
          } else {
            // Navigate to student learn page
            router.push(`/student/learn/${res.item.contentId}?code=${encodeURIComponent(targetCode)}`);
          }
        } else {
          setError("Invalid or inactive access code. Please check with your teacher.");
        }
      } catch (err: unknown) {
        console.error("Code verification error:", err);
        const msg = err instanceof Error ? err.message : "Could not verify access code. Please try again.";
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [code, onSuccess, onClassSuccess, router]
  );

  // Auto-verify if code passed in URL query
  React.useEffect(() => {
    if (initialCode && initialCode.trim().length >= 4) {
      handleVerify(initialCode.trim());
    }
  }, [initialCode, handleVerify]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.toUpperCase();
    // Allow letters, numbers, and dashes
    val = val.replace(/[^A-Z0-9-]/g, "");
    setCode(val);
    if (error) setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleVerify();
  };

  return (
    <Card className={cn("w-full max-w-lg mx-auto shadow-md border-border/70 overflow-hidden", className)}>
      <div className="h-1.5 w-full bg-linear-to-r from-primary via-purple-500 to-indigo-500" />
      <CardHeader className="text-center pb-4 pt-6">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-3 ring-8 ring-primary/5">
          <KeyRound className="w-6 h-6" />
        </div>
        <CardTitle className="text-xl sm:text-2xl font-heading font-bold tracking-tight text-foreground">
          Enter Teacher Access Code
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
          Enter the unique 6-character code shared by your teacher to access lessons, practice sheets, and quizzes.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4 pt-2">
          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs sm:text-sm text-destructive flex items-start gap-2.5 animate-in fade-in-50 duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <div className="relative">
              <Input
                type="text"
                placeholder="LU-XXXXXX or LC-XXXXXXXX"
                value={code}
                onChange={handleInputChange}
                disabled={loading}
                autoFocus={autoFocus}
                maxLength={13}
                className="h-14 text-center text-xl sm:text-2xl font-mono tracking-widest uppercase font-bold border-2 focus-visible:border-primary shadow-xs rounded-xl"
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
              <span>Format: <code className="font-semibold text-foreground">LU-XXXXXX</code> or <code className="font-semibold text-foreground">XXXXXX</code></span>
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="w-3 h-3" /> Secure verified access
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border/50 bg-muted/40 text-xs">
              <BookOpen className="w-4 h-4 text-primary shrink-0" />
              <div className="truncate">
                <p className="font-medium text-foreground truncate">Curriculum Lessons</p>
                <p className="text-[10px] text-muted-foreground truncate">Explanations & notes</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border/50 bg-muted/40 text-xs">
              <GraduationCap className="w-4 h-4 text-purple-500 shrink-0" />
              <div className="truncate">
                <p className="font-medium text-foreground truncate">Interactive Quizzes</p>
                <p className="text-[10px] text-muted-foreground truncate">Instant feedback</p>
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3 pb-6 pt-2">
          <Button
            type="submit"
            disabled={loading || !code.trim()}
            className="w-full h-11 text-sm font-semibold gap-2 shadow-sm rounded-xl"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Verifying Code…
              </>
            ) : (
              <>
                Access Learning Material
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>

          <p className="text-[11px] text-center text-muted-foreground">
            Don&apos;t have a code? Ask your teacher or browse public courses.
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
