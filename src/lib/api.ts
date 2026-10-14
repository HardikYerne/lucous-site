// Shared helpers for talking to the LUCOUS Express backend from student pages.

const API_URL = "/api";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    window.localStorage.getItem("lucous_token") ??
    window.sessionStorage.getItem("lucous_token")
  );
}

export interface TeacherDocument {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedAt: string;
}

export type TeacherApplicationStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface TeacherApplication {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  school?: string | null;
  subject?: string | null;
  qualifications: string;
  experience: string;
  documents: TeacherDocument[];
  status: TeacherApplicationStatus;
  rejectionReason?: string | null;
  reviewedBy?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
  submittedAt: string;
  updatedAt: string;
}

export interface StoredUser {
  id?: string | number;
  name?: string;
  email?: string;
  role?: string;
  isVerified?: boolean;
  avatarUrl?: string | null;
  phone?: string | null;
  grade?: string | null;
  board?: string | null;
  school?: string | null;
  subject?: string | null;
  xp?: number;
  teacherApplication?: TeacherApplication | null;
}

export function getStoredUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  const raw =
    window.localStorage.getItem("lucous_user") ??
    window.sessionStorage.getItem("lucous_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function updateStoredUser(user: Partial<StoredUser>) {
  if (typeof window === "undefined") return;
  const current = getStoredUser() ?? {};
  const merged = { ...current, ...user };
  const serialized = JSON.stringify(merged);
  if (window.localStorage.getItem("lucous_user")) {
    window.localStorage.setItem("lucous_user", serialized);
  }
  if (window.sessionStorage.getItem("lucous_user")) {
    window.sessionStorage.setItem("lucous_user", serialized);
  }
  if (!window.localStorage.getItem("lucous_user") && !window.sessionStorage.getItem("lucous_user")) {
    window.localStorage.setItem("lucous_user", serialized);
  }
}

export function getUserInitials(name?: string | null, email?: string | null): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email && email.trim()) {
    return email.slice(0, 2).toUpperCase();
  }
  return "LU";
}

export async function uploadAvatar(file: File): Promise<{ success: boolean; avatarUrl?: string; message?: string }> {
  const formData = new FormData();
  formData.append("avatar", file);

  const res = await fetch("/api/auth/upload-avatar", {
    method: "POST",
    body: formData,
  });
  return res.json();
}

export async function updateProfileAvatar(file: File): Promise<{ success: boolean; avatarUrl?: string; user?: ProfileUser; message?: string }> {
  const formData = new FormData();
  formData.append("avatar", file);

  return apiFetch<{ success: boolean; avatarUrl: string; user: ProfileUser; message: string }>(
    "/auth/profile/avatar",
    {
      method: "POST",
      body: formData,
    }
  );
}

export function clearStoredAuth() {
  if (typeof window === "undefined") return;
  for (const storage of [window.localStorage, window.sessionStorage]) {
    storage.removeItem("lucous_token");
    storage.removeItem("lucous_user");
    storage.removeItem("lucous.session");
  }
}

export async function apiFetch<T>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const token = getToken();
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;

  const headers: Record<string, string> = {};
  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: isFormData
      ? (options.body as FormData)
      : options.body !== undefined
      ? JSON.stringify(options.body)
      : undefined,
  });

  const data: unknown = await res.json().catch(() => ({}));
  const payload = (data ?? {}) as { success?: boolean; message?: string };

  if (!res.ok || !payload.success) {
    if (res.status === 401) {
      clearStoredAuth();
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/auth")) {
        window.location.href = "/auth";
      }
    }
    throw new Error(payload.message || "Request failed");
  }

  return data as T;
}

export type EducationType = "school" | "diploma";

export interface Board {
  id: string | number;
  name: string;
  fullName?: string;
  state?: string;
  type?: EducationType;
  hasCurriculumCoverage?: boolean;
}

export interface Grade {
  id: string | number;
  name: string;
  type?: EducationType;
}

