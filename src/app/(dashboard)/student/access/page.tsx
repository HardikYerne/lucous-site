import type { Metadata } from "next";
import { Suspense } from "react";
import { AccessPageView } from "@/components/student/access-page-view";
import { Loader2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Class Access Code — LUCOUS",
  description: "Enter your unique teacher access code to open published curriculum lessons and tests.",
};

export default function StudentAccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <AccessPageView />
    </Suspense>
  );
}
