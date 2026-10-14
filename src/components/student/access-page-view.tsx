"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccessCodeForm } from "./access-code-form";
import { PublishedLessonViewer } from "./published-lesson-viewer";
import { StudentPublishedContent } from "@/types/published-content";
import { ClassMaterialsView } from "./class-materials-view";
import type { ClassBundle } from "@/lib/api";

export function AccessPageView() {
  const [content, setContent] = React.useState<StudentPublishedContent | null>(null);
  const [bundle, setBundle] = React.useState<ClassBundle | null>(null);
  const router = useRouter();

  return (
    <div className="container max-w-5xl mx-auto py-8 px-4 sm:px-6">
      {bundle ? (
        <ClassMaterialsView bundle={bundle} onBack={() => setBundle(null)} />
      ) : !content ? (
        <div className="py-8">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mb-4"
            onClick={() => router.back()}
          >
            <ArrowLeft className="size-4" aria-hidden /> Back
          </Button>
          <AccessCodeForm
            onSuccess={(verifiedContent) => setContent(verifiedContent)}
            onClassSuccess={(classBundle) => setBundle(classBundle)}
          />
        </div>
      ) : (
        <PublishedLessonViewer
          content={content}
          onBack={() => setContent(null)}
        />
      )}
    </div>
  );
}
