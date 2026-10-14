"use client";

import * as React from "react";
import { BookOpen } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RequireStudent } from "@/components/student/require-student";
import { TopicPicker } from "@/components/student/topic-picker";
import { TopicLearningDashboard } from "@/components/student/topic-learning-dashboard";
import {
  saveStudentLearnSelection,
  fetchSavedStudentLearnSelection,
  type CurriculumSelection,
  type EducationType,
} from "@/lib/api";

const STORAGE_KEY = "lucous_student_learn_selection";
const ACTIVE_CURRICULUM_KEY = "lucous_student_active_curriculum";

export function LearnFlow() {
  const [activeCurriculum, setActiveCurriculum] =
    React.useState<CurriculumSelection | null>(null);

  const [savedSelection, setSavedSelection] = React.useState<
    Partial<{
      educationType: EducationType;
      boardId: string;
      gradeId: string;
      branch?: string;
      semester?: string;
      subjectId: string;
      chapterId: string;
      topicId: string;
    }> | null
  >(null);

  // Restore saved selections or active curriculum on mount
  React.useEffect(() => {
    let active = true;

    async function restoreSelection() {
      if (typeof window === "undefined") return;

      try {
        // 1. Check Session Storage first
        const activeRaw = window.sessionStorage.getItem(ACTIVE_CURRICULUM_KEY);
        if (activeRaw) {
          const parsed = JSON.parse(activeRaw) as CurriculumSelection;
          if (parsed?.board && parsed?.grade && parsed?.subject && parsed?.chapter && parsed?.topic) {
            if (active) {
              setActiveCurriculum(parsed);
              setSavedSelection({
                educationType: parsed.educationType || (parsed.branch ? "diploma" : "school"),
                boardId: String(parsed.board.id),
                gradeId: String(parsed.grade.id),
                branch: parsed.branch || undefined,
                semester: parsed.semester || undefined,
                subjectId: String(parsed.subject.id),
                chapterId: String(parsed.chapter.id),
                topicId: String(parsed.topic.id),
              });
            }
            return;
          }
        }

        const savedRaw = window.sessionStorage.getItem(STORAGE_KEY);
        if (savedRaw) {
          const parsedSaved = JSON.parse(savedRaw);
          if (active) setSavedSelection(parsedSaved);
          return;
        }

        // 2. Fallback to API if session storage is empty
        const apiSaved = await fetchSavedStudentLearnSelection();
        if (active && apiSaved && apiSaved.board && apiSaved.grade && apiSaved.subject) {
          setActiveCurriculum(apiSaved);
          setSavedSelection({
            educationType: apiSaved.educationType || "school",
            boardId: String(apiSaved.board.id),
            gradeId: String(apiSaved.grade.id),
            branch: apiSaved.branch || undefined,
            semester: apiSaved.semester || undefined,
            subjectId: String(apiSaved.subject.id),
            chapterId: String(apiSaved.chapter.id),
            topicId: String(apiSaved.topic.id),
          });
        }
      } catch (e) {
        console.warn("Could not restore saved learn selection:", e);
      }
    }

    restoreSelection();
    return () => {
      active = false;
    };
  }, []);

  function handleStartLearning(selection: CurriculumSelection) {
    setActiveCurriculum(selection);
    const selIds = {
      educationType: selection.educationType || (selection.branch ? "diploma" as const : "school" as const),
      boardId: String(selection.board.id),
      gradeId: String(selection.grade.id),
      branch: selection.branch || undefined,
      semester: selection.semester || undefined,
      subjectId: String(selection.subject.id),
      chapterId: String(selection.chapter.id),
      topicId: String(selection.topic.id),
    };
    setSavedSelection(selIds);

    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(selIds));
        window.sessionStorage.setItem(ACTIVE_CURRICULUM_KEY, JSON.stringify(selection));
      } catch (e) {
        console.warn("Could not persist learn selection in sessionStorage:", e);
      }
    }

    // Persist to backend API asynchronously
    saveStudentLearnSelection(selIds).catch((err) => {
      console.warn("Could not persist learn selection to API:", err);
    });
  }

  function handleChangeSelection() {
    setActiveCurriculum(null);
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.removeItem(ACTIVE_CURRICULUM_KEY);
      } catch (e) {
        console.warn("Could not clear active curriculum:", e);
      }
    }
  }

  function handleSelectionChange(sel: {
    educationType: EducationType;
    boardId: string;
    gradeId: string;
    branch?: string;
    semester?: string;
    subjectId: string;
    chapterId: string;
    topicId: string;
  }) {
    setSavedSelection(sel);
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(sel));
      } catch (e) {
        console.warn("Could not persist partial selection:", e);
      }
    }
  }

  return (
    <RequireStudent title="Learn">
      {activeCurriculum ? (
        <TopicLearningDashboard
          curriculum={activeCurriculum}
          onChangeSelection={handleChangeSelection}
        />
      ) : (
        <div className="grid gap-6">
          <section className="space-y-1">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
              Learn
            </h1>
            <p className="text-sm text-muted-foreground">
              Select your education pathway and curriculum details below, then click Start Learning to enter your dedicated topic dashboard.
            </p>
          </section>

          <Card className="max-w-3xl">
            <CardHeader className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <BookOpen className="h-4 w-4" />
                </div>
                <CardTitle className="text-lg font-bold">Curriculum Selection</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Select your education pathway (School or Diploma), board, class/year, subject, chapter, and topic.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TopicPicker
                initialSelection={savedSelection || undefined}
                onSelectionChange={handleSelectionChange}
                onStartLearning={handleStartLearning}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </RequireStudent>
  );
}
