"use client";

import * as React from "react";
import Link from "next/link";
import {
  Video,
  Search,
  Play,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  BookOpen,
  X,
  GraduationCap,
  Clock,
  PlusCircle,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Building2,
  ShieldCheck,
  Cpu,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RequireStudent } from "@/components/student/require-student";
import {
  apiFetch,
  fetchCurriculumMetadata,
  type EducationalVideo,
  type VideoSearchResponse,
  type VideoValidateResponse,
  type CurriculumMetadataResponse,
} from "@/lib/api";

const LANGUAGES = [
  { id: "all", label: "All Languages", native: "All", flag: "🌐" },
  { id: "en", label: "English", native: "English", flag: "🇬🇧" },
  { id: "hi", label: "Hindi", native: "हिंदी", flag: "🇮🇳" },
  { id: "mr", label: "Marathi", native: "मराठी", flag: "🇮🇳" },
  { id: "te", label: "Telugu", native: "తెలుగు", flag: "🇮🇳" },
] as const;

const LEVEL_TABS = [
  { id: "all", label: "All Curricula", icon: BookOpen },
  { id: "primary", label: "Primary (1–5)", icon: GraduationCap },
  { id: "middle", label: "Middle (6–8)", icon: GraduationCap },
  { id: "secondary", label: "Secondary (9–10)", icon: GraduationCap },
  { id: "higher_secondary", label: "Higher Secondary (11–12)", icon: Building2 },
  { id: "diploma", label: "Diploma / Polytechnic", icon: Cpu },
] as const;

