"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, LogOut } from "lucide-react";
import { LucousLogo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { clearSession, getSession } from "@/lib/auth";
import { useSession } from "@/lib/use-session";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { apiFetch, clearStoredAuth, getStoredUser, updateStoredUser, getUserInitials } from "@/lib/api";

export function RequireStudent({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useSession();
  const [currentUser, setCurrentUser] = React.useState(() => getStoredUser());

  React.useEffect(() => {
    const current = getSession();
    if (!current || current.role !== "student") {
      router.replace("/auth");
      return;
    }

    // Refresh trusted user data from /api/auth/me
    let active = true;
    apiFetch<{ user: any }>("/auth/me")
      .then((data) => {
        if (!active || !data?.user) return;
        updateStoredUser(data.user);
        setCurrentUser(data.user);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [router]);

  if (!session || session.role !== "student") {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Checking session…</p>
      </main>
    );
  }

  // Back: on the dashboard go to the website home page; elsewhere go to the previous page,
  // falling back to the dashboard if there is no history.
  const isDashboard = pathname === "/student/dashboard";
  const handleBack = () => {
    if (isDashboard) {
      router.push("/");
    } else if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/student/dashboard");
    }
  };
  const showBack = true;

  const displayName = currentUser?.name ?? session.name ?? "Student";
  const avatarUrl = currentUser?.avatarUrl ?? session.avatarUrl ?? null;

  return (
    <main className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-3 px-4">
          <Link
            href="/student/dashboard"
            aria-label="Lucous — student dashboard"
            className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <LucousLogo className="text-2xl" />
          </Link>
          <div className="flex items-center gap-3">
            {title ? (
              <span className="hidden text-sm text-muted-foreground md:inline">
                {title}
              </span>
            ) : null}
            <Link
              href="/student/profile"
              className="flex items-center gap-2 rounded-full p-1 hover:bg-muted transition-colors"
              title="View profile"
            >
              <Avatar className="size-8 ring-1 ring-border">
                {avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName} /> : null}
                <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                  {getUserInitials(displayName, currentUser?.email ?? session.email)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium hidden sm:inline max-w-[120px] truncate">
                {displayName}
              </span>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void apiFetch("/auth/logout", { method: "POST" }).catch(() => {});
                clearStoredAuth();
                clearSession();
                router.replace("/auth/student/login");
              }}
            >
              <LogOut aria-hidden />
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
        {showBack ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleBack}
            aria-label="Go back"
            className="mb-4"
          >
            <ArrowLeft aria-hidden />
            {isDashboard ? "Back to home" : "Back"}
          </Button>
        ) : null}
        {children}
      </div>
    </main>
  );
}
