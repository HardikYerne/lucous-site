import type { Metadata } from "next";
import { StudentQuizPage } from "@/components/student/quiz-runner";

export const metadata: Metadata = {
  title: "Practice — LUCOUS",
};

export default async function StudentPracticePage({
  searchParams,
}: {
  searchParams: Promise<{ topicId?: string }>;
}) {
  const { topicId } = await searchParams;
  const presetTopicId = topicId && topicId.trim() ? topicId : null;
  return <StudentQuizPage mode="PRACTICE" presetTopicId={presetTopicId} />;
}
