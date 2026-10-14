import type { Metadata } from "next";
import { Suspense } from "react";
import { LessonDetailView } from "@/components/student/lesson-detail-view";
import { Loader2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Lesson & Practice — LUCOUS",
  description: "Interactive student lesson with step-by-step explanations and quizzes.",
};

interface PageProps {
  params: Promise<{ contentId: string }>;
}

export default async function StudentLearnContentPage({ params }: PageProps) {
  const resolvedParams = await params;

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <LessonDetailView contentId={resolvedParams.contentId} />
    </Suspense>
  );
}
