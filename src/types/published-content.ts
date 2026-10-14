/**
 * Frontend Type Definitions for LUCOUS Phase 3.4
 * Teacher Publishing, Access Codes, and Student Access
 */

export type PublishedContentType = "LESSON" | "ASSESSMENT";

export interface PublishedItemSummary {
  id: string;
  contentType: PublishedContentType;
  title: string;
  subject: string;
  chapter?: string | null;
  topic?: string | null;
  educationLevel?: string | null;
  gradeOrSemester?: string | null;
  boardOrScheme?: string | null;
  difficulty?: string;
  questionCount?: number;
  accessCode: string;
  publishedAt: string;
  summary?: string | null;
}

export interface PublishContentResponse {
  success: boolean;
  message: string;
  contentId: string;
  contentType: PublishedContentType;
  title: string;
  accessCode: string;
  status: "PUBLISHED";
  publishedAt: string;
}

export interface UnpublishContentResponse {
  success: boolean;
  message: string;
  contentId: string;
  status: "REVIEWED";
}

export interface TeacherPublishedListResponse {
  success: boolean;
  count: number;
  items: PublishedItemSummary[];
}

export interface StudentLessonReviewQuestion {
  id: string;
  question: string;
  hasAnswer: boolean;
}

export interface StudentPublishedLessonContent {
  title: string;
  summary?: string;
  learningObjectives: string[];
  explanationSteps: {
    stepNumber: number;
    heading: string;
    explanation: string;
  }[];
  sourceGroundedExamples: {
    title: string;
    context: string;
    example: string;
    explanation: string;
  }[];
  keyTerms: {
    term: string;
    definition: string;
  }[];
  reviewQuestions: StudentLessonReviewQuestion[];
}

export interface StudentAssessmentQuestion {
  id: string;
  type: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "FILL_BLANK" | "MATCHING" | "FLASHCARD" | "ORDERING" | "TIMED_BLITZ";
  questionText: string;
  options?: string[] | null;
  matchingPairs?: { left: string; right: string }[] | null;
  matchingLeft?: string[] | null;
  matchingRight?: string[] | null;
  front?: string;
  back?: string;
  items?: { id: string; text: string }[] | null;
  timeLimitSeconds?: number;
}

export interface StudentPublishedAssessmentContent {
  title: string;
  description?: string;
  contentType: "PRACTICE" | "TEST" | "GAME";
  gameFormat: string;
  difficulty: string;
  questions: StudentAssessmentQuestion[];
}

export interface StudentPublishedContent {
  contentType: PublishedContentType;
  contentId: string;
  title: string;
  description?: string | null;
  subject: string;
  chapter?: string | null;
  topic?: string | null;
  topicId?: string | null;
  educationLevel?: string | null;
  gradeOrSemester?: string | null;
  boardOrScheme?: string | null;
  difficulty?: string;
  questionCount?: number;
  gameFormat?: string;
  accessCode: string;
  publishedAt: string;
  content: StudentPublishedLessonContent | StudentPublishedAssessmentContent;
}

export interface VerifyAccessCodeResponse {
  success: boolean;
  item: StudentPublishedContent;
}

export interface CheckAnswerResponse {
  success: boolean;
  questionId: string;
  isCorrect: boolean;
  correctAnswer: unknown;
  explanation: string;
  sourceReference?: string | null;
}

export interface AssessmentSessionResponse {
  success: boolean;
  sessionId: string;
  accessCode: string;
  contentId: string;
  title: string;
  questionCount: number;
  isTimed: boolean;
  totalTimeSeconds?: number | null;
  deadline?: number | null;
  startedAt: number;
}

export interface SubmittedAnswerItem {
  questionId: string;
  studentAnswer: unknown;
}

export interface QuestionGradingResult {
  questionId: string;
  type: string;
  questionText: string;
  studentAnswer: unknown;
  correctAnswer: unknown;
  isCorrect: boolean;
  explanation: string;
  sourceReference?: string | null;
}

export interface AssessmentSubmissionResponse {
  success: boolean;
  score: number;
  correctCount: number;
  totalQuestions: number;
  topicId?: string | null;
  topic?: string | null;
  subject: string;
  chapter?: string | null;
  gameFormat: string;
  difficulty: string;
  completedAt: string;
  results: QuestionGradingResult[];
}

