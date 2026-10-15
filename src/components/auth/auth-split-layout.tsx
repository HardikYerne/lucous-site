import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LucousLogo } from "@/components/logo";
import { ThemeToggle } from "@/components/site/theme-toggle";

/**
 * Split-screen auth layout: form on the left, illustration on the right.
 * The illustration is hidden below the `lg` breakpoint, so phones and small
 * tablets keep the single-column form.
 *
 * The picture column is sized from the viewport height so the whole picture
 * (aspect 776:941 = 0.8247) is visible without being cropped; on very
 * tall/narrow screens it is capped at half the width and trimmed at the
 * sides instead. The width is an inline style on purpose (it does not depend
 * on how Tailwind handles arbitrary values).
 *
 * To use a different picture, replace /public/auth/login-illustration.jpg
 * (keep the same file name; if its aspect ratio differs, update the number
 * in IMAGE_COLUMN_WIDTH below).
 */
const IMAGE_COLUMN_WIDTH = "min(50vw, calc(100dvh * 0.8247))";
/** Corner radius of the picture (left side). Set to 0 for square corners. */
const IMAGE_CORNER_RADIUS = 28;

export function AuthSplitLayout({
  children,
  contentClassName = "max-w-lg",
}: {
  children: React.ReactNode;
  /** Width of the form column, e.g. "max-w-2xl" for the wider signup form. */
  contentClassName?: string;
}) {
  return (
    <main className="min-h-dvh bg-background lg:flex">
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col px-4 py-8 sm:px-10 sm:py-10 lg:px-10 xl:px-16">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            aria-label="Lucous — home"
            className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <LucousLogo className="text-3xl" />
          </Link>
          <ThemeToggle />
        </div>

        <div className="flex flex-1 flex-col items-center justify-center py-8">
          <div
            className={`flex w-full flex-col items-center gap-5 ${contentClassName}`}
          >
            {children}
          </div>

          <Link
            href="/auth"
            className="mt-8 inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Change role
          </Link>
        </div>
      </div>

      <div
        className="hidden shrink-0 lg:block"
        style={{ width: IMAGE_COLUMN_WIDTH }}
        aria-hidden
      >
        {/* Inline styles on purpose, so sizing never depends on generated classes. */}
        <div
          style={{
            position: "sticky",
            top: 0,
            width: "100%",
            height: "100dvh",
            overflow: "hidden",
            backgroundColor: "#1e293b",
            // Round the corners that sit against the form panel.
            borderTopLeftRadius: IMAGE_CORNER_RADIUS,
            borderBottomLeftRadius: IMAGE_CORNER_RADIUS,
          }}
        >
          {/* Only visible when the picture file is missing (the <img> below covers it). */}
          <p
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
              textAlign: "center",
              fontSize: 12,
              color: "#cbd5e1",
            }}
          >
            Picture not found. Put it at public/auth/login-illustration.jpg
          </p>
          {/* Plain <img> on purpose: loads the file straight from /public. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/auth/login-illustration.jpg"
            alt=""
            draggable={false}
            fetchPriority="high"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center",
            }}
          />
        </div>
      </div>
    </main>
  );
}
