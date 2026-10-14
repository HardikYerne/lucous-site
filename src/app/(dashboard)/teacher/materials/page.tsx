import type { Metadata } from "next";
import { RequireRole } from "@/components/auth/require-role";
import { MaterialUploadPanel } from "@/components/teacher/material-upload";

export const metadata: Metadata = {
  title: "Learning Materials — Teacher Dashboard — LUCOUS",
  description: "Manage uploaded curriculum learning materials for students.",
};

export default function TeacherMaterialsPage() {
  return (
    <RequireRole role="teacher" title="Teacher">
      <div className="space-y-6">
        <MaterialUploadPanel />
      </div>
    </RequireRole>
  );
}