function getSafeEmbedUrl(video: EducationalVideo): string | null {
  const rawId = video.id?.trim();
  if (!rawId || !/^[a-zA-Z0-9_-]{11}$/.test(rawId)) {
    return null;
  }
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(rawId)}?autoplay=1&rel=0`;
}

export function VideosView() {
  const [curriculumMeta, setCurriculumMeta] = React.useState<CurriculumMetadataResponse | null>(null);
  const [videos, setVideos] = React.useState<EducationalVideo[]>([]);
  const [totalCount, setTotalCount] = React.useState<number>(0);
  const [totalPages, setTotalPages] = React.useState<number>(1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedLanguage, setSelectedLanguage] = React.useState<string>("all");
  const [selectedLevel, setSelectedLevel] = React.useState<string>("all");
  const [selectedClass, setSelectedClass] = React.useState<string>("all");
  const [selectedBoard, setSelectedBoard] = React.useState<string>("all");
  const [selectedStream, setSelectedStream] = React.useState<string>("all");
  const [selectedBranch, setSelectedBranch] = React.useState<string>("all");
  const [selectedScheme, setSelectedScheme] = React.useState<string>("all");
  const [selectedSemester, setSelectedSemester] = React.useState<string>("all");
  const [selectedSubject, setSelectedSubject] = React.useState<string>("all");
  const [selectedVerification, setSelectedVerification] = React.useState<string>("all");
  const [page, setPage] = React.useState<number>(1);
  const [limit] = React.useState<number>(24);

  // Player modal state
  const [activeVideo, setActiveVideo] = React.useState<EducationalVideo | null>(null);
  const activeSafeEmbedUrl = React.useMemo(
    () => (activeVideo ? getSafeEmbedUrl(activeVideo) : null),
    [activeVideo]
  );

  // Video Validator modal
  const [showValidator, setShowValidator] = React.useState(false);
  const [validateInput, setValidateInput] = React.useState("");
  const [validating, setValidating] = React.useState(false);
  const [validateResult, setValidateResult] = React.useState<VideoValidateResponse | null>(null);
  const [validateError, setValidateError] = React.useState<string | null>(null);

  // Mobile filters drawer toggle
  const [mobileFiltersOpen, setMobileFiltersOpen] = React.useState(false);

  // 1. Fetch Curriculum Metadata on Mount
  React.useEffect(() => {
    let active = true;
    fetchCurriculumMetadata()
      .then((data) => {
        if (active && data?.success) {
          setCurriculumMeta(data);
        }
      })
      .catch((err) => {
        console.warn("Failed to load curriculum metadata from API, using fallback defaults:", err);
      });
    return () => {
      active = false;
    };
  }, []);

  // 2. Fetch Videos based on current filters
  const fetchVideos = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedLevel !== "all") params.append("educationLevel", selectedLevel);
      if (selectedClass !== "all") params.append("classGrade", selectedClass);
      if (selectedBoard !== "all") params.append("board", selectedBoard);
      if (selectedStream !== "all") params.append("stream", selectedStream);
      if (selectedBranch !== "all") params.append("branch", selectedBranch);
      if (selectedScheme !== "all") params.append("scheme", selectedScheme);
      if (selectedSemester !== "all") params.append("semester", selectedSemester);
      if (selectedSubject !== "all") params.append("subject", selectedSubject);
      if (selectedLanguage !== "all") params.append("language", selectedLanguage);
      if (selectedVerification !== "all") params.append("verificationStatus", selectedVerification);
      if (searchQuery.trim()) params.append("q", searchQuery.trim());
      params.append("page", String(page));
      params.append("limit", String(limit));

      const res = await apiFetch<VideoSearchResponse>(`/videos?${params.toString()}`);
      if (res && Array.isArray(res.videos)) {
        setVideos(res.videos);
        setTotalCount(res.total ?? res.videos.length);
        setTotalPages(res.totalPages ?? 1);
      } else {
        setVideos([]);
        setTotalCount(0);
        setTotalPages(1);
      }
    } catch (err: unknown) {
      console.error("Failed to load educational videos:", err);
      setError(err instanceof Error ? err.message : "Unable to load video lessons.");
    } finally {
      setLoading(false);
    }
  }, [
    selectedLevel,
    selectedClass,
    selectedBoard,
    selectedStream,
    selectedBranch,
    selectedScheme,
    selectedSemester,
    selectedSubject,
    selectedLanguage,
    selectedVerification,
    searchQuery,
    page,
    limit,
  ]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      fetchVideos();
    }, 180);
    return () => clearTimeout(timer);
  }, [fetchVideos]);

  // Reset page when any core filter changes
  const handleLevelChange = (lvl: string) => {
    setSelectedLevel(lvl);
    setSelectedClass("all");
    setSelectedStream("all");
    setSelectedBranch("all");
    setSelectedScheme("all");
    setSelectedSemester("all");
    setSelectedSubject("all");
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedLanguage("all");
    setSelectedLevel("all");
    setSelectedClass("all");
    setSelectedBoard("all");
    setSelectedStream("all");
    setSelectedBranch("all");
    setSelectedScheme("all");
    setSelectedSemester("all");
    setSelectedSubject("all");
    setSelectedVerification("all");
    setPage(1);
  };

  // Video verification handler
  const handleValidateVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateInput.trim()) return;

    setValidating(true);
    setValidateError(null);
    setValidateResult(null);

    try {
      const res = await apiFetch<VideoValidateResponse>("/videos/validate", {
        method: "POST",
        body: { urlOrId: validateInput.trim() },
      });
      setValidateResult(res);
    } catch (err: unknown) {
      setValidateError(err instanceof Error ? err.message : "Failed to validate YouTube link.");
    } finally {
      setValidating(false);
    }
  };

  // Dynamic available classes
  const availableClasses = React.useMemo(() => {
    if (selectedLevel === "primary") return ["1", "2", "3", "4", "5"];
    if (selectedLevel === "middle") return ["6", "7", "8"];
    if (selectedLevel === "secondary") return ["9", "10"];
    if (selectedLevel === "higher_secondary") return ["11", "12"];
    if (selectedLevel === "diploma") return [];
    return ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
  }, [selectedLevel]);

  // Dynamic available subjects
  const availableSubjects = React.useMemo(() => {
    if (selectedLevel === "diploma") {
      const branchKey = selectedBranch !== "all" ? selectedBranch : "computer";
      const semKey = selectedSemester !== "all" ? selectedSemester : "1";
      const branchMap = curriculumMeta?.diplomaSubjectsByBranchAndSem?.[branchKey];
      if (branchMap && branchMap[semKey]) {
        return branchMap[semKey];
      }
      if (branchMap && branchMap["2"]) {
        return branchMap["2"];
      }
      return [
        "Programming in C",
        "Data Structures Using C",
        "Database Management Systems (DBMS)",
        "Java Programming",
        "Computer Networks",
        "Operating Systems",
        "Engineering Mechanics",
        "Basic Surveying",
        "Basic Electrical Engineering",
      ];
    }

    if (selectedLevel === "higher_secondary") {
      if (selectedStream === "science") {
        return curriculumMeta?.schoolSubjectsByLevel?.higher_secondary_science || [
          "Physics",
          "Chemistry",
          "Mathematics",
          "Biology",
          "Computer Science",
        ];
      }
      if (selectedStream === "commerce") {
        return curriculumMeta?.schoolSubjectsByLevel?.higher_secondary_commerce || [
          "Accountancy",
          "Business Studies",
          "Economics",
          "Applied Mathematics",
        ];
      }
      if (selectedStream === "arts") {
        return curriculumMeta?.schoolSubjectsByLevel?.higher_secondary_arts || [
          "History",
          "Political Science",
          "Geography",
          "Economics",
        ];
      }
      return curriculumMeta?.schoolSubjectsByLevel?.higher_secondary || [
        "Physics",
        "Chemistry",
        "Mathematics",
        "Biology",
        "Accountancy",
        "Economics",
      ];
    }

    if (selectedLevel === "primary") {
      return curriculumMeta?.schoolSubjectsByLevel?.primary || [
        "Mathematics",
        "Environmental Studies (EVS)",
        "English",
        "Hindi",
        "Marathi",
        "Telugu",
      ];
    }

    if (selectedLevel === "middle") {
      return curriculumMeta?.schoolSubjectsByLevel?.middle || [
        "Mathematics",
        "Science",
        "Social Science",
        "English",
        "Hindi",
      ];
    }

    if (selectedLevel === "secondary") {
      return curriculumMeta?.schoolSubjectsByLevel?.secondary || [
        "Mathematics",
        "Science (Physics, Chemistry, Biology)",
        "Social Science",
        "English",
      ];
    }

    return [
      "Mathematics",
      "Science",
      "Physics",
      "Chemistry",
      "Biology",
      "Environmental Studies (EVS)",
      "Programming in C",
      "Data Structures",
      "Java Programming",
      "Accountancy",
    ];
  }, [selectedLevel, selectedStream, selectedBranch, selectedSemester, curriculumMeta]);

  // Helper to generate full AI Tutor URL with rich video context
  const getAiTutorUrl = (v: EducationalVideo) => {
    const params = new URLSearchParams();
    params.set("videoId", v.id);
    params.set("videoTitle", v.title);
    if (v.topic) params.set("topic", v.topic);
    if (v.language) params.set("language", v.language);
    if (v.educationLevel) params.set("educationLevel", String(v.educationLevel));
    if (v.classGrade) params.set("classGrade", String(v.classGrade));
    if (v.grade) params.set("grade", String(v.grade));
    if (v.board) params.set("board", String(v.board));
    if (v.stream) params.set("stream", String(v.stream));
    if (v.branch) params.set("branch", String(v.branch));
    if (v.scheme) params.set("scheme", String(v.scheme));
    if (v.semester) params.set("semester", String(v.semester));
    if (v.subject) params.set("subject", String(v.subject));
    if (v.chapter) params.set("chapter", String(v.chapter));
    return `/student/tutor?${params.toString()}`;
  };

  const getLanguageBadge = (lang: string) => {
    switch (lang.toLowerCase()) {
      case "hi":
        return <Badge variant="secondary" className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px]">हिंदी</Badge>;
      case "mr":
        return <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]">मराठी</Badge>;
      case "te":
        return <Badge variant="secondary" className="bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30 text-[10px]">తెలుగు</Badge>;
      default:
        return <Badge variant="secondary" className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30 text-[10px]">English</Badge>;
    }
  };

  const getLevelBadge = (v: EducationalVideo) => {
    if (v.educationLevel === "diploma") {
      return (
        <Badge variant="outline" className="border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-300 text-[10px]">
          Diploma{v.branch ? ` · ${v.branch.toUpperCase()}` : ""}{v.semester ? ` S${v.semester}` : ""}
        </Badge>
      );
    }
    if (v.educationLevel === "higher_secondary") {
      return (
        <Badge variant="outline" className="border-pink-500/30 bg-pink-500/10 text-pink-600 dark:text-pink-300 text-[10px]">
          Class {v.classGrade || "11-12"}{v.stream ? ` · ${v.stream}` : ""}
        </Badge>
      );
    }
    if (v.classGrade) {
      return (
        <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary text-[10px]">
          Class {v.classGrade}
        </Badge>
      );
    }
    return null;
  };

  const activeFiltersCount = [
    selectedLevel !== "all",
    selectedClass !== "all",
    selectedBoard !== "all",
    selectedStream !== "all",
    selectedBranch !== "all",
    selectedScheme !== "all",
    selectedSemester !== "all",
    selectedSubject !== "all",
    selectedLanguage !== "all",
    selectedVerification !== "all",
    searchQuery.trim().length > 0,
  ].filter(Boolean).length;

  return (
    <RequireStudent>
      <div className="container max-w-7xl mx-auto px-4 py-8 space-y-7">
        {/* Header Hero Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/15 via-primary/5 to-background border border-primary/25 p-6 sm:p-8">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary px-3 py-1 text-xs">
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  Multilingual Video Catalog
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  Classes 1–12 &amp; Diploma
                </Badge>
                <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="w-3 h-3 mr-1" />
                  Verified Lessons
                </Badge>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Educational Video Library
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base max-w-2xl leading-relaxed">
                Explore curriculum-aligned educational lessons from Class 1 to Class 12 and Polytechnic / Diploma Engineering across English, Hindi, Marathi, and Telugu.
                Watch embedded video lessons and study any doubt alongside the AI Teacher.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowValidator(true)}
                className="gap-2 border-border/80 hover:bg-muted/60"
              >
                <PlusCircle className="w-4 h-4 text-primary" />
                Validate YouTube Link
              </Button>
              <Link href="/student/tutor">
                <Button size="sm" className="gap-2 bg-primary text-primary-foreground">
                  <Sparkles className="w-4 h-4" />
                  Ask AI Teacher
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Education Level Selector Bar */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-primary" /> Select Education Level
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileFiltersOpen((prev) => !prev)}
              className="sm:hidden text-xs gap-1.5 h-7"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filters {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ""}
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {LEVEL_TABS.map((tab) => {
              const Icon = tab.icon;
              const isSelected = selectedLevel === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleLevelChange(tab.id)}
                  className={cn(
                    "flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all text-left",
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "bg-card/70 border-border/70 text-foreground hover:bg-muted/70 hover:border-border"
                  )}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search & Language Bar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Search Input */}
          <div className="md:col-span-6 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by topic, chapter, subject, title, or channel..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="pl-9 pr-8 text-xs sm:text-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Language filter pills */}
          <div className="md:col-span-6 flex items-center justify-start md:justify-end gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {LANGUAGES.map((lang) => (
              <Button
                key={lang.id}
                variant={selectedLanguage === lang.id ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSelectedLanguage(lang.id);
                  setPage(1);
                }}
                className={cn(
                  "h-8 text-xs font-medium shrink-0",
                  selectedLanguage === lang.id ? "shadow-xs" : "border-border/60 hover:bg-muted/50"
                )}
              >
                <span className="mr-1">{lang.flag}</span>
                {lang.native}
              </Button>
            ))}
          </div>
        </div>

        {/* Dependent Secondary Filters Container */}
        <div className={cn(
          "rounded-xl border border-border/70 bg-card/60 p-4 space-y-3 transition-all",
          "sm:block",
          mobileFiltersOpen ? "block" : "hidden sm:block"
        )}>
          <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-semibold text-foreground">
                Curriculum &amp; Course Specifics
              </span>
            </div>

            {activeFiltersCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="text-xs h-7 gap-1 text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="w-3 h-3" />
                Reset All Filters
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 pt-1">
            {/* 1. Class Filter (For School levels) */}
            {selectedLevel !== "diploma" && (
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">Class / Grade</label>
                <select
                  value={selectedClass}
                  onChange={(e) => {
                    setSelectedClass(e.target.value);
                    setPage(1);
                  }}
                  className="w-full h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="all">All Classes</option>
                  {availableClasses.map((cls) => (
                    <option key={cls} value={cls}>Class {cls}</option>
                  ))}
                </select>
              </div>
            )}

            {/* 2. Board Filter (CBSE, ICSE, Maharashtra, Telangana, AP) */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Board / Council</label>
              <select
                value={selectedBoard}
                onChange={(e) => {
                  setSelectedBoard(e.target.value);
                  setPage(1);
                }}
                className="w-full h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Boards</option>
                <option value="cbse">CBSE (Central Board)</option>
                <option value="icse">ICSE / CISCE</option>
                <option value="maharashtra">Maharashtra State (MSBSHSE)</option>
                <option value="telangana">Telangana State (TSBIE / SSC)</option>
                <option value="andhra_pradesh">Andhra Pradesh State (BIEAP)</option>
                <option value="other">Other State Boards</option>
              </select>
            </div>

            {/* 3. Higher Secondary Stream Filter */}
            {selectedLevel === "higher_secondary" && (
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">Specialization Stream</label>
                <select
                  value={selectedStream}
                  onChange={(e) => {
                    setSelectedStream(e.target.value);
                    setSelectedSubject("all");
                    setPage(1);
                  }}
                  className="w-full h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="all">All Streams</option>
                  <option value="science">Science (PCM / PCB)</option>
                  <option value="commerce">Commerce</option>
                  <option value="arts">Arts &amp; Humanities</option>
                </select>
              </div>
            )}

            {/* 4. Diploma Branch Filter */}
            {selectedLevel === "diploma" && (
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">Engineering Branch</label>
                <select
                  value={selectedBranch}
                  onChange={(e) => {
                    setSelectedBranch(e.target.value);
                    setSelectedSubject("all");
                    setPage(1);
                  }}
                  className="w-full h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="all">All Polytechnic Branches</option>
                  <option value="computer">Computer Engineering</option>
                  <option value="it">Information Technology (IT)</option>
                  <option value="mechanical">Mechanical Engineering</option>
                  <option value="civil">Civil Engineering</option>
                  <option value="electrical">Electrical Engineering</option>
                  <option value="electronics">Electronics &amp; Telecomm (EXTC)</option>
                  <option value="other">Other Branches</option>
                </select>
              </div>
            )}

            {/* 5. Diploma Scheme Filter */}
            {selectedLevel === "diploma" && (
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">Curriculum Scheme</label>
                <select
                  value={selectedScheme}
                  onChange={(e) => {
                    setSelectedScheme(e.target.value);
                    setPage(1);
                  }}
                  className="w-full h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="all">All Schemes</option>
                  <option value="msbte_k">MSBTE K-Scheme (Latest NEP)</option>
                  <option value="msbte_i">MSBTE I-Scheme</option>
                  <option value="sbtet">SBTET (Telangana &amp; AP)</option>
                  <option value="aicte">AICTE Model Curriculum</option>
                  <option value="state_polytechnic">State Polytechnic Scheme</option>
                </select>
              </div>
            )}

            {/* 6. Diploma Semester Filter */}
            {selectedLevel === "diploma" && (
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">Semester</label>
                <select
                  value={selectedSemester}
                  onChange={(e) => {
                    setSelectedSemester(e.target.value);
                    setSelectedSubject("all");
                    setPage(1);
                  }}
                  className="w-full h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="all">All Semesters</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                    <option key={s} value={String(s)}>Semester {s}</option>
                  ))}
                </select>
              </div>
            )}

            {/* 7. Subject Filter (Dynamically driven by Level, Stream, Branch, Sem) */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Subject</label>
              <select
                value={selectedSubject}
                onChange={(e) => {
                  setSelectedSubject(e.target.value);
                  setPage(1);
                }}
                className="w-full h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Subjects</option>
                {availableSubjects.map((subj) => (
                  <option key={subj} value={subj}>{subj}</option>
                ))}
              </select>
            </div>

            {/* 8. Verification Status Filter */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Catalog Verification</label>
              <select
                value={selectedVerification}
                onChange={(e) => {
                  setSelectedVerification(e.target.value);
                  setPage(1);
                }}
                className="w-full h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All (Verified &amp; Provisional)</option>
                <option value="verified">Verified Lessons Only</option>
                <option value="provisional">Provisional Alignment</option>
              </select>
            </div>
          </div>

          {/* Active filter pills indicator */}
          {activeFiltersCount > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-2 text-[11px]">
              <span className="text-muted-foreground font-medium mr-1">Active Filters:</span>
              {selectedLevel !== "all" && (
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  Level: {selectedLevel.replace("_", " ")}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => handleLevelChange("all")} />
                </Badge>
              )}
              {selectedClass !== "all" && (
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  Class {selectedClass}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedClass("all")} />
                </Badge>
              )}
              {selectedBoard !== "all" && (
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  Board: {selectedBoard.toUpperCase()}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedBoard("all")} />
                </Badge>
              )}
              {selectedStream !== "all" && (
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  Stream: {selectedStream}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedStream("all")} />
                </Badge>
              )}
              {selectedBranch !== "all" && (
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  Branch: {selectedBranch}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedBranch("all")} />
                </Badge>
              )}
              {selectedScheme !== "all" && (
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  Scheme: {selectedScheme}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedScheme("all")} />
                </Badge>
              )}
              {selectedSemester !== "all" && (
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  Sem {selectedSemester}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedSemester("all")} />
                </Badge>
              )}
              {selectedSubject !== "all" && (
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  Subject: {selectedSubject}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedSubject("all")} />
                </Badge>
              )}
              {selectedLanguage !== "all" && (
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  Language: {selectedLanguage.toUpperCase()}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedLanguage("all")} />
                </Badge>
              )}
              {searchQuery.trim() && (
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  Query: &quot;{searchQuery}&quot;
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setSearchQuery("")} />
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Video Grid Section */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-border/40 bg-card p-4 space-y-3 animate-pulse"
              >
                <div className="h-44 rounded-lg bg-muted/60" />
                <div className="h-4 bg-muted/80 rounded-sm w-3/4" />
                <div className="h-3 bg-muted/50 rounded-sm w-1/2" />
                <div className="h-10 bg-muted/40 rounded-sm" />
              </div>
            ))}
          </div>
        ) : error ? (
          <Card className="border-destructive/40 bg-destructive/5 text-center p-8 space-y-4">
            <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-destructive">Failed to Load Video Lessons</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchVideos} className="gap-2">
              <RotateCcw className="w-4 h-4" /> Try Again
            </Button>
          </Card>
        ) : videos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/80 p-12 text-center space-y-4 bg-card/40">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
              <Video className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-foreground">No Educational Lessons Found</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                No videos match your selected curriculum, board, or subject criteria. Try selecting &quot;All Classes&quot; or clearing your active filters.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              className="gap-2"
            >
              <RotateCcw className="w-4 h-4" /> Reset Filters
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-muted-foreground border-b border-border/40 pb-2">
              <span>
                Showing <strong className="text-foreground">{videos.length}</strong> of{" "}
                <strong className="text-foreground">{totalCount}</strong> verified lessons
              </span>
              <span>Click a lesson to watch or study doubts interactively with the AI Teacher</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {videos.map((video) => (
                <Card
                  key={video.id}
                  className="group flex flex-col justify-between overflow-hidden border-border/60 hover:border-primary/40 transition-all duration-200 hover:shadow-lg bg-card"
                >
                  <div>
                    {/* Thumbnail Preview with Duration & Play overlay */}
                    <div
                      className="relative h-44 w-full overflow-hidden bg-black/40 cursor-pointer"
                      onClick={() => setActiveVideo(video)}
                    >
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = `https://img.youtube.com/vi/${video.id}/hqdefault.jpg`;
                        }}
                      />
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-primary/90 text-primary-foreground flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                          <Play className="w-5 h-5 ml-0.5 fill-current" />
                        </div>
                      </div>

                      {/* Language and curriculum badges */}
                      <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                        {getLanguageBadge(video.language)}
                        {getLevelBadge(video)}
                      </div>

                      {video.duration && (
                        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-sm bg-black/80 text-[10px] font-medium text-white flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {video.duration}
                        </div>
                      )}
                    </div>

                    {/* Metadata Header */}
                    <CardHeader className="p-4 space-y-1.5 pb-2">
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span className="font-medium text-primary flex items-center gap-1 truncate">
                          <BookOpen className="w-3 h-3 shrink-0" />
                          {video.subject || video.topic}
                        </span>
                        {video.board && video.board !== "all" && (
                          <Badge variant="outline" className="text-[9px] uppercase px-1.5 py-0">
                            {video.board}
                          </Badge>
                        )}
                      </div>

                      <CardTitle
                        onClick={() => setActiveVideo(video)}
                        className="text-sm font-semibold line-clamp-2 leading-snug cursor-pointer hover:text-primary transition-colors"
                        title={video.title}
                      >
                        {video.title}
                      </CardTitle>

                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <GraduationCap className="w-3 h-3 shrink-0" />
                        <span className="truncate">{video.channel}</span>
                      </p>
                    </CardHeader>

                    {/* Description preview */}
                    <CardContent className="px-4 py-1">
                      <p className="text-xs text-muted-foreground/80 line-clamp-2 leading-relaxed">
                        {video.description}
                      </p>
                    </CardContent>
                  </div>

                  {/* Actions */}
                  <CardFooter className="p-4 pt-3 flex flex-col gap-2 border-t border-border/40">
                    <div className="grid grid-cols-2 gap-2 w-full">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => setActiveVideo(video)}
                        className="text-xs h-8 gap-1.5 font-medium"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        Watch
                      </Button>
                      <Link
                        href={getAiTutorUrl(video)}
                        className="w-full"
                      >
                        <Button
                          variant="secondary"
                          size="sm"
                          className="w-full text-xs h-8 gap-1.5 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
                        >
                          <Sparkles className="w-3 h-3" />
                          Study AI
                        </Button>
                      </Link>
                    </div>

                    <a
                      href={video.youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors self-center pt-0.5"
                    >
                      <span>Open on YouTube</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </CardFooter>
                </Card>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-6">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="gap-1 text-xs"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>

                <div className="flex items-center gap-1 text-xs font-medium px-2">
                  <span>Page</span>
                  <span className="font-semibold text-foreground">{page}</span>
                  <span>of</span>
                  <span className="font-semibold text-foreground">{totalPages}</span>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="gap-1 text-xs"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Video Player Modal */}
        <Dialog open={!!activeVideo} onOpenChange={(open) => !open && setActiveVideo(null)}>
          <DialogContent className="max-w-4xl p-0 overflow-hidden bg-card border-border/80">
            {activeVideo ? (
              <div className="flex flex-col">
                <div className="relative aspect-video w-full bg-black flex items-center justify-center">
                  {activeSafeEmbedUrl ? (
                    <iframe
                      src={activeSafeEmbedUrl}
                      title={activeVideo.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full border-0"
                    />
                    ) : (
                      <div className="p-8 text-center text-white space-y-3">
                        <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
                        <div className="space-y-1">
                          <p className="text-sm font-semibold">Embedded Playback Restricted</p>
                          <p className="text-xs text-white/70 max-w-sm mx-auto">
                            This video is marked provisional or has restricted embed permissions. You can open it directly on YouTube or study the topic concepts with the AI Teacher.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                <div className="p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {getLanguageBadge(activeVideo.language)}
                        {getLevelBadge(activeVideo)}
                        {activeVideo.board && activeVideo.board !== "all" && (
                          <Badge variant="outline" className="text-xs uppercase">
                            {activeVideo.board}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {activeVideo.subject || activeVideo.topic}
                        </Badge>
                        {activeVideo.chapter && (
                          <Badge variant="secondary" className="text-xs">
                            {activeVideo.chapter}
                          </Badge>
                        )}
                      </div>

                      <h2 className="text-lg sm:text-xl font-bold text-foreground">
                        {activeVideo.title}
                      </h2>

                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <GraduationCap className="w-3.5 h-3.5" />
                        Channel: <span className="font-medium text-foreground">{activeVideo.channel}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Link href={getAiTutorUrl(activeVideo)}>
                        <Button className="gap-2 bg-primary text-primary-foreground">
                          <Sparkles className="w-4 h-4" />
                          Study with AI Teacher
                        </Button>
                      </Link>
                      <a
                        href={activeVideo.youtubeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="outline" size="icon" title="Open on YouTube">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </a>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {activeVideo.description}
                  </p>

                  <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground flex items-center justify-between gap-2 border border-border/40">
                    <span className="flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5 text-primary" />
                      Playback issues? You can open directly on YouTube or ask the AI Teacher for a step-by-step conceptual summary.
                    </span>
                    <a
                      href={activeVideo.youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary hover:underline shrink-0"
                    >
                      Watch on YouTube ↗
                    </a>
                  </div>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>

        {/* Video Link Validator Dialog (Teacher / Student Tool) */}
        <Dialog open={showValidator} onOpenChange={setShowValidator}>
          <DialogContent className="max-w-lg p-6 space-y-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <PlusCircle className="w-5 h-5 text-primary" />
                Validate YouTube Video Link
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Paste any YouTube URL or 11-character video ID to verify embedding compatibility and connect it to the AI Teacher.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleValidateVideo} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  YouTube Video Link or ID
                </label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g., https://youtu.be/... or g78utcLQrJ4"
                    value={validateInput}
                    onChange={(e) => setValidateInput(e.target.value)}
                    className="text-xs"
                    required
                  />
                  <Button type="submit" size="sm" disabled={validating} className="shrink-0 text-xs">
                    {validating ? "Checking..." : "Verify"}
                  </Button>
                </div>
              </div>
            </form>

            {validateError && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{validateError}</span>
              </div>
            )}

            {validateResult && (
              <div className="space-y-3 p-3.5 rounded-lg border border-border/80 bg-muted/30">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-500">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Valid YouTube Video Verified</span>
                </div>

                <div className="flex gap-3">
                  <img
                    src={validateResult.thumbnailUrl}
                    alt="Preview"
                    className="w-24 h-16 rounded-md object-cover border"
                  />
                  <div className="space-y-1 text-xs">
                    <p className="font-semibold text-foreground line-clamp-1">
                      {validateResult.title || `Video ID: ${validateResult.videoId}`}
                    </p>
                    {validateResult.channel && (
                      <p className="text-muted-foreground">Channel: {validateResult.channel}</p>
                    )}
                    <p className="text-muted-foreground">
                      Embed status: {validateResult.embeddable ? "Supported" : "Restricted"}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
                  <Link
                    href={`/student/tutor?videoId=${validateResult.videoId}&videoTitle=${encodeURIComponent(
                      validateResult.title || "Custom Lesson"
                    )}`}
                    onClick={() => setShowValidator(false)}
                  >
                    <Button size="sm" className="text-xs gap-1.5 bg-primary text-primary-foreground">
                      <Sparkles className="w-3.5 h-3.5" />
                      Study with AI Teacher
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </RequireStudent>
  );
}
