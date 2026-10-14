import type { Metadata } from "next";
import { StudentQuizPage } from "@/components/student/quiz-runner";

export const metadata: Metadata = {
  title: "Test — LUCOUS",
};

export default async function StudentTestPage({
  searchParams,
}: {
  searchParams: Promise<{ topicId?: string }>;
}) {
  const { topicId } = await searchParams;
  const presetTopicId = topicId && topicId.trim() ? topicId : null;
  return <StudentQuizPage mode="TEST" presetTopicId={presetTopicId} />;
}
