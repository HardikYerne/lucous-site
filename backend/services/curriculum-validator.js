/**
 * Curriculum metadata validation service for LUCOUS
 * Reuses official Phase 2 curriculum metadata definitions from curated-videos.js.
 */

const {
  EDUCATION_LEVELS,
  BOARDS,
  DIPLOMA_BRANCHES,
  DIPLOMA_SCHEMES,
  SCHOOL_SUBJECTS_BY_LEVEL,
  DIPLOMA_SUBJECTS_BY_BRANCH_AND_SEM,
} = require("../curated-videos");

const VALID_LANGUAGES = ["en", "hi", "mr", "te"];

const BRANCH_CODE_MAP = {
  co: "computer",
  computer: "computer",
  it: "it",
  me: "mechanical",
  mechanical: "mechanical",
  ce: "civil",
  civil: "civil",
  ee: "electrical",
  electrical: "electrical",
  ej: "electronics",
  entc: "electronics",
  electronics: "electronics",
  aiml: "other",
  other: "other",
};

const BOARD_CODE_MAP = {
  cbse: "cbse",
  icse: "icse",
  maharashtra: "maharashtra",
  msbshse: "maharashtra",
  telangana: "telangana",
  andhra_pradesh: "andhra_pradesh",
  ap: "andhra_pradesh",
  state: "other",
  other: "other",
  general: "general",
  all: "all",
};

/**
 * Validates and normalizes teacher-supplied curriculum metadata.
 * Returns { isValid: true, data: { ... } } or { isValid: false, error: "..." }
 */
