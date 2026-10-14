import type { Metadata } from "next";
import { RequireRole } from "@/components/auth/require-role";
import { LessonDraftsPanel } from "@/components/teacher/lesson-drafts-panel";

export const metadata: Metadata = {
  title: "AI Lesson Drafts — Teacher Dashboard — LUCOUS",
  description: "Generate and review curriculum-grounded lesson drafts from uploaded materials.",
};

export default function TeacherLessonsPage() {
  return (
    <RequireRole role="teacher" title="Teacher">
      <div className="space-y-6">
        <LessonDraftsPanel />
      </div>
    </RequireRole>
  );
}
