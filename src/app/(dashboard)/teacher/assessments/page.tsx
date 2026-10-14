import type { Metadata } from "next";
import { RequireRole } from "@/components/auth/require-role";
import { AssessmentsPanel } from "@/components/teacher/assessments-panel";

export const metadata: Metadata = {
  title: "AI Assessments & Games — Teacher Dashboard — LUCOUS",
  description: "Generate, review, and edit curriculum-grounded assessments, tests, and educational games from uploaded learning materials.",
};

export default function TeacherAssessmentsPage() {
  return (
    <RequireRole role="teacher" title="Teacher">
      <div className="space-y-6">
        <AssessmentsPanel />
      </div>
    </RequireRole>
  );
}
