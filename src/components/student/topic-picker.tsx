"use client";

import * as React from "react";
import {
  Loader2,
  BookOpen,
  AlertCircle,
  Sparkles,
  School,
  GraduationCap,
  Info,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getReferenceChapters, getReferenceTopics } from "@/components/student/curriculum-reference";
import {
  apiFetch,
  fetchDiplomaMeta,
  type Board,
  type Chapter,
  type Grade,
  type Subject,
  type Topic,
  type CurriculumSelection,
  type EducationType,
  type DiplomaMeta,
} from "@/lib/api";

const selectClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60";

function msg(e: unknown): string {
  return e instanceof Error ? e.message : "Failed to load curriculum data";
}

// Common subjects offered as suggestions (shown alongside subjects from the database).
const SCHOOL_SUBJECT_SUGGESTIONS = [
  "Mathematics",
  "Science",
  "Social Science",
  "English",
  "Hindi",
  "Marathi",
  "Physics",
  "Chemistry",
  "Biology",
  "History",
  "Geography",
  "Civics",
  "Economics",
  "Computer Science",
  "Environmental Studies",
];
const DIPLOMA_SUBJECT_SUGGESTIONS = [
  "Engineering Mathematics",
  "Engineering Physics",
  "Engineering Chemistry",
  "Communication Skills",
  "Basic Electrical Engineering",
  "Programming in C",
  "Data Structures",
  "Database Management System",
  "Operating System",
  "Computer Networks",
];

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "item"
  );
}

// A learner-typed subject/chapter/topic has no database record, so give it a stand-in object.
function customEntity<T>(kind: string, name: string): T {
  return { id: `custom-${kind}-${slugify(name)}`, name, custom: true } as unknown as T;
}

interface ComboOption {
  key: string;
  label: string;
  hint?: string;
}