function validateCurriculumMetadata(input = {}) {
  const {
    educationLevel,
    classGrade,
    board,
    stream,
    branch,
    scheme,
    semester,
    subjectName,
    chapterName,
    topicName,
    topicId,
    language = "en",
    description = "",
  } = input;

  // 1. Education Level
  if (!educationLevel || typeof educationLevel !== "string") {
    return {
      isValid: false,
      valid: false,
      error: "educationLevel is required (school or diploma).",
    };
  }

  let normLevel = educationLevel.toLowerCase().trim();
  if (normLevel === "polytechnic") {
    normLevel = "diploma";
  }

  const validLevelIds = [...EDUCATION_LEVELS.map((l) => l.id), "school"];
  if (!validLevelIds.includes(normLevel)) {
    return {
      isValid: false,
      valid: false,
      error: `educationLevel must be 'school', 'diploma' or one of: ${validLevelIds.join(", ")}.`,
    };
  }

  const isDiploma = normLevel === "diploma";
  let normClass = null;
  let normBoard = null;
  let normStream = null;
  let normBranch = null;
  let normScheme = null;
  let normSemester = null;

  // 2. School-specific validation
  if (!isDiploma) {
    if (!classGrade) {
      return { isValid: false, valid: false, error: "Class grade is required for school education level." };
    }
    normClass = String(classGrade).trim();
    const classNum = parseInt(normClass, 10);
    if (isNaN(classNum) || classNum < 1 || classNum > 12) {
      return { isValid: false, valid: false, error: "School class grade must be between 1 and 12." };
    }

    // Resolve fine-grained school sub-level if given high-level "school"
    if (normLevel === "school") {
      if (classNum <= 5) normLevel = "primary";
      else if (classNum <= 8) normLevel = "middle";
      else if (classNum <= 10) normLevel = "secondary";
      else normLevel = "higher_secondary";
    }

    // Verify class matches level if granular level was explicitly passed
    if (normLevel === "primary" && (classNum < 1 || classNum > 5)) {
      return { isValid: false, valid: false, error: "Primary level covers Classes 1 to 5." };
    }
    if (normLevel === "middle" && (classNum < 6 || classNum > 8)) {
      return { isValid: false, valid: false, error: "Middle School level covers Classes 6 to 8." };
    }
    if (normLevel === "secondary" && (classNum < 9 || classNum > 10)) {
      return { isValid: false, valid: false, error: "Secondary level covers Classes 9 and 10." };
    }
    if (normLevel === "higher_secondary" && (classNum < 11 || classNum > 12)) {
      return { isValid: false, valid: false, error: "Higher Secondary level covers Classes 11 and 12." };
    }

    // Board validation
    if (board) {
      const rawBoard = String(board).toLowerCase().trim();
      normBoard = BOARD_CODE_MAP[rawBoard] || rawBoard;
      const validBoards = BOARDS.map((b) => b.id);
      if (!validBoards.includes(normBoard) && normBoard !== "general" && normBoard !== "all") {
        return {
          isValid: false,
          valid: false,
          error: `Invalid board '${board}'. Allowed boards: ${validBoards.join(", ")}.`,
        };
      }
    }

    // Higher Secondary stream validation
    if (normLevel === "higher_secondary" && stream) {
      normStream = String(stream).toLowerCase().trim();
      const validStreams = ["science", "commerce", "arts", "general"];
      if (!validStreams.includes(normStream)) {
        return {
          isValid: false,
          valid: false,
          error: `Invalid stream '${stream}'. Allowed streams: ${validStreams.join(", ")}.`,
        };
      }
    }
  } else {
    // 3. Diploma-specific validation
    if (branch) {
      const rawBranch = String(branch).toLowerCase().trim();
      normBranch = BRANCH_CODE_MAP[rawBranch] || rawBranch;
      const validBranches = DIPLOMA_BRANCHES.map((b) => b.id);
      if (!validBranches.includes(normBranch)) {
        return {
          isValid: false,
          valid: false,
          error: `Invalid diploma branch '${branch}'. Allowed: ${validBranches.join(", ")}.`,
        };
      }
    }

    if (scheme) {
      normScheme = String(scheme).toLowerCase().trim();
      const validSchemes = DIPLOMA_SCHEMES.map((s) => s.id);
      if (!validSchemes.includes(normScheme) && !["k_scheme", "i_scheme", "aicte", "autonomous"].includes(normScheme)) {
        return {
          isValid: false,
          valid: false,
          error: `Invalid diploma scheme '${scheme}'. Allowed: ${validSchemes.join(", ")}.`,
        };
      }
    }

    if (semester !== undefined && semester !== null && String(semester).trim() !== "") {
      const semNum = parseInt(semester, 10);
      if (isNaN(semNum) || semNum < 1 || semNum > 8) {
        return {
          isValid: false,
          valid: false,
          error: "Diploma semester must be an integer between 1 and 8.",
        };
      }
      normSemester = semNum;
    }
  }


  // 4. Subject validation
  if (!subjectName || typeof subjectName !== "string" || !subjectName.trim()) {
    return {
      isValid: false,
      valid: false,
      error: "subjectName is required.",
    };
  }

  const cleanSubject = subjectName.trim().slice(0, 100);
  const cleanChapter = chapterName ? String(chapterName).trim().slice(0, 150) : null;
  const cleanTopic = topicName ? String(topicName).trim().slice(0, 150) : null;

  // 5. Language validation
  const normLang = String(language || "en").toLowerCase().trim();
  if (!VALID_LANGUAGES.includes(normLang)) {
    return {
      isValid: false,
      valid: false,
      error: `Invalid language '${language}'. Supported languages: ${VALID_LANGUAGES.join(", ")}.`,
    };
  }

  // 6. Optional Description and Topic ID
  const cleanDescription = description ? String(description).trim().slice(0, 1000) : null;
  const cleanTopicId = topicId ? String(topicId).trim().slice(0, 100) : null;

  const data = {
    educationLevel: normLevel,
    classGrade: normClass,
    board: normBoard,
    stream: normStream,
    branch: normBranch,
    scheme: normScheme,
    semester: normSemester,
    subjectName: cleanSubject,
    chapterName: cleanChapter,
    topicName: cleanTopic,
    topicId: cleanTopicId,
    language: normLang,
    description: cleanDescription,
  };

  return {
    isValid: true,
    valid: true,
    data,
    metadata: data,
  };
}

module.exports = {
  VALID_LANGUAGES,
  validateCurriculumMetadata,
  validateCurriculum: validateCurriculumMetadata,
};
