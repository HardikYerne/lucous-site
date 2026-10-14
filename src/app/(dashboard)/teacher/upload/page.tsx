import type { Metadata } from "next";
import { RequireRole } from "@/components/auth/require-role";
import { MaterialUploadPanel } from "@/components/teacher/material-upload";

export const metadata: Metadata = {
  title: "Upload Learning Materials — Teacher Dashboard — LUCOUS",
  description: "Securely upload and organize curriculum learning materials for students.",
};

export default function TeacherUploadPage() {
  return (
    <RequireRole role="teacher" title="Teacher">
      <div className="space-y-6">
        <MaterialUploadPanel />
      </div>
    </RequireRole>
  );
}
