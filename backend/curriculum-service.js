// Curriculum service providing in-memory resolution for development and fallback
// Mirrors Prisma schema models Board, Grade, Subject, Chapter, Topic, LearningContent, Question.

const {
  CURRICULUM_DATA,
  ALL_SCHOOL_BOARDS,
  ALL_TECHNICAL_BOARDS,
  ALL_SCHOOL_CLASSES,
  ALL_DIPLOMA_YEARS,
  DIPLOMA_BRANCHES,
  DIPLOMA_SEMESTERS_BY_YEAR,
} = require("./curriculum-data");

// In-memory indexed structures built deterministically from CURRICULUM_DATA & catalogues
let indexed = false;
const boardsMap = new Map();
const gradesMap = new Map();
const subjectsMap = new Map();
const chaptersMap = new Map();
const topicsMap = new Map();
const contentsMap = new Map();
const questionsMap = new Map();

function buildIndexes() {
  if (indexed) return;

  // 1. Seed School Boards
  for (const sb of ALL_SCHOOL_BOARDS) {
    boardsMap.set(sb.id, {
      id: sb.id,
      name: sb.name,
      fullName: sb.fullName,
      state: sb.state,
      type: "school",
      hasCurriculumCoverage: sb.hasCurriculumCoverage,
    });
  }

  // 2. Seed Technical Boards
  for (const tb of ALL_TECHNICAL_BOARDS) {
    boardsMap.set(tb.id, {
      id: tb.id,
      name: tb.name,
      fullName: tb.fullName,
      state: tb.state,
      type: "diploma",
      hasCurriculumCoverage: tb.hasCurriculumCoverage,
    });
  }

  // 3. Seed School Classes (Class 1 to Class 12)
  for (let i = 1; i <= 12; i++) {
    const name = `Class ${i}`;
    const id = `grade_class_${i}`;
    gradesMap.set(id, { id, name, type: "school" });
  }

  // 4. Seed Diploma Years & legacy Diploma grade
  const legacyDiplomaGrade = { id: "grade_diploma", name: "Diploma", type: "diploma" };
  gradesMap.set(legacyDiplomaGrade.id, legacyDiplomaGrade);

  ALL_DIPLOMA_YEARS.forEach((yr, idx) => {
    const id = `grade_diploma_yr${idx + 1}`;
    gradesMap.set(id, { id, name: yr, type: "diploma" });
  });

  let subjectCounter = 1;
  let chapterCounter = 1;
  let topicCounter = 1;
  let contentCounter = 1;
  let questionCounter = 1;

  for (const entry of CURRICULUM_DATA) {
    // 1. Match or create Board
    let board = Array.from(boardsMap.values()).find((b) => b.name === entry.board);
    if (!board) {
      board = {
        id: `board_${entry.board.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
        name: entry.board,
        type: entry.board.includes("Diploma") || entry.board === "MSBTE" ? "diploma" : "school",
        hasCurriculumCoverage: true,
      };
      boardsMap.set(board.id, board);
    } else {
      board.hasCurriculumCoverage = true;
    }

    // 2. Match or create Grade
    let grade = Array.from(gradesMap.values()).find((g) => g.name === entry.grade);
    if (!grade) {
      grade = {
        id: `grade_${entry.grade.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
        name: entry.grade,
        type: board.type,
      };
      gradesMap.set(grade.id, grade);
    }

    // 3. Subject
    let subject = Array.from(subjectsMap.values()).find(
      (s) =>
        s.boardId === board.id &&
        s.gradeId === grade.id &&
        s.name === entry.subject &&
        (entry.branch ? s.branch === entry.branch : true) &&
        (entry.semester ? s.semester === entry.semester : true)
    );
    if (!subject) {
      subject = {
        id: `subj_${subjectCounter++}`,
        name: entry.subject,
        boardId: board.id,
        gradeId: grade.id,
        branch: entry.branch || null,
        semester: entry.semester || null,
        board: { name: board.name },
        grade: { name: grade.name },
        _count: { chapters: entry.chapters.length },
      };
      subjectsMap.set(subject.id, subject);
    }

    // 4. Chapters
    for (const ch of entry.chapters) {
      let chapter = Array.from(chaptersMap.values()).find(
        (c) => c.subjectId === subject.id && c.name === ch.name
      );
      if (!chapter) {
        chapter = {
          id: `chap_${chapterCounter++}`,
          name: ch.name,
          subjectId: subject.id,
          _count: { topics: ch.topics.length },
        };
        chaptersMap.set(chapter.id, chapter);
      }

      // 5. Topics
      for (const top of ch.topics) {
        let topic = Array.from(topicsMap.values()).find(
          (t) => t.chapterId === chapter.id && t.name === top.name
        );
        if (!topic) {
          topic = {
            id: `top_${topicCounter++}`,
            name: top.name,
            chapterId: chapter.id,
            _count: {
              contents: (top.contents || []).length,
              questions: (top.questions || []).length,
            },
          };
          topicsMap.set(topic.id, topic);
        }

        // Contents
        if (Array.isArray(top.contents)) {
          for (const c of top.contents) {
            const content = {
              id: `cnt_${contentCounter++}`,
              topicId: topic.id,
              title: c.title,
              body: c.body,
              order: c.order || 1,
            };
            contentsMap.set(content.id, content);
          }
        }

        // Questions
        if (Array.isArray(top.questions)) {
          for (const q of top.questions) {
            const question = {
              id: `q_${questionCounter++}`,
              topicId: topic.id,
              text: q.text,
              optionA: q.optionA,
              optionB: q.optionB,
              optionC: q.optionC,
              optionD: q.optionD,
              correct: q.correct,
              explanation: q.explanation || null,
              difficulty: q.difficulty || "MEDIUM",
            };
            questionsMap.set(question.id, question);
          }
        }
      }
    }
  }

  indexed = true;
}

function getFallbackBoards(filter) {
  buildIndexes();
  const type = typeof filter === "string" ? filter : filter?.type;
  const list = Array.from(boardsMap.values());
  if (type) {
    return list.filter((b) => b.type === type);
  }
  return list;
}

function getFallbackClasses(boardId, filter) {
  buildIndexes();
  const type = typeof filter === "string" ? filter : filter?.type;

  if (boardId) {
    const board = boardsMap.get(String(boardId)) || Array.from(boardsMap.values()).find((b) => b.id === boardId || b.name === boardId);
    if (board && board.type === "diploma") {
      // Legacy Diploma / Polytechnic board test expects "Diploma" grade
      if (board.name === "Diploma / Polytechnic") {
        return [
          gradesMap.get("grade_diploma"),
          gradesMap.get("grade_diploma_yr1"),
          gradesMap.get("grade_diploma_yr2"),
          gradesMap.get("grade_diploma_yr3"),
        ].filter(Boolean);
      }
      return [
        gradesMap.get("grade_diploma_yr1"),
        gradesMap.get("grade_diploma_yr2"),
        gradesMap.get("grade_diploma_yr3"),
      ].filter(Boolean);
    }
    // For school boards, return Class 1 through Class 12
    return Array.from(gradesMap.values()).filter((g) => g.type === "school");
  }

  if (type === "diploma") {
    return Array.from(gradesMap.values()).filter((g) => g.type === "diploma");
  }
  if (type === "school") {
    return Array.from(gradesMap.values()).filter((g) => g.type === "school");
  }

  return Array.from(gradesMap.values());
}

function getFallbackSubjects(boardId, gradeId, branch, semester) {
  buildIndexes();
  return Array.from(subjectsMap.values()).filter((s) => {
    if (boardId && s.boardId !== boardId) return false;
    if (gradeId && s.gradeId !== gradeId) return false;
    if (branch && s.branch && s.branch !== branch) return false;
    if (semester && s.semester && s.semester !== semester) return false;
    return true;
  });
}

function getFallbackChapters(subjectId) {
  buildIndexes();
  return Array.from(chaptersMap.values()).filter((c) => c.subjectId === subjectId);
}

function getFallbackTopics(chapterId) {
  buildIndexes();
  return Array.from(topicsMap.values()).filter((t) => t.chapterId === chapterId);
}

function getFallbackTopicById(topicId) {
  buildIndexes();
  return topicsMap.get(String(topicId)) || null;
}

function getFallbackContent(topicId) {
  buildIndexes();
  return Array.from(contentsMap.values())
    .filter((c) => c.topicId === String(topicId))
    .sort((a, b) => a.order - b.order);
}

function getFallbackQuestions(topicId, limit = 10) {
  buildIndexes();
  const all = Array.from(questionsMap.values()).filter(
    (q) => q.topicId === String(topicId)
  );
  return all.slice(0, limit);
}

function getFallbackQuestionById(questionId) {
  buildIndexes();
  return questionsMap.get(String(questionId)) || null;
}

function getFallbackDiplomaMeta() {
  buildIndexes();
  return {
    boards: ALL_TECHNICAL_BOARDS,
    years: ALL_DIPLOMA_YEARS,
    branches: DIPLOMA_BRANCHES,
    semestersByYear: DIPLOMA_SEMESTERS_BY_YEAR,
  };
}

function validateCurriculumSelection(sel) {
  buildIndexes();
  if (!sel || typeof sel !== "object") {
    return { valid: false, message: "Selection payload must be an object" };
  }

  const { educationType, boardId, gradeId, branch, semester, subjectId, chapterId, topicId } = sel;

  if (educationType && !["school", "diploma"].includes(educationType)) {
    return { valid: false, message: "Invalid educationType. Must be 'school' or 'diploma'." };
  }

  if (!boardId) return { valid: false, message: "boardId is required" };
  const board = boardsMap.get(String(boardId));
  if (!board) return { valid: false, message: `Board with ID '${boardId}' not found.` };

  if (!gradeId) return { valid: false, message: "gradeId is required" };
  const grade = gradesMap.get(String(gradeId));
  if (!grade) return { valid: false, message: `Class/Grade with ID '${gradeId}' not found.` };

  // Validate diploma-specific constraints
  if (educationType === "diploma" || board.type === "diploma") {
    if (branch && !DIPLOMA_BRANCHES.includes(branch)) {
      return { valid: false, message: `Branch '${branch}' is not a recognized diploma branch.` };
    }
    if (semester) {
      const allowedSemesters = DIPLOMA_SEMESTERS_BY_YEAR[grade.name] || [];
      if (allowedSemesters.length > 0 && !allowedSemesters.includes(semester)) {
        return {
          valid: false,
          message: `Semester '${semester}' is not valid for ${grade.name}. Valid: ${allowedSemesters.join(", ")}`,
        };
      }
    }
  }

  if (!subjectId) return { valid: false, message: "subjectId is required" };
  const subject = subjectsMap.get(String(subjectId));
  if (!subject) return { valid: false, message: `Subject with ID '${subjectId}' not found.` };
  if (subject.boardId !== board.id) {
    return { valid: false, message: `Subject does not belong to selected board.` };
  }
  if (subject.gradeId !== grade.id) {
    return { valid: false, message: `Subject does not belong to selected grade.` };
  }

  if (!chapterId) return { valid: false, message: "chapterId is required" };
  const chapter = chaptersMap.get(String(chapterId));
  if (!chapter) return { valid: false, message: `Chapter with ID '${chapterId}' not found.` };
  if (chapter.subjectId !== subject.id) {
    return { valid: false, message: `Chapter does not belong to selected subject.` };
  }

  if (!topicId) return { valid: false, message: "topicId is required" };
  const topic = topicsMap.get(String(topicId));
  if (!topic) return { valid: false, message: `Topic with ID '${topicId}' not found.` };
  if (topic.chapterId !== chapter.id) {
    return { valid: false, message: `Topic does not belong to selected chapter.` };
  }

  return {
    valid: true,
    selection: {
      educationType: educationType || board.type,
      board: { id: board.id, name: board.name, fullName: board.fullName, state: board.state },
      grade: { id: grade.id, name: grade.name },
      branch: branch || subject.branch || null,
      semester: semester || subject.semester || null,
      subject: { id: subject.id, name: subject.name },
      chapter: { id: chapter.id, name: chapter.name },
      topic: { id: topic.id, name: topic.name },
    },
  };
}

function getTopicGameData(topicId, gameId = "memory-match") {
  buildIndexes();
  const topic = getFallbackTopicById(topicId);
  const questions = getFallbackQuestions(topicId, 10);
  const contents = getFallbackContent(topicId);

  const topicName = topic?.name || "Curriculum Topic";

  // 1. Memory Match pairs (terms <-> definitions or questions <-> correct answers)
  const memoryPairs = [];
  if (questions.length >= 2) {
    for (let i = 0; i < Math.min(questions.length, 6); i++) {
      const q = questions[i];
      const optKeys = ["optionA", "optionB", "optionC", "optionD"];
      const correctText = q[optKeys[q.correct]] || q.optionA;
      let term = q.text
        .replace(/is:?$/i, "")
        .replace(/equals:?$/i, "")
        .replace(/means:?$/i, "")
        .replace(/\?$/, "")
        .trim();
      if (term.length > 50) term = term.slice(0, 47) + "…";
      memoryPairs.push({
        id: `pair_${i + 1}`,
        term,
        match: correctText,
      });
    }
  }

  // Fallback pairs from content if few questions exist
  if (memoryPairs.length < 3 && contents.length > 0 && contents[0].body) {
    const lines = contents[0].body.split("\n").filter((l) => l.includes(":") || l.includes("-") || l.includes("="));
    lines.slice(0, 4).forEach((line, idx) => {
      const parts = line.split(/[:=-]/);
      if (parts.length >= 2) {
        memoryPairs.push({
          id: `pair_cnt_${idx + 1}`,
          term: parts[0].replace(/^[-*•\s\d.]+/, "").trim().slice(0, 45),
          match: parts[1].trim().slice(0, 50),
        });
      }
    });
  }

  // Standard conceptual pairs if uncurated
  if (memoryPairs.length < 3) {
    memoryPairs.push(
      { id: "pair_std_1", term: `${topicName} (Definition)`, match: "Core academic concept and principle" },
      { id: "pair_std_2", term: "Mathematical / Conceptual Proof", match: "Logical derivation from fundamental axioms" },
      { id: "pair_std_3", term: "Real-World Application", match: "Practical calculation and engineering design" },
      { id: "pair_std_4", term: "Problem Solving Method", match: "Systematic step-by-step resolution" }
    );
  }

  // 2. Ordering Challenge puzzle steps
  let orderingSteps = [];
  const topicLower = topicName.toLowerCase();
  if (topicLower.includes("euclid") || topicLower.includes("division lemma")) {
    orderingSteps = [
      { id: "step_1", text: "Take two given positive integers a and b (where a > b)", order: 1 },
      { id: "step_2", text: "Apply division lemma: a = bq + r, with 0 ≤ r < b", order: 2 },
      { id: "step_3", text: "If remainder r ≠ 0, repeat division with divisor b and remainder r", order: 3 },
      { id: "step_4", text: "When remainder becomes zero, the last divisor is the HCF", order: 4 },
    ];
  } else if (topicLower.includes("quadratic") || topicLower.includes("roots")) {
    orderingSteps = [
      { id: "step_1", text: "Write equation in standard quadratic form: ax² + bx + c = 0", order: 1 },
      { id: "step_2", text: "Identify coefficients a, b, and constant term c", order: 2 },
      { id: "step_3", text: "Calculate discriminant: D = b² - 4ac", order: 3 },
      { id: "step_4", text: "Compute roots using quadratic formula: x = (-b ± √D) / 2a", order: 4 },
    ];
  } else if (topicLower.includes("logarithm")) {
    orderingSteps = [
      { id: "step_1", text: "Identify exponential relationship: b^y = x (b > 0, b ≠ 1)", order: 1 },
      { id: "step_2", text: "Express in logarithmic notation: y = log_b(x)", order: 2 },
      { id: "step_3", text: "Apply logarithmic laws: product, quotient, or power rule", order: 3 },
      { id: "step_4", text: "Simplify terms to compute final value", order: 4 },
    ];
  } else if (topicLower.includes("c") || topicLower.includes("program") || topicLower.includes("data struct")) {
    orderingSteps = [
      { id: "step_1", text: "Include required header files (e.g. #include <stdio.h>)", order: 1 },
      { id: "step_2", text: "Declare variable types and allocate data structures", order: 2 },
      { id: "step_3", text: "Read input data and implement conditional/loop logic", order: 3 },
      { id: "step_4", text: "Output computed result to console and return 0", order: 4 },
    ];
  } else {
    orderingSteps = [
      { id: "step_1", text: "State the problem definition and identify known parameters", order: 1 },
      { id: "step_2", text: "Select the appropriate theorem, formula, or law", order: 2 },
      { id: "step_3", text: "Substitute values and perform step-by-step deduction", order: 3 },
      { id: "step_4", text: "Verify remainder, boundary conditions, or final units", order: 4 },
    ];
  }

  // 3. Timed Quiz questions (without correct index exposed to client)
  const clientQuestions = questions.map((q) => ({
    id: q.id,
    text: q.text,
    optionA: q.optionA,
    optionB: q.optionB,
    optionC: q.optionC,
    optionD: q.optionD,
  }));

  return {
    topicId,
    topicName,
    memoryPairs: memoryPairs.slice(0, 6),
    orderingPuzzle: {
      title: `Logical Procedure: ${topicName}`,
      steps: orderingSteps,
    },
    timedQuestions: clientQuestions,
  };
}

module.exports = {
  getFallbackBoards,
  getFallbackClasses,
  getFallbackSubjects,
  getFallbackChapters,
  getFallbackTopics,
  getFallbackTopicById,
  getFallbackContent,
  getFallbackQuestions,
  getFallbackQuestionById,
  getFallbackDiplomaMeta,
  validateCurriculumSelection,
  getTopicGameData,
};

