"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, BookOpen, ChevronRight, Clock, GraduationCap } from "lucide-react";
import type { ClassBundle } from "@/lib/api";
import type { StudentPublishedContent } from "@/types/published-content";
import { PublishedLessonViewer } from "./published-lesson-viewer";

// Shows every lesson/assessment unlocked by a teacher's class code.
export function ClassMaterialsView({
  bundle,
  onBack,
}: {
  bundle: ClassBundle;
  onBack: () => void;
}) {
  const [selected, setSelected] = React.useState<StudentPublishedContent | null>(null);

  if (selected) {
    return <PublishedLessonViewer content={selected} onBack={() => setSelected(null)} />;
  }

  const expires = new Date(bundle.expiresAt).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">{bundle.title}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {bundle.teacherName ? <span>Shared by {bundle.teacherName}</span> : null}
            <span className="flex items-center gap-1">
              <Clock className="size-3.5" aria-hidden /> Available until {expires}
            </span>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="size-4" aria-hidden /> Enter another code
        </Button>
      </div>

      {bundle.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Your teacher has not published any material yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {bundle.items.map((item) => {
            const isLesson = item.contentType === "LESSON";
            return (
              <button key={item.accessCode} type="button" onClick={() => setSelected(item)} className="text-left">
                <Card className="h-full transition-shadow hover:shadow-lift">
                  <CardContent className="flex items-start gap-3 pt-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      {isLesson ? <BookOpen className="size-5" aria-hidden /> : <GraduationCap className="size-5" aria-hidden />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{item.title}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {item.subject}
                        {item.chapter ? ` · ${item.chapter}` : ""}
                        {item.topic ? ` · ${item.topic}` : ""}
                      </span>
                      <Badge variant="secondary" className="mt-2">
                        {isLesson ? "Lesson" : "Practice / Quiz"}
                      </Badge>
                    </span>
                    <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