export interface Subject {
  id: string | number;
  name: string;
  boardId: string | number;
  gradeId: string | number;
  branch?: string | null;
  semester?: string | null;
  _count: { chapters: number };
  board?: { name: string };
  grade?: { name: string };
}

export interface Chapter {
  id: string | number;
  subjectId: string | number;
  name: string;
  _count: { topics: number };
}

export interface Topic {
  id: string | number;
  chapterId: string | number;
  name: string;
  _count: { questions: number; contents: number };
}

export interface CurriculumSelection {
  board: Board;
  grade: Grade;
  subject: Subject;
  chapter: Chapter;
  topic: Topic;
  educationType?: EducationType;
  branch?: string | null;
  semester?: string | null;
}

export interface DiplomaMeta {
  boards: Board[];
  years: string[];
  branches: string[];
  semestersByYear: Record<string, string[]>;
}

export interface ContentItem {
  id: string | number;
  topicId: string | number;
  title: string;
  body: string;
  order: number;
}

export interface Question {
  id: string | number;
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
}

export interface Attempt {
  id: string | number;
  userId: string | number;
  topicId: string | number;
  mode: "PLAY" | "PRACTICE" | "TEST" | "RETEST";
  correct: number;
  total: number;
  score: number;
  xp?: number;
  createdAt: string;
  topic: { id: string | number; name: string; chapter: { id: string | number; name: string } };
}

export interface PerQuestion {
  questionId: string | number;
  selected: number;
  correctIndex: number | null;
  wasCorrect: boolean;
  explanation: string | null;
}

export interface WeakTopic {
  topicId: string | number;
  topicName: string;
  chapterName: string;
  score: number;
  initialScore?: number;
  improvement?: number;
  attemptsCount?: number;
  hasRetested?: boolean;
  action: "Practice" | "Retest";
}

export interface ResolvedWeakTopic {
  topicId: string | number;
  topicName: string;
  chapterName: string;
  initialScore: number;
  latestScore: number;
  improvement: number;
  attemptsCount: number;
  masteredAt: string;
}

export interface StudentProgressData {
  completedCount: number;
  totalContent: number;
  totalAttempts?: number;
  averageScore?: number;
  xp?: number;
  weakTopicsCount?: number;
  masteredTopicsCount?: number;
}

export const OPTION_KEYS = ["optionA", "optionB", "optionC", "optionD"] as const;

export function optionText(question: Question, index: number): string {
  return question[OPTION_KEYS[index]] ?? "";
}

// ------------------------- Courses + enrollment ----------------------------

export interface Course {
  id: string;
  title: string;
  description: string;
  subject: string;
  board: string;
  price: number;
  currency: string;
  teacherId: string;
  teacher?: { id: string; name: string };
  _count?: { enrollments: number };
}

export interface Enrollment {
  id: string;
  courseId: string;
  studentId: string;
  status: string;
  course?: Course & { teacher?: { id: string; name: string } };
}

// --------------------------------- Games -----------------------------------

export interface Game {
  id: string;
  title: string;
  description: string;
  type?: "memory_match" | "ordering_challenge" | "timed_challenge";
  xpPerCorrect: number;
  limit?: number;
  pairsCount?: number;
  stepsCount?: number;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  xp: number;
}

export interface GameStats {
  totalXp: number;
  gamesPlayed: number;
  bestScore: number;
  recent: {
    id: string;
    gameId: string;
    correct: number;
    total: number;
    score: number;
    xp: number;
    createdAt: string;
    topic?: { name: string } | null;
  }[];
}

// --------------------------------- Admin -----------------------------------

export interface AdminStats {
  users: number;
  students: number;
  teachers: number;
  parents: number;
  admins: number;
  courses: number;
  enrollments: number;
  attempts: number;
  questions: number;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isVerified: boolean;
  grade?: string | null;
  board?: string | null;
  school?: string | null;
  subject?: string | null;
  xp: number;
  createdAt: string;
}

// --------------------------------- Parent ----------------------------------

export interface Child {
  id: string;
  name: string;
  email: string;
  grade?: string | null;
  board?: string | null;
}

