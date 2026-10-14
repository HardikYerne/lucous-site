import * as React from "react";

export type TimeGreeting =
  | "Good morning"
  | "Good afternoon"
  | "Good evening"
  | "Good night";

/**
 * Returns the appropriate local-time greeting according to LUCOUS specification:
 * - 05:00–11:59 → Good morning
 * - 12:00–16:59 → Good afternoon
 * - 17:00–20:59 → Good evening
 * - 21:00–04:59 → Good night
 *
 * @param date Optional date instance (defaults to browser's current local date/time)
 */
export function getTimeGreeting(date: Date = new Date()): TimeGreeting {
  const hour = date.getHours();

  if (hour >= 5 && hour < 12) {
    return "Good morning";
  }
  if (hour >= 12 && hour < 17) {
    return "Good afternoon";
  }
  if (hour >= 17 && hour < 21) {
    return "Good evening";
  }
  return "Good night";
}

/**
 * Formats a personalized greeting for an authenticated user.
 * Displays "Greeting, Name" if a clean name is provided.
 * If name is null, undefined, whitespace, or generic placeholder, displays "Greeting" alone.
 * Never outputs "undefined", "null", or random placeholder names.
 */
export function formatPersonalizedGreeting(
  name?: string | null,
  date: Date = new Date()
): string {
  const greeting = getTimeGreeting(date);
  const trimmed = typeof name === "string" ? name.trim() : "";

  // Guard against null/undefined string values or generic fallback defaults
  if (
    trimmed &&
    trimmed.toLowerCase() !== "null" &&
    trimmed.toLowerCase() !== "undefined"
  ) {
    return `${greeting}, ${trimmed}`;
  }

  return greeting;
}

/**
 * Calculates the next boundary timestamp (5:00, 12:00, 17:00, or 21:00)
 * in local time to calculate exact timeout delays.
 */
export function getNextGreetingBoundary(date: Date = new Date()): Date {
  const currentHour = date.getHours();
  const boundaryHours = [5, 12, 17, 21];

  for (const bHour of boundaryHours) {
    if (bHour > currentHour) {
      const boundary = new Date(date);
      boundary.setHours(bHour, 0, 0, 0);
      return boundary;
    }
  }

  // If past 21:00, next boundary is 05:00 tomorrow
  const tomorrowBoundary = new Date(date);
  tomorrowBoundary.setDate(tomorrowBoundary.getDate() + 1);
  tomorrowBoundary.setHours(5, 0, 0, 0);
  return tomorrowBoundary;
}

/**
 * Hydration-safe React hook for real-time dynamic greeting updates.
 * - Recalculates upon crossing exact time boundaries
 * - Recalculates on browser tab visibilitychange / focus
 * - Periodically verifies state against sleep/wake clock drifts
 * - Fully cleans up timers and listeners on unmount
 */
export function useTimeGreeting(name?: string | null): {
  greeting: TimeGreeting;
  personalizedGreeting: string;
  isMounted: boolean;
} {
  const [greeting, setGreeting] = React.useState<TimeGreeting>(() => getTimeGreeting());
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const checkAndUpdate = () => {
      const now = new Date();
      const currentGreeting = getTimeGreeting(now);
      setGreeting((prev) => (prev !== currentGreeting ? currentGreeting : prev));

      // Schedule next boundary timeout
      const nextBoundary = getNextGreetingBoundary(now);
      const msUntilBoundary = Math.max(1000, nextBoundary.getTime() - now.getTime() + 250);

      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        checkAndUpdate();
      }, msUntilBoundary);
    };

    // Initial check on mount
    checkAndUpdate();

    // Recalculate when user switches tabs or window gains focus
    const handleVisibilityChange = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        checkAndUpdate();
      }
    };

    const handleFocus = () => {
      checkAndUpdate();
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
      window.addEventListener("focus", handleFocus);
    }

    // Backup interval every 30 seconds for laptop sleep/wake recovery
    const backupInterval = setInterval(checkAndUpdate, 30_000);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      clearInterval(backupInterval);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        window.removeEventListener("focus", handleFocus);
      }
    };
  }, []);

  const personalizedGreeting = React.useMemo(() => {
    const trimmed = typeof name === "string" ? name.trim() : "";
    if (
      trimmed &&
      trimmed.toLowerCase() !== "null" &&
      trimmed.toLowerCase() !== "undefined"
    ) {
      return `${greeting}, ${trimmed}`;
    }
    return greeting;
  }, [greeting, name]);

  return {
    greeting,
    personalizedGreeting,
    isMounted,
  };
}
