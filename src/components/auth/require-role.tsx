"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { LucousLogo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ROLE_CONFIG, clearSession, getSession, type AuthRole } from "@/lib/auth";
import { useSession } from "@/lib/use-session";
import { apiFetch, clearStoredAuth, getStoredUser, updateStoredUser, getUserInitials } from "@/lib/api";

// Shared authenticated shell for the teacher / parent / admin workspaces.
// Mirrors the student shell (RequireStudent) so the visual language is identical.
export function RequireRole({
  role,
  title,
  children,
}: {
  role: AuthRole;
  title?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const config = ROLE_CONFIG[role];
  const session = useSession();
  const [currentUser, setCurrentUser] = React.useState(() => getStoredUser());

  React.useEffect(() => {
    const current = getSession();
    if (!current || current.role !== role) {
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
  }, [role, router]);

  if (!session || session.role !== role) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Checking session…</p>
      </main>
    );
  }

  const displayName = currentUser?.name ?? session.name ?? config.label;
  const avatarUrl = currentUser?.avatarUrl ?? session.avatarUrl ?? null;

  return (
    <main className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-3 px-4">
          <Link
            href={config.dashboardPath}
            aria-label={`Lucous — ${config.label.toLowerCase()} dashboard`}
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
            <div className="flex items-center gap-2 rounded-full p-1 hover:bg-muted transition-colors">
              <Avatar className="size-8 ring-1 ring-border">
                {avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName} /> : null}
                <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                  {getUserInitials(displayName, currentUser?.email ?? session.email)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium hidden sm:inline max-w-[120px] truncate">
                {displayName}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void apiFetch("/auth/logout", { method: "POST" }).catch(() => {});
                clearStoredAuth();
                clearSession();
                router.replace(`/auth/${role}/login`);
              }}
            >
              <LogOut aria-hidden />
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:py-8">{children}</div>
    </main>
  );
}