export interface ChildOverview {
  student: Child & { xp: number };
  completedCount: number;
  attempts: Attempt[];
  weakTopics: { topicId: string; topicName: string; chapterName: string; score: number }[];
}

// ----------------------------------- AI ------------------------------------

export interface TutorMessage {
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  conversationId?: string;
  createdAt?: string;
}

export interface TutorConversationSummary {
  id: string;
  title: string;
  lastMessage: string;
  messageCount: number;
  updatedAt: string;
}

export interface TutorResponse {
  success?: boolean;
  configured: boolean;
  isAiGenerated?: boolean;
  conversationId: string;
  reply: string;
  language?: string;
}

export interface GeneratedQuestion {
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correct: number;
  explanation?: string | null;
}

// -------------------------------- Payments ---------------------------------

export interface PaymentConfig {
  configured: boolean;
  keyId: string | null;
}

export interface OrderResponse {
  order: { id: string; amount: number; currency: string };
  course: { id: string; title: string };
}

// --------------------------------- Profile ---------------------------------

export interface ProfileUser {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string | null;
  grade?: string | null;
  board?: string | null;
  school?: string | null;
  subject?: string | null;
  avatarUrl?: string | null;
  xp?: number;
}

// --------------------------------- Videos (Classes 1–12 & Diploma) --------

export type EducationLevel =
  | "primary"
  | "middle"
  | "secondary"
  | "higher_secondary"
  | "diploma";

export interface EducationalVideo {
  id: string;
  title: string;
  channel: string;
  language: "en" | "hi" | "mr" | "te" | string;
  topic: string;
  educationLevel?: EducationLevel | string;
  grade?: string;
  classGrade?: string;
  board?: string;
  stream?: string;
  branch?: string;
  scheme?: string;
  semester?: number | string;
  subject?: string;
  chapter?: string;
  duration?: string;
  description: string;
  thumbnailUrl: string;
  youtubeUrl: string;
  embedUrl: string;
  sourceUrl?: string;
  verificationStatus?: "verified" | "provisional" | "unverified" | string;
  isVerified?: boolean;
}

export interface VideoSearchResponse {
  success: boolean;
  source: "curated" | "youtube_api";
  total: number;
  page?: number;
  totalPages?: number;
  videos: EducationalVideo[];
}

export interface VideoValidateResponse {
  success: boolean;
  videoId: string;
  title?: string;
  channel?: string;
  youtubeUrl: string;
  embedUrl: string;
  thumbnailUrl: string;
  embeddable?: boolean;
  message?: string;
}

export interface CurriculumMetadataResponse {
  success: boolean;
  educationLevels: {
    id: string;
    label: string;
    shortLabel?: string;
    description: string;
    classes?: string[];
    streams?: string[];
    branches?: string[];
    semesters?: number[];
  }[];
  boards: { id: string; label: string; short?: string }[];
  diplomaBranches: { id: string; label: string; short?: string }[];
  diplomaSchemes: { id: string; label: string; short?: string }[];
  schoolSubjectsByLevel: Record<string, string[]>;
  diplomaSubjectsByBranchAndSem: Record<string, Record<string, string[]>>;
}

export interface TutorVideoContext {
  videoId?: string;
  title?: string;
  topic?: string;
  subject?: string;
  chapter?: string;
  educationLevel?: string;
  classGrade?: string;
  grade?: string;
  board?: string;
  stream?: string;
  branch?: string;
  scheme?: string;
  semester?: string | number;
  transcript?: string;
}

export async function fetchCurriculumMetadata(): Promise<CurriculumMetadataResponse> {
  return apiFetch<CurriculumMetadataResponse>("/videos/curriculum");
}

export async function fetchEducationalVideos(
  params: Record<string, string | number | undefined> = {}
): Promise<VideoSearchResponse> {
  const query = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && String(val).trim() !== "" && val !== "all") {
      query.append(key, String(val).trim());
    }
  }
  const qs = query.toString();
  return apiFetch<VideoSearchResponse>(`/videos${qs ? `?${qs}` : ""}`);
}

