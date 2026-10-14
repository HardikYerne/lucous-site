/**
 * Publishing and Student Access Service for LUCOUS Phase 3.4
 * 
 * Coordinates:
 * - Content validation prior to publication.
 * - Secure access code generation and uniqueness verification.
 * - Atomic state transitions (DRAFT -> PUBLISHED and PUBLISHED -> DRAFT).
 * - Multi-storage persistence (Prisma MongoDB with in-memory dev/test fallback).
 * - Student-safe content sanitization (preventing leakage of teacher data, private documents, or DB internals).
 */

const {
  normalizeAccessCode,
  isValidAccessCodeFormat,
  generateUniqueAccessCode,
} = require("./access-code-service");

const {
  validateLessonForPublishing,
  validateAssessmentForPublishing,
} = require("../validators/publishing-validator");

const inMemoryAccessCodes = new Map();

function isEphemeralAllowed() {
  if (process.env.ALLOW_EPHEMERAL_DEV_STORAGE === "false") {
    return false;
  }
  return (
    process.env.ALLOW_EPHEMERAL_DEV_STORAGE === "true" ||
    process.env.NODE_ENV === "test"
  );
}

/**
 * Checks whether an access code is currently assigned to any published lesson or assessment.
 */
async function isCodeAssigned(prisma, accessCode) {
  if (inMemoryAccessCodes.has(accessCode)) {
    return true;
  }

  if (prisma) {
    try {
      if (prisma.lessonDraft) {
        const existingLesson = await prisma.lessonDraft.findFirst({
          where: { accessCode },
          select: { id: true },
        });
        if (existingLesson) return true;
      }
      if (prisma.assessmentDraft) {
        const existingAssessment = await prisma.assessmentDraft.findFirst({
          where: { accessCode },
          select: { id: true },
        });
        if (existingAssessment) return true;
      }
    } catch {
      // In dev fallback mode
    }
  }

  return false;
}

/**
 * Publishes a teacher-owned lesson or assessment draft.
 */
async function publishTeacherContent(prisma, { teacherId, contentType, contentId }) {
  if (!teacherId) {
    const err = new Error("Authentication required.");
    err.statusCode = 401;
    throw err;
  }

  const normalizedType = String(contentType || "").toUpperCase();
  if (normalizedType !== "LESSON" && normalizedType !== "ASSESSMENT") {
    const err = new Error("Invalid content type. Must be LESSON or ASSESSMENT.");
    err.statusCode = 400;
    throw err;
  }

  let draft = null;
  const isLesson = normalizedType === "LESSON";

  // 1. Retrieve the draft from DB or fallback
  if (isLesson) {
    if (prisma && prisma.lessonDraft) {
      try {
        draft = await prisma.lessonDraft.findUnique({ where: { id: contentId } });
      } catch (dbErr) {
        if (!isEphemeralAllowed()) throw dbErr;
      }
    }
    if (!draft && isEphemeralAllowed()) {
      const { inMemoryDrafts } = require("../routes/teacher-lessons");
      draft = inMemoryDrafts.get(contentId) || null;
    }
  } else {
    if (prisma && prisma.assessmentDraft) {
      try {
        draft = await prisma.assessmentDraft.findUnique({ where: { id: contentId } });
      } catch (dbErr) {
        if (!isEphemeralAllowed()) throw dbErr;
      }
    }
    if (!draft && isEphemeralAllowed()) {
      const { inMemoryAssessments } = require("../routes/teacher-assessments");
      draft = inMemoryAssessments.get(contentId) || null;
    }
  }

  if (!draft) {
    const err = new Error(`${isLesson ? "Lesson" : "Assessment"} draft not found.`);
    err.statusCode = 404;
    throw err;
  }

  // 2. Ownership verification
  if (draft.teacherId !== teacherId) {
    const err = new Error("Unauthorized: You do not own this content.");
    err.statusCode = 403;
    throw err;
  }

  // 3. Validation before publication
  const validation = isLesson
    ? validateLessonForPublishing(draft)
    : validateAssessmentForPublishing(draft);

  if (!validation.valid) {
    const err = new Error(`Cannot publish incomplete content: ${validation.errors.join(" ")}`);
    err.statusCode = 400;
    err.details = validation.errors;
    throw err;
  }

  // 4. Generate or preserve access code
  let accessCode = draft.accessCode;
  if (!accessCode || !isValidAccessCodeFormat(accessCode)) {
    accessCode = await generateUniqueAccessCode(async (code) => {
      return await isCodeAssigned(prisma, code);
    });
  }

  const publishedAt = new Date();

  // 5. Atomic persistence of publication status
  let updatedRecord = null;
  if (isLesson) {
    if (prisma && prisma.lessonDraft) {
      try {
        updatedRecord = await prisma.lessonDraft.update({
          where: { id: contentId },
          data: {
            status: "PUBLISHED",
            accessCode,
            publishedAt,
          },
        });
      } catch (dbErr) {
        if (!isEphemeralAllowed()) throw dbErr;
      }
    }
    if (!updatedRecord && isEphemeralAllowed()) {
      const { inMemoryDrafts } = require("../routes/teacher-lessons");
      updatedRecord = {
        ...draft,
        status: "PUBLISHED",
        accessCode,
        publishedAt,
        updatedAt: new Date(),
      };
      inMemoryDrafts.set(contentId, updatedRecord);
    }
  } else {
    if (prisma && prisma.assessmentDraft) {
      try {
        updatedRecord = await prisma.assessmentDraft.update({
          where: { id: contentId },
          data: {
            status: "PUBLISHED",
            accessCode,
            publishedAt,
          },
        });
      } catch (dbErr) {
        if (!isEphemeralAllowed()) throw dbErr;
      }
    }
    if (!updatedRecord && isEphemeralAllowed()) {
      const { inMemoryAssessments } = require("../routes/teacher-assessments");
      updatedRecord = {
        ...draft,
        status: "PUBLISHED",
        accessCode,
        publishedAt,
        updatedAt: new Date(),
      };
      inMemoryAssessments.set(contentId, updatedRecord);
    }
  }

  // Cache access code mapping for quick student lookup
  inMemoryAccessCodes.set(accessCode, {
    contentType: normalizedType,
    contentId,
    teacherId,
  });

  return {
    success: true,
    message: `${isLesson ? "Lesson" : "Assessment"} published successfully.`,
    contentId,
    contentType: normalizedType,
    title: updatedRecord.title,
    accessCode,
    status: "PUBLISHED",
    publishedAt,
  };
}