// Text box with a dropdown: pick one of the options, or type anything of your own.
function Combobox({
  id,
  ariaLabel,
  value,
  onChange,
  onPick,
  options,
  placeholder,
  disabled,
}: {
  id: string;
  ariaLabel: string;
  value: string;
  onChange: (text: string) => void;
  onPick: (option: ComboOption) => void;
  options: ComboOption[];
  placeholder: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(-1);
  const wrapRef = React.useRef<HTMLDivElement>(null);

  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  const exact = options.find((o) => o.label.toLowerCase() === lower);
  // Show everything when empty or when the text is already a full option; otherwise filter.
  const shown =
    !trimmed || exact ? options : options.filter((o) => o.label.toLowerCase().includes(lower));
  const showCustom = Boolean(trimmed) && !exact;
  const rowCount = shown.length + (showCustom ? 1 : 0);

  React.useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function choose(i: number) {
    if (i < shown.length) onPick(shown[i]);
    else onChange(trimmed);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      if (rowCount > 0) setActive((a) => (a + 1) % rowCount);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      if (rowCount > 0) setActive((a) => (a <= 0 ? rowCount - 1 : a - 1));
    } else if (e.key === "Enter") {
      if (open && active >= 0 && active < rowCount) {
        e.preventDefault();
        choose(active);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} className={open ? "relative z-40" : "relative"}>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
        className={selectClass}
        style={{ paddingRight: "2.25rem" }}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onKeyDown={onKeyDown}
      />
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      {open && !disabled && rowCount > 0 ? (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-input bg-popover p-1 shadow-lg"
        >
          {shown.map((o, i) => (
            <li
              key={o.key}
              role="option"
              aria-selected={exact?.key === o.key}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(i);
              }}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-md px-2.5 py-2 text-sm hover:bg-muted ${
                active === i ? "bg-muted" : ""
              } ${exact?.key === o.key ? "font-semibold text-primary" : ""}`}
            >
              <span className="truncate">{o.label}</span>
              {o.hint ? (
                <span className="shrink-0 text-xs font-normal text-muted-foreground">{o.hint}</span>
              ) : null}
            </li>
          ))}
          {showCustom ? (
            <li
              role="option"
              aria-selected={false}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(shown.length);
              }}
              className={`cursor-pointer rounded-md px-2.5 py-2 text-sm hover:bg-muted ${
                active === shown.length ? "bg-muted" : ""
              }`}
            >
              Use &ldquo;{trimmed}&rdquo;
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

export interface TopicPickerProps {
  onSelect?: (topic: Topic) => void;
  // Optional explicit start button (used by Test/Practice/Play/Retest). Also works for typed topics.
  onStart?: (topic: Topic) => void;
  startLabel?: string;
  onStartLearning?: (selection: CurriculumSelection) => void;
  initialSelection?: Partial<{
    educationType: EducationType;
    boardId: string | number;
    gradeId: string | number;
    branch?: string;
    semester?: string;
    subjectId: string | number;
    chapterId: string | number;
    topicId: string | number;
  }>;
  onSelectionChange?: (selection: {
    educationType: EducationType;
    boardId: string;
    gradeId: string;
    branch?: string;
    semester?: string;
    subjectId: string;
    chapterId: string;
    topicId: string;
  }) => void;
}

// Dependent Dropdown Cascades:
// School: Education Type -> State/Board -> Class (1-12) -> Subject -> Chapter -> Topic
// Diploma: Education Type -> Technical Board -> Year (1-3) -> Branch -> Semester -> Subject -> Unit/Chapter -> Topic
export function TopicPicker({
  onSelect,
  onStart,
  startLabel,
  onStartLearning,
  initialSelection,
  onSelectionChange,
}: TopicPickerProps) {
  // 1. Education Type State ("school" | "diploma")
  const [educationType, setEducationType] = React.useState<EducationType>(
    () => initialSelection?.educationType || "school"
  );

  // 2. Cascade Option Lists
  const [boards, setBoards] = React.useState<Board[]>([]);
  const [grades, setGrades] = React.useState<Grade[]>([]);
  const [branches, setBranches] = React.useState<string[]>([]);
  const [semesters, setSemesters] = React.useState<string[]>([]);
  const [subjects, setSubjects] = React.useState<Subject[]>([]);
  const [chapters, setChapters] = React.useState<Chapter[]>([]);
  const [topics, setTopics] = React.useState<Topic[]>([]);

  // 3. Selection Values
  const [boardId, setBoardId] = React.useState<string>(() =>
    initialSelection?.boardId ? String(initialSelection.boardId) : ""
  );
  const [gradeId, setGradeId] = React.useState<string>(() =>
    initialSelection?.gradeId ? String(initialSelection.gradeId) : ""
  );
  const [branch, setBranch] = React.useState<string>(() =>
    initialSelection?.branch ? String(initialSelection.branch) : ""
  );
  const [semester, setSemester] = React.useState<string>(() =>
    initialSelection?.semester ? String(initialSelection.semester) : ""
  );
  const [subjectId, setSubjectId] = React.useState<string>(() =>
    initialSelection?.subjectId ? String(initialSelection.subjectId) : ""
  );
  const [chapterId, setChapterId] = React.useState<string>(() =>
    initialSelection?.chapterId ? String(initialSelection.chapterId) : ""
  );
  const [topicId, setTopicId] = React.useState<string>(() =>
    initialSelection?.topicId ? String(initialSelection.topicId) : ""
  );

  // Text shown in the Subject / Chapter / Topic boxes (picked from a list or typed by the learner)
  const [subjectText, setSubjectText] = React.useState("");
  const [chapterText, setChapterText] = React.useState("");
  const [topicText, setTopicText] = React.useState("");

  // 4. Diploma Catalogue Metadata Cache
  const [diplomaMeta, setDiplomaMeta] = React.useState<DiplomaMeta | null>(null);

  // 5. Loading & Error States
  const [loadingBoards, setLoadingBoards] = React.useState(true);
  const [loadingGrades, setLoadingGrades] = React.useState(false);
  const [loadingSubjects, setLoadingSubjects] = React.useState(false);
  const [loadingChapters, setLoadingChapters] = React.useState(false);
  const [loadingTopics, setLoadingTopics] = React.useState(false);
  const [error, setError] = React.useState("");

  // Notify parent component of current selection values.
  // The callback is kept in a ref so a parent that passes a new function every render
  // cannot re-trigger this effect (that caused an endless update loop).
  const onSelectionChangeRef = React.useRef(onSelectionChange);
  React.useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  });
  React.useEffect(() => {
    onSelectionChangeRef.current?.({
      educationType,
      boardId,
      gradeId,
      branch: educationType === "diploma" ? branch : undefined,
      semester: educationType === "diploma" ? semester : undefined,
      subjectId,
      chapterId,
      topicId,
    });
  }, [educationType, boardId, gradeId, branch, semester, subjectId, chapterId, topicId]);

  // Load Diploma Metadata once if needed
  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const meta = await fetchDiplomaMeta();
        if (active) {
          setDiplomaMeta(meta);
          if (meta.branches && meta.branches.length > 0) {
            setBranches(meta.branches);
          }
        }
      } catch {
        // Fallback gracefully
        if (active) {
          setBranches([
            "Computer Engineering",
            "Information Technology",
            "Mechanical Engineering",
            "Civil Engineering",
            "Electrical Engineering",
            "Electronics & Telecommunication",
          ]);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Load Boards when educationType changes
  React.useEffect(() => {
    let active = true;
    (async () => {
      setLoadingBoards(true);
      setError("");
      try {
        const d = await apiFetch<{ boards: Board[] }>(
          `/student/boards?type=${encodeURIComponent(educationType)}`
        );
        if (active) {
          const list = d.boards || [];
          setBoards(list);
          // If previous boardId belongs to current list, keep it; else reset
          if (boardId && !list.some((b) => String(b.id) === boardId)) {
            setBoardId("");
          }
        }
      } catch (e) {
        if (active) setError(msg(e));
      } finally {
        if (active) setLoadingBoards(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [educationType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load Classes / Years when Board changes
  React.useEffect(() => {
    if (!boardId) {
      setGrades([]);
      return;
    }
    let active = true;
    (async () => {
      setLoadingGrades(true);
      try {
        const d = await apiFetch<{ classes: Grade[] }>(
          `/student/classes?boardId=${encodeURIComponent(boardId)}&type=${encodeURIComponent(educationType)}`
        );
        if (active) {
          const list = d.classes || [];
          setGrades(list);
          if (gradeId && !list.some((g) => String(g.id) === gradeId)) {
            setGradeId("");
          }
        }
      } catch (e) {
        if (active) setError(msg(e));
      } finally {
        if (active) setLoadingGrades(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [boardId, educationType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update available semesters when Diploma Year changes
  React.useEffect(() => {
    if (educationType !== "diploma" || !gradeId) {
      setSemesters([]);
      return;
    }
    const selectedGrade = grades.find((g) => String(g.id) === gradeId);
    const gradeName = selectedGrade?.name || "";

    if (diplomaMeta?.semestersByYear && diplomaMeta.semestersByYear[gradeName]) {
      const semList = diplomaMeta.semestersByYear[gradeName];
      setSemesters(semList);
      if (semester && !semList.includes(semester)) {
        setSemester("");
      }
    } else {
      // Default standard MSBTE semester mapping
      let semList: string[] = [];
      if (gradeName.includes("Year 1") || gradeName === "Diploma") {
        semList = ["Semester 1", "Semester 2"];
      } else if (gradeName.includes("Year 2")) {
        semList = ["Semester 3", "Semester 4"];
      } else if (gradeName.includes("Year 3")) {
        semList = ["Semester 5", "Semester 6"];
      }
      setSemesters(semList);
      if (semester && !semList.includes(semester)) {
        setSemester("");
      }
    }
  }, [educationType, gradeId, grades, diplomaMeta]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load Subjects when Class/Year (and Branch/Semester for Diploma) changes
  React.useEffect(() => {
    if (!boardId || !gradeId) {
      setSubjects([]);
      return;
    }
    // For diploma, wait until branch and semester are selected to narrow down subjects
    if (educationType === "diploma" && (!branch || !semester)) {
      setSubjects([]);
      return;
    }

    let active = true;
    (async () => {
      setLoadingSubjects(true);
      try {
        let url = `/student/subjects?boardId=${encodeURIComponent(boardId)}&gradeId=${encodeURIComponent(gradeId)}`;
        if (educationType === "diploma") {
          if (branch) url += `&branch=${encodeURIComponent(branch)}`;
          if (semester) url += `&semester=${encodeURIComponent(semester)}`;
        }
        const d = await apiFetch<{ subjects: Subject[] }>(url);
        if (active) {
          const list = d.subjects || [];
          setSubjects(list);
          if (subjectId && !list.some((s) => String(s.id) === subjectId)) {
            setSubjectId("");
          }
        }
      } catch (e) {
        if (active) setError(msg(e));
      } finally {
        if (active) setLoadingSubjects(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [boardId, gradeId, branch, semester, educationType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load Chapters when Subject changes
  React.useEffect(() => {
    if (!subjectId) {
      setChapters([]);
      return;
    }
    let active = true;
    (async () => {
      setLoadingChapters(true);
      try {
        const d = await apiFetch<{ chapters: Chapter[] }>(
          `/student/chapters?subjectId=${encodeURIComponent(subjectId)}`
        );
        if (active) {
          const list = d.chapters || [];
          setChapters(list);
          if (chapterId && !list.some((c) => String(c.id) === chapterId)) {
            setChapterId("");
          }
        }
      } catch (e) {
        if (active) setError(msg(e));
      } finally {
        if (active) setLoadingChapters(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [subjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load Topics when Chapter changes
  React.useEffect(() => {
    if (!chapterId) {
      setTopics([]);
      return;
    }
    let active = true;
    (async () => {
      setLoadingTopics(true);
      try {
        const d = await apiFetch<{ topics: Topic[] }>(
          `/student/topics?chapterId=${encodeURIComponent(chapterId)}`
        );
        if (active) {
          const list = d.topics || [];
          setTopics(list);
          if (topicId && !list.some((t) => String(t.id) === topicId)) {
            setTopicId("");
          }
        }
      } catch (e) {
        if (active) setError(msg(e));
      } finally {
        if (active) setLoadingTopics(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [chapterId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset Handlers for Downstream Selections
  function handleEducationTypeChange(newType: EducationType) {
    if (newType === educationType) return;
    setEducationType(newType);
    setBoardId("");
    setGradeId("");
    setBranch("");
    setSemester("");
    setSubjectId("");
    setChapterId("");
    setTopicId("");
    setSubjectText("");
    setChapterText("");
    setTopicText("");
    setGrades([]);
    setSemesters([]);
    setSubjects([]);
    setChapters([]);
    setTopics([]);
    setError("");
  }

  function handleBoardChange(value: string) {
    setBoardId(value);
    setGradeId("");
    setBranch("");
    setSemester("");
    setSubjectId("");
    setChapterId("");
    setTopicId("");
    setSubjectText("");
    setChapterText("");
    setTopicText("");
    setGrades([]);
    setSemesters([]);
    setSubjects([]);
    setChapters([]);
    setTopics([]);
    setError("");
  }

  function handleGradeChange(value: string) {
    setGradeId(value);
    setSemester("");
    setSubjectId("");
    setChapterId("");
    setTopicId("");
    setSubjectText("");
    setChapterText("");
    setTopicText("");
    setSubjects([]);
    setChapters([]);
    setTopics([]);
    setError("");
  }

  function handleBranchChange(value: string) {
    setBranch(value);
    setSubjectId("");
    setChapterId("");
    setTopicId("");
    setSubjectText("");
    setChapterText("");
    setTopicText("");
    setSubjects([]);
    setChapters([]);
    setTopics([]);
    setError("");
  }

  function handleSemesterChange(value: string) {
    setSemester(value);
    setSubjectId("");
    setChapterId("");
    setTopicId("");
    setSubjectText("");
    setChapterText("");
    setTopicText("");
    setSubjects([]);
    setChapters([]);
    setTopics([]);
    setError("");
  }

  // Subject / Chapter / Topic accept either a picked option (id given) or typed text.
  // Typed text that matches a listed name is treated as that item; anything else is a custom entry.
  // A different value (not just more/less typing of the same one) clears the boxes below it.
  function isDifferent(prevText: string, nextKey: string): boolean {
    const prev = prevText.trim().toLowerCase();
    if (!prev) return false;
    return nextKey === "" || (!nextKey.startsWith(prev) && !prev.startsWith(nextKey));
  }

  function applySubject(text: string, id?: string) {
    const key = text.trim().toLowerCase();
    const resolved =
      id ?? String(subjects.find((x) => x.name.trim().toLowerCase() === key)?.id ?? "");
    const changed = resolved !== subjectId || isDifferent(subjectText, key);
    setSubjectText(text);
    setError("");
    if (changed) {
      setSubjectId(resolved);
      setChapterId("");
      setTopicId("");
      setChapterText("");
      setTopicText("");
      setChapters([]);
      setTopics([]);
    }
  }

  function applyChapter(text: string, id?: string) {
    const key = text.trim().toLowerCase();
    const resolved =
      id ?? String(chapters.find((x) => x.name.trim().toLowerCase() === key)?.id ?? "");
    const changed = resolved !== chapterId || isDifferent(chapterText, key);
    setChapterText(text);
    setError("");
    if (changed) {
      setChapterId(resolved);
      setTopicId("");
      setTopicText("");
      setTopics([]);
    }
  }

  function applyTopic(text: string, id?: string) {
    const key = text.trim().toLowerCase();
    const resolved =
      id ?? String(topics.find((x) => x.name.trim().toLowerCase() === key)?.id ?? "");
    setTopicText(text);
    setTopicId(resolved);
    setError("");
    const selected = topics.find((t) => String(t.id) === resolved);
    if (selected && onSelect && !onStartLearning) {
      onSelect(selected);
    }
  }

  // Selected Object Lookups
  const selectedBoard = boards.find((b) => String(b.id) === String(boardId));
  const selectedGrade = grades.find((g) => String(g.id) === String(gradeId));
  const selectedSubject = subjects.find((s) => String(s.id) === String(subjectId));
  const selectedChapter = chapters.find((c) => String(c.id) === String(chapterId));
  const selectedTopic = topics.find((t) => String(t.id) === String(topicId));

  React.useEffect(() => {
    if (selectedSubject && !subjectText) setSubjectText(selectedSubject.name);
  }, [selectedSubject]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (selectedChapter && !chapterText) setChapterText(selectedChapter.name);
  }, [selectedChapter]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (selectedTopic && !topicText) setTopicText(selectedTopic.name);
  }, [selectedTopic]); // eslint-disable-line react-hooks/exhaustive-deps

  // Options for the three boxes: database items first, then (subjects only) common suggestions
  const dbSubjectNames = new Set(subjects.map((x) => x.name.trim().toLowerCase()));
  const subjectOptions: ComboOption[] = [
    ...subjects.map((x) => ({
      key: String(x.id),
      label: x.name,
      hint: x._count?.chapters ? `${x._count.chapters} chapters` : undefined,
    })),
    ...(educationType === "diploma" ? DIPLOMA_SUBJECT_SUGGESTIONS : SCHOOL_SUBJECT_SUGGESTIONS)
      .filter((n) => !dbSubjectNames.has(n.toLowerCase()))
      .map((n) => ({ key: `suggest:${n}`, label: n, hint: "Suggested" })),
  ];
  // Database chapters/topics first, then built-in reference suggestions that are not already listed
  const dbChapterNames = new Set(chapters.map((x) => x.name.trim().toLowerCase()));
  const chapterOptions: ComboOption[] = [
    ...chapters.map((c) => ({
      key: String(c.id),
      label: c.name,
      hint: c._count?.topics ? `${c._count.topics} topics` : undefined,
    })),
    ...getReferenceChapters(subjectText, educationType === "diploma")
      .filter((n) => !dbChapterNames.has(n.toLowerCase()))
      .map((n) => ({ key: `suggest:${n}`, label: n, hint: "Suggested" })),
  ];
  const dbTopicNames = new Set(topics.map((x) => x.name.trim().toLowerCase()));
  const topicOptions: ComboOption[] = [
    ...topics.map((t) => ({
      key: String(t.id),
      label: t.name,
      hint: t._count
        ? `${t._count.contents || 0} lessons · ${t._count.questions || 0} questions`
        : undefined,
    })),
    ...getReferenceTopics(subjectText, chapterText)
      .filter((n) => !dbTopicNames.has(n.toLowerCase()))
      .map((n) => ({ key: `suggest:${n}`, label: n, hint: "Suggested" })),
  ];

  const isComplete = Boolean(
    boardId &&
    gradeId &&
    (educationType === "school" || (branch && semester)) &&
    subjectText.trim() &&
    chapterText.trim() &&
    topicText.trim()
  );

  function handleStartLearningClick() {
    if (!isComplete || !onStartLearning) return;

    if (!selectedBoard || !selectedGrade) {
      setError("Please complete all curriculum selections to start learning.");
      return;
    }

    onStartLearning({
      educationType,
      board: selectedBoard,
      grade: selectedGrade,
      branch: educationType === "diploma" ? branch : undefined,
      semester: educationType === "diploma" ? semester : undefined,
      subject: selectedSubject ?? customEntity<Subject>("subject", subjectText.trim()),
      chapter: selectedChapter ?? customEntity<Chapter>("chapter", chapterText.trim()),
      topic: selectedTopic ?? customEntity<Topic>("topic", topicText.trim()),
    });
  }

  return (
    <div className="grid gap-4">
      {error ? (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {/* 1. Education Type Selector (School vs Diploma) */}
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-sm font-medium">
            Education Pathway <span className="text-destructive">*</span>
          </span>
          <span className="text-xs text-muted-foreground">Select your stream</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            id="tab-school-education"
            className={`flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors ${
              educationType === "school"
                ? "border-primary bg-primary/10 text-primary font-semibold"
                : "border-input bg-background text-muted-foreground hover:bg-muted/50"
            }`}
            onClick={() => handleEducationTypeChange("school")}
          >
            <School className="h-4 w-4 shrink-0" />
            <span>School (Class 1–12)</span>
          </button>
          <button
            type="button"
            id="tab-diploma-education"
            className={`flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors ${
              educationType === "diploma"
                ? "border-primary bg-primary/10 text-primary font-semibold"
                : "border-input bg-background text-muted-foreground hover:bg-muted/50"
            }`}
            onClick={() => handleEducationTypeChange("diploma")}
          >
            <GraduationCap className="h-4 w-4 shrink-0" />
            <span>Diploma / Polytechnic</span>
          </button>
        </div>
      </div>

      {/* 2. Board Selection */}
      <label className="grid gap-1.5 text-sm font-medium">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            {educationType === "diploma" ? "Technical Board" : "State / Central Board"}{" "}
            <span className="text-destructive">*</span>
          </span>
          {loadingBoards ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading boards…
            </span>
          ) : null}
        </div>
        <select
          id="select-board"
          aria-label={educationType === "diploma" ? "Technical Board" : "Education Board"}
          className={selectClass}
          value={boardId}
          onChange={(e) => handleBoardChange(e.target.value)}
          disabled={loadingBoards}
        >
          <option value="">
            {loadingBoards
              ? "Loading boards…"
              : boards.length === 0
              ? "No boards available"
              : educationType === "diploma"
              ? "Select Technical Board (e.g. MSBTE)"
              : "Select Board (e.g. CBSE, Maharashtra State Board)"}
          </option>
          {boards.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} {b.state ? `(${b.state})` : ""}
            </option>
          ))}
        </select>
      </label>

      {/* Missing coverage note for unverified boards */}
      {selectedBoard && selectedBoard.hasCurriculumCoverage === false ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-400">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            Official syllabus coverage for <strong>{selectedBoard.name}</strong> is currently being verified and curated.
            To study live syllabus topics now, try selecting <strong>{educationType === "diploma" ? "MSBTE" : "CBSE or Maharashtra State Board"}</strong>.
          </span>
        </div>
      ) : null}

      {/* 3. Class (School) or Year (Diploma) Selection */}
      <label className="grid gap-1.5 text-sm font-medium">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            {educationType === "diploma" ? "Diploma Year" : "Class / Grade"}{" "}
            <span className="text-destructive">*</span>
          </span>
          {loadingGrades ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading options…
            </span>
          ) : null}
        </div>
        <select
          id="select-class"
          aria-label={educationType === "diploma" ? "Diploma Year" : "Class or Grade"}
          className={selectClass}
          value={gradeId}
          onChange={(e) => handleGradeChange(e.target.value)}
          disabled={!boardId || loadingGrades || grades.length === 0}
        >
          <option value="">
            {!boardId
              ? "Choose a board first"
              : loadingGrades
              ? "Loading options…"
              : grades.length === 0
              ? "No options available for this board"
              : educationType === "diploma"
              ? "Select Diploma Year (Year 1, 2, or 3)"
              : "Select Class (Class 1 to 12)"}
          </option>
          {grades.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>

      {/* 4. Diploma-Specific Cascade: Branch and Semester */}
      {educationType === "diploma" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Branch Dropdown */}
          <label className="grid gap-1.5 text-sm font-medium">
            <span className="flex items-center gap-1.5">
              Branch / Discipline <span className="text-destructive">*</span>
            </span>
            <select
              id="select-branch"
              aria-label="Diploma Branch"
              className={selectClass}
              value={branch}
              onChange={(e) => handleBranchChange(e.target.value)}
              disabled={!gradeId || branches.length === 0}
            >
              <option value="">
                {!gradeId ? "Choose Year first" : "Select Branch"}
              </option>
              {branches.map((br) => (
                <option key={br} value={br}>
                  {br}
                </option>
              ))}
            </select>
          </label>

          {/* Semester Dropdown */}
          <label className="grid gap-1.5 text-sm font-medium">
            <span className="flex items-center gap-1.5">
              Semester <span className="text-destructive">*</span>
            </span>
            <select
              id="select-semester"
              aria-label="Diploma Semester"
              className={selectClass}
              value={semester}
              onChange={(e) => handleSemesterChange(e.target.value)}
              disabled={!gradeId || semesters.length === 0}
            >
              <option value="">
                {!gradeId ? "Choose Year first" : "Select Semester"}
              </option>
              {semesters.map((sem) => (
                <option key={sem} value={sem}>
                  {sem}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {/* 5. Subject Selection (pick from the list or type your own) */}
      <div className="grid gap-1.5 text-sm font-medium">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            Subject <span className="text-destructive">*</span>
          </span>
          {loadingSubjects ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading subjects…
            </span>
          ) : null}
        </div>
        <Combobox
          id="select-subject"
          ariaLabel="Subject"
          value={subjectText}
          onChange={(text) => applySubject(text)}
          onPick={(o) => applySubject(o.label, o.key.startsWith("suggest:") ? undefined : o.key)}
          options={subjectOptions}
          disabled={!gradeId || (educationType === "diploma" && (!branch || !semester))}
          placeholder={
            !gradeId
              ? "Choose class/year first"
              : educationType === "diploma" && (!branch || !semester)
              ? "Choose branch and semester first"
              : "Select or type a subject"
          }
        />
      </div>

      {/* Empty State Help for Class/Subject if subjects is empty */}
      {gradeId && !loadingSubjects && subjects.length === 0 && (educationType === "school" || (branch && semester)) ? (
        <div className="flex items-start gap-2 rounded-lg border border-muted bg-muted/30 p-2.5 text-xs text-muted-foreground">
          <Info className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
          <span>
            {educationType === "school"
              ? "Syllabus records for this class are currently under verification. You can explore verified topics in Class 1, Class 10, or Class 12."
              : "Syllabus records for this branch/semester are under verification. You can explore Computer Engineering in Semester 1 through 6."}
          </span>
        </div>
      ) : null}

      {/* 6. Chapter / Unit Selection (pick from the list or type your own) */}
      <div className="grid gap-1.5 text-sm font-medium">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            {educationType === "diploma" ? "Unit / Chapter" : "Chapter"}{" "}
            <span className="text-destructive">*</span>
          </span>
          {loadingChapters ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading chapters…
            </span>
          ) : null}
        </div>
        <Combobox
          id="select-chapter"
          ariaLabel="Chapter or Unit"
          value={chapterText}
          onChange={(text) => applyChapter(text)}
          onPick={(o) => applyChapter(o.label, o.key.startsWith("suggest:") ? undefined : o.key)}
          options={chapterOptions}
          disabled={!subjectText.trim()}
          placeholder={
            !subjectText.trim()
              ? "Choose or type a subject first"
              : loadingChapters
              ? "Loading chapters…"
              : chapterOptions.length === 0
              ? "Type a chapter name"
              : "Select or type a chapter"
          }
        />
      </div>

      {/* 7. Topic Selection (pick from the list or type your own) */}
      <div className="grid gap-1.5 text-sm font-medium">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            Topic <span className="text-destructive">*</span>
          </span>
          {loadingTopics ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading topics…
            </span>
          ) : null}
        </div>
        <Combobox
          id="select-topic"
          ariaLabel="Topic"
          value={topicText}
          onChange={(text) => applyTopic(text)}
          onPick={(o) => applyTopic(o.label, o.key.startsWith("suggest:") ? undefined : o.key)}
          options={topicOptions}
          disabled={!chapterText.trim()}
          placeholder={
            !chapterText.trim()
              ? "Choose or type a chapter first"
              : loadingTopics
              ? "Loading topics…"
              : topicOptions.length === 0
              ? "Type a topic name"
              : "Select or type a topic"
          }
        />
      </div>

      {/* Primary Start Learning Action Button */}
      {onStartLearning ? (
        <div className="pt-2">
          <Button
            id="start-learning-btn"
            type="button"
            className="w-full gap-2 text-base font-semibold transition-all py-5"
            size="lg"
            disabled={!isComplete}
            onClick={handleStartLearningClick}
          >
            <BookOpen className="h-5 w-5" />
            Start Learning
          </Button>
          {!isComplete ? (
            <p className="mt-1.5 text-center text-xs text-muted-foreground">
              {educationType === "school"
                ? "Select all curriculum details (Board, Class, Subject, Chapter, Topic) to start learning."
                : "Select all diploma details (Board, Year, Branch, Semester, Subject, Chapter, Topic) to start learning."}
            </p>
          ) : (
            <p className="mt-1.5 flex items-center justify-center gap-1 text-center text-xs text-brand-green font-medium">
              <Sparkles className="h-3.5 w-3.5" />
              Ready! Click Start Learning to enter your topic dashboard.
            </p>
          )}
        </div>
      ) : null}

      {onStart ? (
        <div className="pt-2">
          <Button
            id="start-quiz-btn"
            type="button"
            className="w-full gap-2 text-base font-semibold transition-all py-5"
            size="lg"
            disabled={!isComplete}
            onClick={() =>
              onStart(selectedTopic ?? customEntity<Topic>("topic", topicText.trim()))
            }
          >
            {startLabel ?? "Start"}
          </Button>
          {!isComplete ? (
            <p className="mt-1.5 text-center text-xs text-muted-foreground">
              Select all details (Board, Class, Subject, Chapter, Topic) to start.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