export interface TeacherMaterial {
  id: string;
  teacherId: string;
  originalName: string;
  mimeType: string;
  extension: string;
  fileSizeBytes: number;
  formattedSize: string;
  educationLevel: "school" | "diploma";
  classGrade?: string;
  board?: string;
  stream?: string;
  branch?: string;
  scheme?: string;
  semester?: number;
  subjectName: string;
  chapterName?: string;
  topicName?: string;
  language: string;
  description?: string;
  status: "UPLOADED" | "PROCESSING" | "READY" | "FAILED";
  checksum: string;
  storageKey?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface TeacherMaterialsResponse {
  success: boolean;
  count: number;
  materials: TeacherMaterial[];
  persisted?: boolean;
  storageMode?: "mongodb" | "in_memory_ephemeral";
}

export interface TeacherUploadResponse {
  success: boolean;
  message: string;
  material: TeacherMaterial;
  persisted?: boolean;
  storageMode?: "mongodb" | "in_memory_ephemeral";
}


export async function fetchTeacherMaterials(): Promise<TeacherMaterialsResponse> {
  return apiFetch<TeacherMaterialsResponse>("/teacher/materials");
}

export async function fetchTeacherMaterialById(id: string): Promise<{ success: boolean; material: TeacherMaterial }> {
  return apiFetch<{ success: boolean; material: TeacherMaterial }>(`/teacher/materials/${id}`);
}

export async function uploadTeacherMaterial(formData: FormData): Promise<TeacherUploadResponse> {
  return apiFetch<TeacherUploadResponse>("/teacher/materials/upload", {
    method: "POST",
    body: formData,
  });
}

export async function deleteTeacherMaterial(id: string): Promise<{ success: boolean; message: string; id: string }> {
  return apiFetch<{ success: boolean; message: string; id: string }>(`/teacher/materials/${id}`, {
    method: "DELETE",
  });
}

// ---------------------- Lesson Draft Generation (Phase 3.2) -----------------

export interface LessonExplanationStep {
  stepNumber: number;
  heading: string;
  explanation: string;
  sourceReferences?: string;
}

export interface LessonExample {
  title: string;
  context: string;
  example: string;
  explanation: string;
}

export interface LessonKeyTerm {
  term: string;
  definition: string;
}

export interface LessonReviewQuestion {
  question: string;
  answer: string;
  explanation: string;
}

export interface LessonDraftContent {
  title: string;
  educationLevel: "school" | "diploma";
  gradeOrSemester?: string;
  boardOrScheme?: string;
  subject: string;
  chapter?: string;
  topic?: string;
  learningObjectives: string[];
  prerequisiteKnowledge: string[];
  stepByStepExplanation: LessonExplanationStep[];
  sourceGroundedExamples: LessonExample[];
  keyTerms: LessonKeyTerm[];
  summary: string;
  reviewQuestions: LessonReviewQuestion[];
  sourceGroundingNotes?: string;
}

export interface LessonDraft {
  id: string;
  teacherId: string;
  sourceMaterialId: string;
  sourceMaterialName?: string | null;
  title: string;
  educationLevel?: string | null;
  gradeOrSemester?: string | null;
  boardOrScheme?: string | null;
  subject: string;
  chapter?: string | null;
  topic?: string | null;
  content: LessonDraftContent;
  status: "DRAFT" | "REVIEWED" | "PUBLISHED";
  accessCode?: string | null;
  publishedAt?: string | null;
  aiProvider?: string | null;
  aiModel?: string | null;
  sourceWordCount?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateLessonResponse {
  success: boolean;
  message: string;
  persisted: boolean;
  storageMode: string;
  isAiGenerated: boolean;
  aiProvider: string;
  aiModel: string;
  draft: LessonDraft;
}

export interface TeacherLessonsResponse {
  success: boolean;
  persisted: boolean;
  storageMode: string;
  count: number;
  drafts: LessonDraft[];
}

export async function generateLessonDraft(materialId: string): Promise<GenerateLessonResponse> {
  return apiFetch<GenerateLessonResponse>("/teacher/lessons/generate", {
    method: "POST",
    body: { materialId },
  });
}

export async function fetchTeacherLessons(
  filters: { sourceMaterialId?: string; educationLevel?: string; status?: string } = {}
): Promise<TeacherLessonsResponse> {
  const query = new URLSearchParams();
  if (filters.sourceMaterialId) query.append("sourceMaterialId", filters.sourceMaterialId);
  if (filters.educationLevel && filters.educationLevel !== "all") query.append("educationLevel", filters.educationLevel);
  if (filters.status && filters.status !== "all") query.append("status", filters.status);
  const qs = query.toString();
  return apiFetch<TeacherLessonsResponse>(`/teacher/lessons${qs ? `?${qs}` : ""}`);
}

export async function fetchTeacherLessonById(id: string): Promise<{ success: boolean; draft: LessonDraft }> {
  return apiFetch<{ success: boolean; draft: LessonDraft }>(`/teacher/lessons/${id}`);
}

export async function updateTeacherLesson(
  id: string,
  updates: { title?: string; content?: LessonDraftContent; status?: string }
): Promise<{ success: boolean; message: string; draft: LessonDraft }> {
  return apiFetch<{ success: boolean; message: string; draft: LessonDraft }>(`/teacher/lessons/${id}`, {
    method: "PUT",
    body: updates,
  });
}

export async function deleteTeacherLesson(id: string): Promise<{ success: boolean; message: string; id: string }> {
  return apiFetch<{ success: boolean; message: string; id: string }>(`/teacher/lessons/${id}`, {
    method: "DELETE",
  });
}

// ------------------- Assessment & Game Generation (Phase 3.3) ----------------

export type AssessmentContentType = "PRACTICE" | "TEST" | "GAME";
export type AssessmentGameFormat =
  | "MULTIPLE_CHOICE"
  | "TRUE_FALSE"
  | "FILL_BLANK"
  | "MATCHING"
  | "FLASHCARD"
  | "ORDERING"
  | "TIMED_BLITZ"
  | "MIXED";
export type AssessmentDifficulty = "EASY" | "MEDIUM" | "HARD";
export type AssessmentQuestionType =
  | "MULTIPLE_CHOICE"
  | "TRUE_FALSE"
  | "FILL_BLANK"
  | "MATCHING"
  | "FLASHCARD"
  | "ORDERING"
  | "TIMED_BLITZ";

export interface MatchingPair {
  left: string;
  right: string;
}

export interface AssessmentOrderingItem {
  id: string;
  text: string;
}

export interface AssessmentQuestion {
  id: string;
  type: AssessmentQuestionType;
  questionText: string;
  options?: string[] | null;
  matchingPairs?: MatchingPair[] | null;
  acceptedAnswers?: string[] | null;
  front?: string;
  back?: string;
  items?: AssessmentOrderingItem[] | string[] | null;
  correctOrder?: string[] | null;
  timeLimitSeconds?: number;
  correctAnswer: string | number | boolean | Record<string, string> | string[] | unknown;
  explanation: string;
  sourceReference?: string;
}

export interface AssessmentContent {
  title: string;
  description?: string;
  contentType: AssessmentContentType;
  gameFormat: AssessmentGameFormat;
  educationLevel?: string;
  gradeOrSemester?: string;
  boardOrScheme?: string;
  subject: string;
  chapter?: string;
  topic?: string;
  difficulty: AssessmentDifficulty;
  questionCount: number;
  questions: AssessmentQuestion[];
  sourceGroundingNotes?: string;
}

export interface AssessmentDraft {
  id: string;
  teacherId: string;
  sourceMaterialId: string;
  sourceMaterialName?: string | null;
  title: string;
  description?: string | null;
  contentType: AssessmentContentType;
  gameFormat?: AssessmentGameFormat | null;
  difficulty: AssessmentDifficulty;
  questionCount: number;
  educationLevel?: string | null;
  gradeOrSemester?: string | null;
  boardOrScheme?: string | null;
  subject: string;
  chapter?: string | null;
  topic?: string | null;
  content: AssessmentContent;
  status: "DRAFT" | "REVIEWED" | "PUBLISHED";
  accessCode?: string | null;
  publishedAt?: string | null;
  grade?: string | null;
  aiProvider?: string | null;
  aiModel?: string | null;
  sourceWordCount?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateAssessmentParams {
  materialId: string;
  contentType?: AssessmentContentType;
  gameFormat?: AssessmentGameFormat;
  difficulty?: AssessmentDifficulty;
  questionCount?: 5 | 10 | 15 | 20;
}

export interface GenerateAssessmentResponse {
  success: boolean;
  message: string;
  persisted: boolean;
  storageMode: string;
  isAiGenerated: boolean;
  aiProvider: string;
  aiModel: string;
  assessment: AssessmentDraft;
}

export interface TeacherAssessmentsResponse {
  success: boolean;
  persisted: boolean;
  storageMode: string;
  count: number;
  assessments: AssessmentDraft[];
}

export async function generateAssessment(params: GenerateAssessmentParams): Promise<GenerateAssessmentResponse> {
  return apiFetch<GenerateAssessmentResponse>("/teacher/assessments/generate", {
    method: "POST",
    body: params,
  });
}

export async function fetchTeacherAssessments(
  filters: { sourceMaterialId?: string; contentType?: string; difficulty?: string; status?: string } = {}
): Promise<TeacherAssessmentsResponse> {
  const query = new URLSearchParams();
  if (filters.sourceMaterialId) query.append("sourceMaterialId", filters.sourceMaterialId);
  if (filters.contentType && filters.contentType !== "all") query.append("contentType", filters.contentType);
  if (filters.difficulty && filters.difficulty !== "all") query.append("difficulty", filters.difficulty);
  if (filters.status && filters.status !== "all") query.append("status", filters.status);
  const qs = query.toString();
  return apiFetch<TeacherAssessmentsResponse>(`/teacher/assessments${qs ? `?${qs}` : ""}`);
}

export async function fetchTeacherAssessmentById(id: string): Promise<{ success: boolean; assessment: AssessmentDraft }> {
  return apiFetch<{ success: boolean; assessment: AssessmentDraft }>(`/teacher/assessments/${id}`);
}

export async function updateTeacherAssessment(
  id: string,
  updates: { title?: string; description?: string; content?: AssessmentContent; status?: string }
): Promise<{ success: boolean; message: string; assessment: AssessmentDraft }> {
  return apiFetch<{ success: boolean; message: string; assessment: AssessmentDraft }>(`/teacher/assessments/${id}`, {
    method: "PUT",
    body: updates,
  });
}

export async function deleteTeacherAssessment(id: string): Promise<{ success: boolean; message: string; id: string }> {
  return apiFetch<{ success: boolean; message: string; id: string }>(`/teacher/assessments/${id}`, {
    method: "DELETE",
  });
}

// ------------------- Teacher Publishing & Student Access (Phase 3.4) ----------

export type {
  PublishedContentType,
  PublishedItemSummary,
  PublishContentResponse,
  UnpublishContentResponse,
  TeacherPublishedListResponse,
  StudentPublishedContent,
  StudentPublishedLessonContent,
  StudentPublishedAssessmentContent,
  VerifyAccessCodeResponse,
  CheckAnswerResponse,
} from "@/types/published-content";

import type {
  PublishedContentType,
  PublishContentResponse,
  UnpublishContentResponse,
  TeacherPublishedListResponse,
  VerifyAccessCodeResponse,
  CheckAnswerResponse,
  AssessmentSessionResponse,
  SubmittedAnswerItem,
  AssessmentSubmissionResponse,
} from "@/types/published-content";

export async function publishTeacherContent(
  contentType: PublishedContentType,
  contentId: string
): Promise<PublishContentResponse> {
  return apiFetch<PublishContentResponse>("/teacher/publish", {
    method: "POST",
    body: { contentType, contentId },
  });
}

export async function unpublishTeacherContent(
  contentType: PublishedContentType,
  contentId: string
): Promise<UnpublishContentResponse> {
  return apiFetch<UnpublishContentResponse>("/teacher/unpublish", {
    method: "POST",
    body: { contentType, contentId },
  });
}

export async function fetchTeacherPublishedContent(): Promise<TeacherPublishedListResponse> {
  return apiFetch<TeacherPublishedListResponse>("/teacher/published");
}

export async function verifyStudentAccessCode(code: string): Promise<VerifyAccessCodeResponse> {
  return apiFetch<VerifyAccessCodeResponse>("/student/access/verify", {
    method: "POST",
    body: { code },
  });
}

export interface CheckAnswerPayload {
  accessCode?: string;
  code?: string;
  contentType?: PublishedContentType;
  questionId: string;
  submittedAnswer?: unknown;
  studentAnswer?: unknown;
}

export async function checkStudentAnswer(
  codeOrPayload: string | CheckAnswerPayload,
  questionId?: string,
  studentAnswer?: unknown
): Promise<CheckAnswerResponse> {
  let finalCode = "";
  let finalQId = "";
  let finalAnswer: unknown = null;

  if (typeof codeOrPayload === "object") {
    finalCode = codeOrPayload.accessCode || codeOrPayload.code || "";
    finalQId = codeOrPayload.questionId;
    finalAnswer =
      codeOrPayload.submittedAnswer !== undefined
        ? codeOrPayload.submittedAnswer
        : codeOrPayload.studentAnswer;
  } else {
    finalCode = codeOrPayload;
    finalQId = questionId || "";
    finalAnswer = studentAnswer;
  }

  return apiFetch<CheckAnswerResponse>("/student/access/check-answer", {
    method: "POST",
    body: { code: finalCode, questionId: finalQId, studentAnswer: finalAnswer },
  });
}

export async function startStudentAssessment(
  code: string,
  studentId?: string
): Promise<AssessmentSessionResponse> {
  return apiFetch<AssessmentSessionResponse>("/student/access/start-assessment", {
    method: "POST",
    body: { code, studentId },
  });
}

export async function submitStudentAssessment(payload: {
  code: string;
  sessionId?: string;
  answers: SubmittedAnswerItem[] | Record<string, unknown>;
  studentId?: string;
}): Promise<AssessmentSubmissionResponse> {
  return apiFetch<AssessmentSubmissionResponse>("/student/access/submit-assessment", {
    method: "POST",
    body: payload,
  });
}

export async function fetchTeacherApplication(): Promise<{ success: boolean; application: TeacherApplication }> {
  return apiFetch<{ success: boolean; application: TeacherApplication }>("/teacher/application");
}

export async function submitTeacherApplication(data: {
  name: string;
  avatarUrl?: string | null;
  institution?: string;
  subjects?: string;
  qualifications?: string;
  experience?: string;
  documents?: TeacherDocument[];
}): Promise<{ success: boolean; message: string; application: TeacherApplication }> {
  return apiFetch<{ success: boolean; message: string; application: TeacherApplication }>("/teacher/application", {
    method: "POST",
    body: data,
  });
}

export async function uploadTeacherDocument(
  file: File
): Promise<{ success: boolean; message?: string; document?: TeacherDocument }> {
  const token = getToken();
  const formData = new FormData();
  formData.append("document", file);

  const res = await fetch("/api/teacher/application/document", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  return res.json();
}

export async function fetchAdminTeacherApplications(
  status = "ALL",
  query = ""
): Promise<{ success: boolean; applications: TeacherApplication[] }> {
  const params = new URLSearchParams();
  if (status && status !== "ALL") params.set("status", status);
  if (query) params.set("q", query);
  const qStr = params.toString() ? `?${params.toString()}` : "";
  return apiFetch<{ success: boolean; applications: TeacherApplication[] }>(`/admin/teacher-applications${qStr}`);
}

export async function reviewAdminTeacherApplication(
  userId: string,
  decision: { status: "APPROVED" | "REJECTED"; reason?: string }
): Promise<{ success: boolean; message: string; application: TeacherApplication }> {
  return apiFetch<{ success: boolean; message: string; application: TeacherApplication }>(
    `/admin/teacher-applications/${userId}/decision`,
    {
      method: "POST",
      body: decision,
    }
  );
}

export async function fetchDiplomaMeta(): Promise<DiplomaMeta> {
  const res = await apiFetch<{
    success: boolean;
    boards: Board[];
    years: string[];
    branches: string[];
    semestersByYear: Record<string, string[]>;
  }>("/student/diploma/meta");
  return {
    boards: res.boards,
    years: res.years,
    branches: res.branches,
    semestersByYear: res.semestersByYear,
  };
}

export async function saveStudentLearnSelection(selection: {
  educationType?: EducationType;
  boardId: string | number;
  gradeId: string | number;
  branch?: string | null;
  semester?: string | null;
  subjectId: string | number;
  chapterId: string | number;
  topicId: string | number;
}): Promise<{ success: boolean; selection: CurriculumSelection }> {
  return apiFetch<{ success: boolean; selection: CurriculumSelection }>(
    "/student/learn/selection",
    {
      method: "POST",
      body: selection,
    }
  );
}

export async function fetchSavedStudentLearnSelection(): Promise<CurriculumSelection | null> {
  try {
    const res = await apiFetch<{
      success: boolean;
      selection: CurriculumSelection | null;
    }>("/student/learn/selection");
    return res.selection;
  } catch {
    return null;
  }
}

export interface MemoryPair {
  id: string;
  term: string;
  match: string;
}

export interface OrderingStep {
  id: string;
  text: string;
  order: number;
}

export interface OrderingPuzzle {
  title: string;
  steps: OrderingStep[];
}

export interface TopicGameDataResponse {
  success: boolean;
  topicId: string;
  topicName: string;
  memoryPairs: MemoryPair[];
  orderingPuzzle: OrderingPuzzle;
  timedQuestions: Question[];
}

export interface ReportVideoPayload {
  videoId: string;
  reason: string;
  topicId?: string;
}

export async function fetchTopicGameData(topicId: string, gameId?: string): Promise<TopicGameDataResponse> {
  const query = new URLSearchParams();
  query.set("topicId", topicId);
  if (gameId) query.set("gameId", gameId);
  return apiFetch<TopicGameDataResponse>(`/student/games/data?${query.toString()}`);
}

export async function reportVideo(payload: ReportVideoPayload): Promise<{ success: boolean; message: string }> {
  return apiFetch<{ success: boolean; message: string }>("/videos/report", {
    method: "POST",
    body: payload,
  });
}

// ------------------- Class access codes (time-limited, one code for all material) ----

export type ClassCodeStatus = "ACTIVE" | "EXPIRED" | "REVOKED";

export interface ClassCodeItem {
  id: string;
  code: string;
  title: string | null;
  status: ClassCodeStatus;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  publishedCount: number;
}

export interface ClassBundle {
  title: string;
  teacherName: string | null;
  expiresAt: string;
  items: import("@/types/published-content").StudentPublishedContent[];
}

export async function createClassCode(payload: {
  title?: string;
  durationMinutes: number;
}): Promise<{ success: boolean; item: ClassCodeItem }> {
  return apiFetch("/teacher/class-codes", { method: "POST", body: payload });
}

export async function fetchClassCodes(): Promise<{
  success: boolean;
  publishedCount: number;
  items: ClassCodeItem[];
}> {
  return apiFetch("/teacher/class-codes");
}

export async function revokeClassCode(id: string): Promise<{ success: boolean; item: ClassCodeItem }> {
  return apiFetch(`/teacher/class-codes/${encodeURIComponent(id)}/revoke`, { method: "POST", body: {} });
}

/** Class codes look like LC-XXXXXXXX (single-item codes look like LU-XXXXXX). */
export function looksLikeClassCode(raw: string): boolean {
  return /^LC/.test(raw.replace(/[\s-]/g, "").toUpperCase());
}

export async function verifyClassCode(code: string): Promise<{ success: boolean; bundle: ClassBundle }> {
  return apiFetch("/student/access/class/verify", { method: "POST", body: { code } });
}