/**
 * Revokes publication (unpublishes) for teacher-owned content, immediately severing student access.
 */
async function unpublishTeacherContent(prisma, { teacherId, contentType, contentId }) {
  if (!teacherId) {
    const err = new Error("Authentication required.");
    err.statusCode = 401;
    throw err;
  }

  const normalizedType = String(contentType || "").toUpperCase();
  const isLesson = normalizedType === "LESSON";

  let draft = null;
  if (isLesson) {
    if (prisma && prisma.lessonDraft) {
      try {
        draft = await prisma.lessonDraft.findUnique({ where: { id: contentId } });
      } catch (dbErr) {
        if (!isEphemeralAllowed()) throw dbErr;
      }
    }
    if (!draft && isEphemeralAllowed()) {
      const { inMemoryDrafts } = require("../routes/teacher-lessons");
      draft = inMemoryDrafts.get(contentId) || null;
    }
  } else {
    if (prisma && prisma.assessmentDraft) {
      try {
        draft = await prisma.assessmentDraft.findUnique({ where: { id: contentId } });
      } catch (dbErr) {
        if (!isEphemeralAllowed()) throw dbErr;
      }
    }
    if (!draft && isEphemeralAllowed()) {
      const { inMemoryAssessments } = require("../routes/teacher-assessments");
      draft = inMemoryAssessments.get(contentId) || null;
    }
  }

  if (!draft) {
    const err = new Error("Content not found.");
    err.statusCode = 404;
    throw err;
  }

  if (draft.teacherId !== teacherId) {
    const err = new Error("Unauthorized: You do not own this content.");
    err.statusCode = 403;
    throw err;
  }

  const previousCode = draft.accessCode;

  // Revert status to REVIEWED and clear access code
  if (isLesson) {
    if (prisma && prisma.lessonDraft) {
      try {
        await prisma.lessonDraft.update({
          where: { id: contentId },
          data: {
            status: "REVIEWED",
            accessCode: null,
            publishedAt: null,
          },
        });
      } catch (dbErr) {
        if (!isEphemeralAllowed()) throw dbErr;
      }
    }
    if (isEphemeralAllowed()) {
      const { inMemoryDrafts } = require("../routes/teacher-lessons");
      inMemoryDrafts.set(contentId, {
        ...draft,
        status: "REVIEWED",
        accessCode: null,
        publishedAt: null,
        updatedAt: new Date(),
      });
    }
  } else {
    if (prisma && prisma.assessmentDraft) {
      try {
        await prisma.assessmentDraft.update({
          where: { id: contentId },
          data: {
            status: "REVIEWED",
            accessCode: null,
            publishedAt: null,
          },
        });
      } catch (dbErr) {
        if (!isEphemeralAllowed()) throw dbErr;
      }
    }
    if (isEphemeralAllowed()) {
      const { inMemoryAssessments } = require("../routes/teacher-assessments");
      inMemoryAssessments.set(contentId, {
        ...draft,
        status: "REVIEWED",
        accessCode: null,
        publishedAt: null,
        updatedAt: new Date(),
      });
    }
  }

  if (previousCode) {
    inMemoryAccessCodes.delete(previousCode);
  }

  return {
    success: true,
    message: "Content unpublished successfully. Student access has been revoked.",
    contentId,
    status: "REVIEWED",
  };
}

