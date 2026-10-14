import type { Metadata } from "next";
import { RequireRole } from "@/components/auth/require-role";
import { PublishedContentList } from "@/components/teacher/published-content-list";

export const metadata: Metadata = {
  title: "Published Content & Access Codes — Teacher Dashboard — LUCOUS",
  description: "View published educational lessons, assessments, and active student access codes.",
};

export default function TeacherPublishedPage() {
  return (
    <RequireRole role="teacher" title="Teacher">
      <div className="space-y-6">
        <PublishedContentList />
      </div>
    </RequireRole>
  );
}
