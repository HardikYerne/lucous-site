/**
 * Publishing Validator for LUCOUS Phase 3.4
 * 
 * Verifies that a lesson draft or assessment draft is complete, valid, and pedagogical
 * before permitting publication and unique access code generation.
 */

function validateLessonForPublishing(draft) {
  const errors = [];

  if (!draft) {
    return { valid: false, errors: ["Lesson draft does not exist."] };
  }

  if (!draft.title || typeof draft.title !== "string" || draft.title.trim().length < 3) {
    errors.push("Lesson title must be at least 3 characters long.");
  }

  if (!draft.subject || typeof draft.subject !== "string" || draft.subject.trim().length < 2) {
    errors.push("Lesson subject is required.");
  }

  let content = draft.content;
  if (typeof content === "string") {
    try {
      content = JSON.parse(content);
    } catch {
      errors.push("Lesson content contains invalid JSON data.");
      return { valid: false, errors };
    }
  }

  if (!content || typeof content !== "object") {
    errors.push("Lesson content object is missing or invalid.");
    return { valid: false, errors };
  }

  // Validate learning objectives
  if (!Array.isArray(content.learningObjectives) || content.learningObjectives.length === 0) {
    errors.push("Lesson must contain at least one learning objective.");
  } else {
    const validObjs = content.learningObjectives.filter(
      (obj) => typeof obj === "string" && obj.trim().length > 3
    );
    if (validObjs.length === 0) {
      errors.push("Learning objectives must be descriptive (at least 4 characters).");
    }
  }

  // Validate explanation steps
  const explanationSteps = content.explanationSteps || content.stepByStepExplanation;
  if (!Array.isArray(explanationSteps) || explanationSteps.length === 0) {
    errors.push("Lesson must contain at least one step-by-step conceptual explanation.");
  } else {
    explanationSteps.forEach((step, idx) => {
      if (!step.heading || typeof step.heading !== "string" || step.heading.trim().length < 2) {
        errors.push(`Explanation step #${idx + 1} is missing a clear heading.`);
      }
      if (!step.explanation || typeof step.explanation !== "string" || step.explanation.trim().length < 10) {
        errors.push(`Explanation step #${idx + 1} explanation must be at least 10 characters.`);
      }
    });
  }

  // Validate review questions
  if (!Array.isArray(content.reviewQuestions) || content.reviewQuestions.length === 0) {
    errors.push("Lesson must contain at least one review question for student practice.");
  } else {
    content.reviewQuestions.forEach((q, idx) => {
      if (!q.question || typeof q.question !== "string" || q.question.trim().length < 5) {
        errors.push(`Review question #${idx + 1} must be at least 5 characters.`);
      }
      if (!q.answer || typeof q.answer !== "string" || q.answer.trim().length < 1) {
        errors.push(`Review question #${idx + 1} must have a valid answer.`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function validateAssessmentForPublishing(draft) {
  const errors = [];

  if (!draft) {
    return { valid: false, errors: ["Assessment draft does not exist."] };
  }

  if (!draft.title || typeof draft.title !== "string" || draft.title.trim().length < 3) {
    errors.push("Assessment title must be at least 3 characters long.");
  }

  if (!draft.subject || typeof draft.subject !== "string" || draft.subject.trim().length < 2) {
    errors.push("Assessment subject is required.");
  }

  let content = draft.content;
  if (typeof content === "string") {
    try {
      content = JSON.parse(content);
    } catch {
      errors.push("Assessment content contains invalid JSON data.");
      return { valid: false, errors };
    }
  }

  if (!content || typeof content !== "object") {
    errors.push("Assessment content object is missing or invalid.");
    return { valid: false, errors };
  }

  if (!Array.isArray(content.questions) || content.questions.length === 0) {
    errors.push("Assessment must contain at least one question.");
  } else {
    content.questions.forEach((q, idx) => {
      const qText = q.questionText || q.front;
      if (!qText || typeof qText !== "string" || qText.trim().length < 3) {
        errors.push(`Question #${idx + 1} must have a valid question text.`);
      }

      const hasAnswer =
        (q.correctAnswer !== undefined && q.correctAnswer !== null && q.correctAnswer !== "") ||
        (q.back !== undefined && q.back !== null && String(q.back).trim() !== "") ||
        (Array.isArray(q.correctOrder) && q.correctOrder.length > 0) ||
        (q.matchingPairs && Array.isArray(q.matchingPairs) && q.matchingPairs.length > 0);

      if (!hasAnswer) {
        errors.push(`Question #${idx + 1} must have a specified correct answer.`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

module.exports = {
  validateLessonForPublishing,
  validateAssessmentForPublishing,
};
