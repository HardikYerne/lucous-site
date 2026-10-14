import type { StudentProgressData } from "@/lib/api";

// How each kind of real activity contributes to the 0-100% learning progress.
// Change the weights/targets here and the dashboard and certificate both follow.
export const PROGRESS_RULES = {
  lessons: { label: "Lessons completed", weight: 40 },
  tests: { label: "Practice & tests taken", weight: 25, target: 5 },
  games: { label: "Game XP earned", weight: 20, target: 300 },
  tutor: { label: "AI Tutor discussions", weight: 15, target: 5 },
} as const;

export interface ProgressPart {
  key: keyof typeof PROGRESS_RULES;
  label: string;
  done: number;
  target: number;
  weight: number;
  /** Share of this part that is finished, 0-1 */
  ratio: number;
}

export interface ProgressSummary {
  percent: number;
  complete: boolean;
  parts: ProgressPart[];
}

export function computeProgress(
  data: StudentProgressData,
  tutorChats: number
): ProgressSummary {
  const parts: ProgressPart[] = [
    {
      key: "lessons",
      label: PROGRESS_RULES.lessons.label,
      done: data.completedCount ?? 0,
      target: data.totalContent ?? 0,
      weight: PROGRESS_RULES.lessons.weight,
      ratio: 0,
    },
    {
      key: "tests",
      label: PROGRESS_RULES.tests.label,
      done: data.totalAttempts ?? 0,
      target: PROGRESS_RULES.tests.target,
      weight: PROGRESS_RULES.tests.weight,
      ratio: 0,
    },
    {
      key: "games",
      label: PROGRESS_RULES.games.label,
      done: data.xp ?? 0,
      target: PROGRESS_RULES.games.target,
      weight: PROGRESS_RULES.games.weight,
      ratio: 0,
    },
    {
      key: "tutor",
      label: PROGRESS_RULES.tutor.label,
      done: tutorChats,
      target: PROGRESS_RULES.tutor.target,
      weight: PROGRESS_RULES.tutor.weight,
      ratio: 0,
    },
  ];

  let earned = 0;
  let available = 0;
  for (const p of parts) {
    // If there are no lessons published yet, they can't count for or against the student.
    if (p.target <= 0) continue;
    p.ratio = Math.min(1, p.done / p.target);
    earned += p.weight * p.ratio;
    available += p.weight;
  }

  const raw = available > 0 ? (earned / available) * 100 : 0;
  // Only show 100% when everything is truly done (no rounding up to 100).
  const percent = raw >= 100 ? 100 : Math.floor(raw);
  return { percent, complete: percent >= 100, parts };
}