/**
 * Retrieves all published content and access codes owned by the authenticated teacher.
 */
async function getTeacherPublishedContent(prisma, teacherId) {
  const publishedItems = [];

  // Lessons
  if (prisma && prisma.lessonDraft) {
    try {
      const lessons = await prisma.lessonDraft.findMany({
        where: { teacherId, status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" },
      });
      lessons.forEach((l) => {
        let contentObj = l.content;
        try {
          if (typeof contentObj === "string") contentObj = JSON.parse(contentObj);
        } catch {}
        publishedItems.push({
          id: l.id,
          contentType: "LESSON",
          title: l.title,
          subject: l.subject,
          chapter: l.chapter,
          topic: l.topic,
          educationLevel: l.educationLevel,
          gradeOrSemester: l.gradeOrSemester,
          boardOrScheme: l.boardOrScheme,
          accessCode: l.accessCode,
          publishedAt: l.publishedAt,
          summary: contentObj?.summary || null,
        });
      });
    } catch (err) {
      if (!isEphemeralAllowed()) throw err;
    }
  }

  // Assessments
  if (prisma && prisma.assessmentDraft) {
    try {
      const asmts = await prisma.assessmentDraft.findMany({
        where: { teacherId, status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" },
      });
      asmts.forEach((a) => {
        publishedItems.push({
          id: a.id,
          contentType: "ASSESSMENT",
          title: a.title,
          subject: a.subject,
          chapter: a.chapter,
          topic: a.topic,
          educationLevel: a.educationLevel,
          gradeOrSemester: a.gradeOrSemester,
          boardOrScheme: a.boardOrScheme,
          difficulty: a.difficulty,
          questionCount: a.questionCount,
          accessCode: a.accessCode,
          publishedAt: a.publishedAt,
        });
      });
    } catch (err) {
      if (!isEphemeralAllowed()) throw err;
    }
  }

  // Ephemeral in-memory items
  if (isEphemeralAllowed()) {
    const { inMemoryDrafts } = require("../routes/teacher-lessons");
    for (const d of inMemoryDrafts.values()) {
      if (d.teacherId === teacherId && d.status === "PUBLISHED") {
        if (!publishedItems.some((x) => x.id === d.id)) {
          publishedItems.push({
            id: d.id,
            contentType: "LESSON",
            title: d.title,
            subject: d.subject,
            chapter: d.chapter,
            topic: d.topic,
            educationLevel: d.educationLevel,
            gradeOrSemester: d.gradeOrSemester,
            boardOrScheme: d.boardOrScheme,
            accessCode: d.accessCode,
            publishedAt: d.publishedAt,
            summary: d.content?.summary || null,
          });
        }
      }
    }

    const { inMemoryAssessments } = require("../routes/teacher-assessments");
    for (const a of inMemoryAssessments.values()) {
      if (a.teacherId === teacherId && a.status === "PUBLISHED") {
        if (!publishedItems.some((x) => x.id === a.id)) {
          publishedItems.push({
            id: a.id,
            contentType: "ASSESSMENT",
            title: a.title,
            subject: a.subject,
            chapter: a.chapter,
            topic: a.topic,
            educationLevel: a.educationLevel,
            gradeOrSemester: a.gradeOrSemester,
            boardOrScheme: a.boardOrScheme,
            difficulty: a.difficulty,
            questionCount: a.questionCount,
            accessCode: a.accessCode,
            publishedAt: a.publishedAt,
          });
        }
      }
    }
  }

  return publishedItems;
}

/**
 * Helper to find published content by access code (database or ephemeral).
 */
async function findPublishedContentByAccessCode(prisma, rawCode) {
  const normalized = normalizeAccessCode(rawCode);
  if (!isValidAccessCodeFormat(normalized)) {
    return null;
  }

  let foundItem = null;
  let itemType = null;

  if (prisma) {
    try {
      if (prisma.lessonDraft) {
        const lesson = await prisma.lessonDraft.findFirst({
          where: { accessCode: normalized, status: "PUBLISHED" },
        });
        if (lesson) {
          foundItem = lesson;
          itemType = "LESSON";
        }
      }
      if (!foundItem && prisma.assessmentDraft) {
        const asmt = await prisma.assessmentDraft.findFirst({
          where: { accessCode: normalized, status: "PUBLISHED" },
        });
        if (asmt) {
          foundItem = asmt;
          itemType = "ASSESSMENT";
        }
      }
    } catch {}
  }

  if (!foundItem && isEphemeralAllowed()) {
    const { inMemoryDrafts } = require("../routes/teacher-lessons");
    for (const l of inMemoryDrafts.values()) {
      if (l.accessCode === normalized && l.status === "PUBLISHED") {
        foundItem = l;
        itemType = "LESSON";
        break;
      }
    }

    if (!foundItem) {
      const { inMemoryAssessments } = require("../routes/teacher-assessments");
      for (const a of inMemoryAssessments.values()) {
        if (a.accessCode === normalized && a.status === "PUBLISHED") {
          foundItem = a;
          itemType = "ASSESSMENT";
          break;
        }
      }
    }
  }

  if (!foundItem) return null;

  let parsedContent = foundItem.content;
  if (typeof parsedContent === "string") {
    try {
      parsedContent = JSON.parse(parsedContent);
    } catch {}
  }

  return {
    item: foundItem,
    itemType,
    normalizedCode: normalized,
    parsedContent,
  };
}

// In-memory store for active student assessment attempts/sessions
const inMemoryAssessmentSessions = new Map();

/**
 * Starts a student assessment session with a server-validated deadline.
 */
async function startStudentAssessmentSession(prisma, { rawCode, studentId }) {
  const lookup = await findPublishedContentByAccessCode(prisma, rawCode);
  if (!lookup || lookup.itemType !== "ASSESSMENT") {
    const err = new Error("Invalid access code or assessment is not published.");
    err.statusCode = 404;
    throw err;
  }

  const { item, parsedContent, normalizedCode } = lookup;
  const questions = parsedContent?.questions || [];

  let isTimed = item.gameFormat === "TIMED_BLITZ" || parsedContent?.gameFormat === "TIMED_BLITZ";
  let totalTimeLimitSeconds = 0;

  for (const q of questions) {
    if (q.type === "TIMED_BLITZ" || q.timeLimitSeconds) {
      isTimed = true;
      totalTimeLimitSeconds += (q.timeLimitSeconds || 30);
    }
  }

  if (isTimed && totalTimeLimitSeconds === 0) {
    totalTimeLimitSeconds = Math.max(30, questions.length * 20);
  }

  const now = Date.now();
  // Server-enforced deadline includes 15 seconds grace period for network latency
  const deadline = isTimed ? now + (totalTimeLimitSeconds * 1000) + 15000 : null;
  const sessionId = `sess_${now}_${Math.random().toString(36).slice(2, 9)}`;

  const session = {
    sessionId,
    accessCode: normalizedCode,
    contentId: item.id,
    studentId: studentId || null,
    startedAt: now,
    isTimed,
    totalTimeLimitSeconds: isTimed ? totalTimeLimitSeconds : null,
    deadline,
    completed: false,
    completedAt: null,
    questionCount: questions.length,
    questionIds: questions.map((q, idx) => q.id || `q_${idx + 1}`),
  };

  inMemoryAssessmentSessions.set(sessionId, session);

  return {
    success: true,
    sessionId,
    accessCode: normalizedCode,
    contentId: item.id,
    title: item.title,
    questionCount: questions.length,
    isTimed,
    totalTimeSeconds: isTimed ? totalTimeLimitSeconds : null,
    deadline,
    startedAt: now,
  };
}

/**
 * Grades a full student assessment attempt securely on the server.
 */
async function submitStudentAssessment(prisma, { rawCode, sessionId, answers, studentId }) {
  const lookup = await findPublishedContentByAccessCode(prisma, rawCode);
  if (!lookup || lookup.itemType !== "ASSESSMENT") {
    const err = new Error("Invalid access code or assessment is no longer published.");
    err.statusCode = 404;
    throw err;
  }

  const { item, parsedContent, normalizedCode } = lookup;
  const questions = parsedContent?.questions || [];

  let session = null;
  if (sessionId) {
    session = inMemoryAssessmentSessions.get(sessionId);
    if (!session || session.accessCode !== normalizedCode) {
      const err = new Error("Invalid assessment session.");
      err.statusCode = 400;
      throw err;
    }

    if (session.completed) {
      const err = new Error("Assessment attempt has already been submitted.");
      err.statusCode = 400;
      err.code = "DUPLICATE_SUBMISSION";
      throw err;
    }

    if (session.deadline && Date.now() > session.deadline) {
      const err = new Error("Assessment submission rejected: time limit expired.");
      err.statusCode = 400;
      err.code = "TIME_EXPIRED";
      throw err;
    }

    // Immediately mark session as completed to prevent duplicate or concurrent submission races
    session.completed = true;
    session.completedAt = new Date();
  }

  if (!answers || (!Array.isArray(answers) && typeof answers !== "object")) {
    const err = new Error("Submitted answers payload is required.");
    err.statusCode = 400;
    throw err;
  }

  // Normalize answers to map: questionId -> answer
  const answerMap = new Map();
  if (Array.isArray(answers)) {
    for (const item of answers) {
      if (item && item.questionId) {
        if (!answerMap.has(item.questionId)) {
          answerMap.set(item.questionId, item.studentAnswer !== undefined ? item.studentAnswer : item.answer);
        }
      }
    }
  } else {
    for (const [qId, val] of Object.entries(answers)) {
      if (!answerMap.has(qId)) {
        answerMap.set(qId, val);
      }
    }
  }

  // Validate submitted questions belong to the assessment
  const validQuestionIds = new Set(questions.map((q, idx) => q.id || `q_${idx + 1}`));
  for (const submittedQId of answerMap.keys()) {
    if (!validQuestionIds.has(submittedQId)) {
      const err = new Error(`Invalid question ID '${submittedQId}' does not belong to this assessment.`);
      err.statusCode = 400;
      throw err;
    }
  }

  // Server-side grading of each question
  const results = [];
  let correctCount = 0;

  for (let idx = 0; idx < questions.length; idx++) {
    const q = questions[idx];
    const qId = q.id || `q_${idx + 1}`;
    const studentAnswer = answerMap.has(qId) ? answerMap.get(qId) : null;

    let isCorrect = false;

    if (studentAnswer !== null && studentAnswer !== undefined) {
      if (q.type === "TRUE_FALSE") {
        const studentBool =
          typeof studentAnswer === "boolean"
            ? studentAnswer
            : String(studentAnswer).trim().toLowerCase() === "true";
        const expectedBool =
          typeof q.correctAnswer === "boolean"
            ? q.correctAnswer
            : String(q.correctAnswer).trim().toLowerCase() === "true";
        isCorrect = studentBool === expectedBool;
      } else if (
        q.type === "MULTIPLE_CHOICE" ||
        q.type === "FILL_BLANK" ||
        q.type === "TIMED_BLITZ"
      ) {
        const normStudent = String(studentAnswer).trim().toLowerCase();
        const normExpected = String(q.correctAnswer || "").trim().toLowerCase();
        isCorrect = normStudent === normExpected;
        if (!isCorrect && Array.isArray(q.acceptableAnswers)) {
          isCorrect = q.acceptableAnswers.some(
            (ans) => String(ans).trim().toLowerCase() === normStudent
          );
        }
      } else if (q.type === "FLASHCARD") {
        isCorrect =
          studentAnswer === true ||
          studentAnswer === "known" ||
          String(studentAnswer).trim().toLowerCase() ===
            String(q.back || q.correctAnswer || "").trim().toLowerCase();
      } else if (q.type === "ORDERING") {
        const expectedOrder = q.correctOrder || q.correctAnswer;
        if (Array.isArray(studentAnswer) && Array.isArray(expectedOrder)) {
          isCorrect =
            studentAnswer.length === expectedOrder.length &&
            studentAnswer.every((id, i) => id === expectedOrder[i]);
        }
      } else if (q.type === "MATCHING") {
        let expectedMapping = q.correctAnswer;
        if (!expectedMapping && Array.isArray(q.matchingPairs)) {
          expectedMapping = {};
          q.matchingPairs.forEach((p) => {
            expectedMapping[p.left] = p.right;
          });
        }
        if (expectedMapping && typeof studentAnswer === "object") {
          let sObj = studentAnswer;
          if (Array.isArray(studentAnswer)) {
            sObj = {};
            studentAnswer.forEach((p) => {
              if (p && p.left) sObj[p.left] = p.right;
            });
          }
          const keys = Object.keys(expectedMapping);
          isCorrect =
            keys.length > 0 &&
            keys.every((k) => sObj[k] === expectedMapping[k]);
        }
      }
    }

    if (isCorrect) correctCount++;

    const revealedAnswer =
      q.correctAnswer !== undefined
        ? q.correctAnswer
        : q.back !== undefined
        ? q.back
        : q.correctOrder !== undefined
        ? q.correctOrder
        : null;

    results.push({
      questionId: qId,
      type: q.type || "MULTIPLE_CHOICE",
      questionText: q.questionText || q.front || "",
      studentAnswer: studentAnswer !== undefined ? studentAnswer : null,
      correctAnswer: revealedAnswer,
      isCorrect,
      explanation: q.explanation || "Source-grounded concept review.",
      sourceReference: q.sourceReference || null,
    });
  }

  const totalQuestions = questions.length;
  const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  if (session) {
    session.verifiedResult = { score, correctCount, totalQuestions };
  }

  return {
    success: true,
    score,
    correctCount,
    totalQuestions,
    topicId:
      item.topicId ||
      parsedContent?.topicId ||
      (item.sourceMaterial && item.sourceMaterial.topicId) ||
      null,
    topic: item.topic || null,
    subject: item.subject,
    chapter: item.chapter || null,
    gameFormat: item.gameFormat || parsedContent?.gameFormat || "MULTIPLE_CHOICE",
    difficulty: item.difficulty || "MEDIUM",
    completedAt: new Date().toISOString(),
    results,
  };
}

/**
 * Public lookup for students using a normalized access code.
 * Strictly returns only PUBLISHED items and sanitizes private/teacher fields.
 */
async function getStudentContentByAccessCode(prisma, rawCode) {
  const lookup = await findPublishedContentByAccessCode(prisma, rawCode);
  if (!lookup) {
    return null;
  }

  const { item: foundItem, itemType, parsedContent } = lookup;

  // Student-safe sanitization: omit internal IDs, storage keys, teacherId, credentials
  if (itemType === "LESSON") {
    return {
      contentType: "LESSON",
      contentId: foundItem.id,
      title: foundItem.title,
      subject: foundItem.subject,
      chapter: foundItem.chapter || null,
      topic: foundItem.topic || null,
      educationLevel: foundItem.educationLevel || null,
      gradeOrSemester: foundItem.gradeOrSemester || null,
      boardOrScheme: foundItem.boardOrScheme || null,
      accessCode: foundItem.accessCode,
      publishedAt: foundItem.publishedAt,
      content: {
        title: parsedContent.title || foundItem.title,
        summary: parsedContent.summary || "",
        learningObjectives: parsedContent.learningObjectives || [],
        explanationSteps: (parsedContent.explanationSteps || parsedContent.stepByStepExplanation || []).map((s) => ({
          stepNumber: s.stepNumber,
          heading: s.heading,
          explanation: s.explanation,
        })),
        sourceGroundedExamples: (parsedContent.sourceGroundedExamples || []).map((e) => ({
          title: e.title,
          context: e.context,
          example: e.example,
          explanation: e.explanation,
        })),
        keyTerms: (parsedContent.keyTerms || []).map((k) => ({
          term: k.term,
          definition: k.definition,
        })),
        reviewQuestions: (parsedContent.reviewQuestions || []).map((q, idx) => ({
          id: `rq_${idx + 1}`,
          question: q.question,
          // Hide direct answer key on initial render; verify via check-answer endpoint or user practice
          hasAnswer: Boolean(q.answer),
        })),
      },
    };
  } else {
    // ASSESSMENT
    return {
      contentType: "ASSESSMENT",
      contentId: foundItem.id,
      title: foundItem.title,
      description: foundItem.description || null,
      subject: foundItem.subject,
      chapter: foundItem.chapter || null,
      topic: foundItem.topic || null,
      topicId: foundItem.topicId || (parsedContent && parsedContent.topicId) || (foundItem.sourceMaterial && foundItem.sourceMaterial.topicId) || null,
      educationLevel: foundItem.educationLevel || null,
      gradeOrSemester: foundItem.gradeOrSemester || null,
      boardOrScheme: foundItem.boardOrScheme || null,
      difficulty: foundItem.difficulty || "MEDIUM",
      questionCount: foundItem.questionCount || (parsedContent.questions ? parsedContent.questions.length : 5),
      gameFormat: foundItem.gameFormat || parsedContent.gameFormat || "MULTIPLE_CHOICE",
      accessCode: foundItem.accessCode,
      publishedAt: foundItem.publishedAt,
      content: {
        title: parsedContent.title || foundItem.title,
        description: parsedContent.description || "",
        contentType: parsedContent.contentType || foundItem.contentType,
        gameFormat: parsedContent.gameFormat || foundItem.gameFormat,
        difficulty: parsedContent.difficulty || foundItem.difficulty,
        questions: (parsedContent.questions || []).map((q, idx) => {
          // Provide randomized right options for matching to avoid network answer leaks
          let matchingPairs = null;
          let matchingLeft = null;
          let matchingRight = null;

          if (q.matchingPairs && Array.isArray(q.matchingPairs)) {
            matchingLeft = q.matchingPairs.map((p) => p.left);
            const rights = q.matchingPairs.map((p) => p.right);
            // Reverse or permute right side so client cannot inspect index 1:1
            matchingRight = [...rights].reverse();
            matchingPairs = q.matchingPairs.map((p, i) => ({
              left: p.left,
              right: matchingRight[i] || "",
            }));
          }

          // Scrub sequence order from ordering items so initial delivery does not leak answer
          let sanitizedItems = null;
          if (q.items && Array.isArray(q.items)) {
            sanitizedItems = [...q.items].map((it) => ({ id: it.id, text: it.text })).reverse();
          }

          return {
            id: q.id || `q_${idx + 1}`,
            type: q.type || "MULTIPLE_CHOICE",
            questionText: q.questionText || q.front || "",
            options: q.options || null,
            matchingPairs,
            matchingLeft,
            matchingRight,
            front: q.front || null,
            // back: scrubbed
            items: sanitizedItems,
            // correctOrder: scrubbed
            timeLimitSeconds: q.timeLimitSeconds || (q.type === "TIMED_BLITZ" ? 20 : null),
            // Note: correctAnswer, back, correctOrder, and explanation are strictly scrubbed
          };
        }),
      },
    };
  }
}

/**
 * Checks a student's submitted answer against published content.
 */
async function checkStudentAnswer(prisma, { rawCode, questionId, studentAnswer }) {
  const normalized = normalizeAccessCode(rawCode);
  if (!isValidAccessCodeFormat(normalized)) {
    const err = new Error("Invalid access code.");
    err.statusCode = 400;
    throw err;
  }

  let foundItem = null;
  let itemType = null;

  if (prisma) {
    try {
      if (prisma.lessonDraft) {
        const lesson = await prisma.lessonDraft.findFirst({
          where: { accessCode: normalized, status: "PUBLISHED" },
        });
        if (lesson) {
          foundItem = lesson;
          itemType = "LESSON";
        }
      }
      if (!foundItem && prisma.assessmentDraft) {
        const asmt = await prisma.assessmentDraft.findFirst({
          where: { accessCode: normalized, status: "PUBLISHED" },
        });
        if (asmt) {
          foundItem = asmt;
          itemType = "ASSESSMENT";
        }
      }
    } catch {}
  }

  if (!foundItem && isEphemeralAllowed()) {
    const { inMemoryDrafts } = require("../routes/teacher-lessons");
    for (const l of inMemoryDrafts.values()) {
      if (l.accessCode === normalized && l.status === "PUBLISHED") {
        foundItem = l;
        itemType = "LESSON";
        break;
      }
    }
    if (!foundItem) {
      const { inMemoryAssessments } = require("../routes/teacher-assessments");
      for (const a of inMemoryAssessments.values()) {
        if (a.accessCode === normalized && a.status === "PUBLISHED") {
          foundItem = a;
          itemType = "ASSESSMENT";
          break;
        }
      }
    }
  }

  if (!foundItem) {
    const err = new Error("Published content not found.");
    err.statusCode = 404;
    throw err;
  }

  let parsedContent = foundItem.content;
  if (typeof parsedContent === "string") {
    try {
      parsedContent = JSON.parse(parsedContent);
    } catch {}
  }

  if (itemType === "LESSON") {
    const questions = parsedContent.reviewQuestions || [];
    const qIndex = typeof questionId === "string" && questionId.startsWith("rq_")
      ? parseInt(questionId.slice(3), 10) - 1
      : parseInt(questionId, 10);
    const question = questions[qIndex];
    if (!question) {
      const err = new Error("Question not found.");
      err.statusCode = 404;
      throw err;
    }

    const isCorrect =
      String(studentAnswer || "").trim().toLowerCase() ===
      String(question.answer || "").trim().toLowerCase();

    return {
      success: true,
      questionId,
      isCorrect,
      correctAnswer: question.answer,
      explanation: question.explanation || "Review the step-by-step explanations above.",
    };
  } else {
    // Assessment question check
    const questions = parsedContent.questions || [];
    const question = questions.find((q, idx) => q.id === questionId || `q_${idx + 1}` === questionId);
    if (!question) {
      const err = new Error("Question not found.");
      err.statusCode = 404;
      throw err;
    }

    let isCorrect = false;
    if (question.type === "TRUE_FALSE") {
      isCorrect = Boolean(studentAnswer) === Boolean(question.correctAnswer);
    } else if (
      question.type === "MULTIPLE_CHOICE" ||
      question.type === "FILL_BLANK" ||
      question.type === "TIMED_BLITZ"
    ) {
      isCorrect =
        String(studentAnswer || "").trim().toLowerCase() ===
        String(question.correctAnswer || "").trim().toLowerCase();
    } else if (question.type === "FLASHCARD") {
      isCorrect =
        studentAnswer === true ||
        String(studentAnswer || "").trim().toLowerCase() ===
        String(question.back || question.correctAnswer || "").trim().toLowerCase();
    } else if (question.type === "ORDERING") {
      const expected = question.correctOrder || question.correctAnswer;
      if (Array.isArray(studentAnswer) && Array.isArray(expected)) {
        isCorrect =
          studentAnswer.length === expected.length &&
          studentAnswer.every((id, idx) => id === expected[idx]);
      }
    } else if (question.type === "MATCHING") {
      if (typeof studentAnswer === "object" && typeof question.correctAnswer === "object") {
        const expected = question.correctAnswer;
        isCorrect = Object.keys(expected).every((k) => studentAnswer[k] === expected[k]);
      }
    }

    const revealedAnswer =
      question.correctAnswer !== undefined
        ? question.correctAnswer
        : question.back !== undefined
        ? question.back
        : question.correctOrder !== undefined
        ? question.correctOrder
        : null;

    return {
      success: true,
      questionId: question.id,
      isCorrect,
      correctAnswer: revealedAnswer,
      explanation: question.explanation || "Source-grounded concept review.",
      sourceReference: question.sourceReference || null,
    };
  }
}

module.exports = {
  publishTeacherContent,
  unpublishTeacherContent,
  getTeacherPublishedContent,
  getStudentContentByAccessCode,
  checkStudentAnswer,
  findPublishedContentByAccessCode,
  startStudentAssessmentSession,
  submitStudentAssessment,
  inMemoryAccessCodes,
  inMemoryAssessmentSessions,
};
