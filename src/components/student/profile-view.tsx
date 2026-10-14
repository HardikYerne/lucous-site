"use client";

import * as React from "react";
import { RequireStudent } from "@/components/student/require-student";
import { ProfileEditor } from "@/components/auth/profile-editor";

export function ProfileView() {
  return (
    <RequireStudent title="Profile">
      <div className="grid gap-5">
        <section>
          <h1 className="font-heading text-2xl font-semibold">Profile</h1>
          <p className="text-sm text-muted-foreground">
            Manage your personal profile, details, and picture.
          </p>
        </section>
        <ProfileEditor role="student" showXp={true} />
      </div>
    </RequireStudent>
  );
}
