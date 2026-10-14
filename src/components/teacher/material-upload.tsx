"use client";

import * as React from "react";
import {
  UploadCloud,
  FileText,
  FileCode,
  Image as ImageIcon,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  FolderOpen,
  Search,
  X,
  FileCheck,
  HardDrive,
  ShieldCheck,
  Layers,
  Sparkles,
  Gamepad2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  fetchCurriculumMetadata,
  fetchTeacherMaterials,
  uploadTeacherMaterial,
  deleteTeacherMaterial,
  generateLessonDraft,
  generateAssessment,
  type TeacherMaterial,
  type CurriculumMetadataResponse,
  type LessonDraft,
  type AssessmentDraft,
} from "@/lib/api";
import { LessonDraftEditor } from "./lesson-draft-editor";
import { AssessmentEditor } from "./assessment-editor";
import { cn } from "cn";

const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt", ".png", ".jpg", ".jpeg"];
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

const LANGUAGES = [
  { id: "en", label: "English", flag: "🇬🇧" },
  { id: "hi", label: "Hindi (हिन्दी)", flag: "🇮🇳" },
  { id: "mr", label: "Marathi (मराठी)", flag: "🚩" },
  { id: "te", label: "Telugu (తెలుగు)", flag: "☀️" },
];

export function MaterialUploadPanel() {
  // Curriculum metadata state
  const [curriculum, setCurriculum] = React.useState<CurriculumMetadataResponse | null>(null);

  // Upload Form State
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [dragActive, setDragActive] = React.useState(false);
  const [fileError, setFileError] = React.useState("");

  // Curriculum Form Fields
  const [educationLevel, setEducationLevel] = React.useState<"school" | "diploma">("school");
  const [classGrade, setClassGrade] = React.useState("10");
  const [board, setBoard] = React.useState("cbse");
  const [stream, setStream] = React.useState("general");
  const [branch, setBranch] = React.useState("co");
  const [scheme, setScheme] = React.useState("k_scheme");
  const [semester, setSemester] = React.useState("3");
  const [subjectName, setSubjectName] = React.useState("Mathematics");
  const [customSubject, setCustomSubject] = React.useState("");
  const [chapterName, setChapterName] = React.useState("");
  const [topicName, setTopicName] = React.useState("");
  const [language, setLanguage] = React.useState("en");
  const [description, setDescription] = React.useState("");

  // Upload status & Progress
  const [uploading, setUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [uploadSuccess, setUploadSuccess] = React.useState<TeacherMaterial | null>(null);
  const [uploadError, setUploadError] = React.useState("");

  // Materials List State
  const [materials, setMaterials] = React.useState<TeacherMaterial[]>([]);
  const [loadingList, setLoadingList] = React.useState(true);
  const [listError, setListError] = React.useState("");
  const [filterLevel, setFilterLevel] = React.useState<"all" | "school" | "diploma">("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);
  const [selectedDetails, setSelectedDetails] = React.useState<TeacherMaterial | null>(null);
  const [storageMode, setStorageMode] = React.useState<"mongodb" | "in_memory_ephemeral">("mongodb");

  // Lesson Generation State (Phase 3.2)
  const [generatingLessonId, setGeneratingLessonId] = React.useState<string | null>(null);
  const [activeDraft, setActiveDraft] = React.useState<LessonDraft | null>(null);
  const [lessonGenError, setLessonGenError] = React.useState<string | null>(null);

  // Assessment Generation State (Phase 3.3)
  const [generatingAssessmentId, setGeneratingAssessmentId] = React.useState<string | null>(null);
  const [activeAssessment, setActiveAssessment] = React.useState<AssessmentDraft | null>(null);
  const [assessmentGenError, setAssessmentGenError] = React.useState<string | null>(null);

  const handleGenerateLesson = async (mat: TeacherMaterial) => {
    setGeneratingLessonId(mat.id);
    setLessonGenError(null);
    try {
      const res = await generateLessonDraft(mat.id);
      setActiveDraft(res.draft);
    } catch (err) {
      setLessonGenError(err instanceof Error ? err.message : "Failed to generate lesson draft.");
    } finally {
      setGeneratingLessonId(null);
    }
  };

  const handleGenerateAssessment = async (mat: TeacherMaterial) => {
    setGeneratingAssessmentId(mat.id);
    setAssessmentGenError(null);
    try {
      const res = await generateAssessment({
        materialId: mat.id,
        contentType: "PRACTICE",
        gameFormat: "MULTIPLE_CHOICE",
        difficulty: "MEDIUM",
        questionCount: 5,
      });
      setActiveAssessment(res.assessment);
    } catch (err) {
      setAssessmentGenError(err instanceof Error ? err.message : "Failed to generate assessment.");
    } finally {
      setGeneratingAssessmentId(null);
    }
  };

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // 1. Load Curriculum Metadata and Teacher's Materials
  const loadMaterials = React.useCallback(async () => {
    setLoadingList(true);
    setListError("");
    try {
      const res = await fetchTeacherMaterials();
      setMaterials(res.materials || []);
      if (res.storageMode) {
        setStorageMode(res.storageMode);
      }
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Failed to load materials");
    } finally {
      setLoadingList(false);
    }
  }, []);


  React.useEffect(() => {
    void loadMaterials();
    fetchCurriculumMetadata()
      .then((meta) => {
        setCurriculum(meta);
      })
      .catch((err) => {
        console.warn("Could not load curriculum metadata:", err);
      });
  }, [loadMaterials]);

  // Dependent subject suggestions
  const subjectSuggestions = React.useMemo(() => {
    if (educationLevel === "school") {
      const clsNum = parseInt(classGrade, 10);
      if (clsNum >= 11) {
        if (stream === "commerce") {
          return curriculum?.schoolSubjectsByLevel?.higher_secondary_commerce || [
            "Accountancy",
            "Business Studies",
            "Economics",
            "Applied Mathematics",
          ];
        }
        if (stream === "arts") {
          return curriculum?.schoolSubjectsByLevel?.higher_secondary_arts || [
            "History",
            "Political Science",
            "Geography",
            "Economics",
          ];
        }
        return curriculum?.schoolSubjectsByLevel?.higher_secondary || [
          "Physics",
          "Chemistry",
          "Mathematics",
          "Biology",
          "Computer Science",
        ];
      }
      if (clsNum >= 9) {
        return curriculum?.schoolSubjectsByLevel?.secondary || [
          "Mathematics",
          "Science",
          "Social Science",
          "English",
        ];
      }
      if (clsNum >= 6) {
        return curriculum?.schoolSubjectsByLevel?.middle || [
          "Mathematics",
          "Science",
          "Social Science",
          "English",
          "Hindi",
        ];
      }
      return curriculum?.schoolSubjectsByLevel?.primary || [
        "Mathematics",
        "Environmental Studies (EVS)",
        "English",
        "Hindi",
      ];
    } else {
      // Diploma
      const branchKey = branch.toLowerCase();
      const semKey = semester;
      const semMap = curriculum?.diplomaSubjectsByBranchAndSem?.[branchKey];
      if (semMap && semMap[semKey]) {
        return semMap[semKey];
      }
      return [
        "Applied Mathematics",
        "Applied Physics",
        "Applied Chemistry",
        "Programming in C",
        "Data Structures",
        "Computer Networks",
        "Database Management",
      ];
    }
  }, [educationLevel, classGrade, stream, branch, semester, curriculum]);

  // Adjust default subject if needed
  React.useEffect(() => {
    if (subjectSuggestions.length > 0 && !subjectSuggestions.includes(subjectName)) {
      setSubjectName(subjectSuggestions[0]);
    }
  }, [subjectSuggestions, subjectName]);

  // Validate File Selection
  function validateAndSetFile(file: File) {
    setFileError("");
    setUploadError("");
    setUploadSuccess(null);

    // 1. Check size limit
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFileError(
        `File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum allowed size is 15 MB.`
      );
      setSelectedFile(null);
      return;
    }

    // 2. Check empty file
    if (file.size === 0) {
      setFileError("Selected file is empty (0 bytes). Please upload a valid document or image.");
      setSelectedFile(null);
      return;
    }

    // 3. Check extension
    const extMatch = file.name.match(/\.[0-9a-z]+$/i);
    const ext = extMatch ? extMatch[0].toLowerCase() : "";
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setFileError(
        `Unsupported file type "${ext || "unknown"}". Allowed formats: PDF, DOCX, TXT, PNG, JPG/JPEG.`
      );
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  }

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFileError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Upload Submission Handler
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setFileError("Please select a file to upload.");
      return;
    }

    const finalSubject = customSubject.trim() ? customSubject.trim() : subjectName;
    if (!finalSubject) {
      setUploadError("Please provide a subject name.");
      return;
    }

    setUploading(true);
    setUploadProgress(10);
    setUploadError("");
    setUploadSuccess(null);

    // Progress animation
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) return prev;
        return prev + 15;
      });
    }, 150);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("educationLevel", educationLevel);
      formData.append("language", language);
      formData.append("subjectName", finalSubject);

      if (educationLevel === "school") {
        formData.append("classGrade", classGrade);
        formData.append("board", board);
        if (parseInt(classGrade, 10) >= 11) {
          formData.append("stream", stream);
        }
      } else {
        formData.append("branch", branch);
        formData.append("scheme", scheme);
        formData.append("semester", semester);
      }

      if (chapterName.trim()) {
        formData.append("chapterName", chapterName.trim());
      }
      if (topicName.trim()) {
        formData.append("topicName", topicName.trim());
      }
      if (description.trim()) {
        formData.append("description", description.trim());
      }

      const res = await uploadTeacherMaterial(formData);

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (res.success && res.material) {
        setUploadSuccess(res.material);
        handleRemoveFile();
        setCustomSubject("");
        setChapterName("");
        setTopicName("");
        setDescription("");
        await loadMaterials();
      } else {
        throw new Error(res.message || "Upload completed with an unexpected response.");
      }
    } catch (err) {
      clearInterval(progressInterval);
      setUploadError(err instanceof Error ? err.message : "Upload failed. Please check your network and retry.");
    } finally {
      setUploading(false);
    }
  };

  // Delete Material Handler
  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setConfirmDeleteId(null);
    try {
      await deleteTeacherMaterial(id);
      setMaterials((prev) => prev.filter((m) => m.id !== id));
      if (selectedDetails?.id === id) {
        setSelectedDetails(null);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete material.");
    } finally {
      setDeletingId(null);
    }
  };


  // Filtered Materials for List View
  const filteredMaterials = React.useMemo(() => {
    return materials.filter((m) => {
      if (filterLevel !== "all" && m.educationLevel !== filterLevel) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchName = m.originalName.toLowerCase().includes(query);
        const matchSubject = m.subjectName.toLowerCase().includes(query);
        const matchTopic = (m.topicName || "").toLowerCase().includes(query);
        const matchChapter = (m.chapterName || "").toLowerCase().includes(query);
        if (!matchName && !matchSubject && !matchTopic && !matchChapter) {
          return false;
        }
      }
      return true;
    });
  }, [materials, filterLevel, searchQuery]);

  // Icon helper
  function getFileIcon(ext?: string | null) {
    const e = (ext ?? "").toLowerCase();
    if (e === ".pdf") return <FileText className="w-5 h-5 text-rose-500" />;
    if (e === ".docx") return <FileText className="w-5 h-5 text-blue-500" />;
    if (e === ".txt") return <FileCode className="w-5 h-5 text-amber-500" />;
    if (e === ".png" || e === ".jpg" || e === ".jpeg") {
      return <ImageIcon className="w-5 h-5 text-emerald-500" />;
    }
    return <FileText className="w-5 h-5 text-muted-foreground" />;
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "READY":
        return <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">Ready</Badge>;
      case "PROCESSING":
        return <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">Processing</Badge>;
      case "FAILED":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">Uploaded</Badge>;
    }
  }

  if (activeDraft) {
    return (
      <LessonDraftEditor
        draft={activeDraft}
        onBack={() => {
          setActiveDraft(null);
          void loadMaterials();
        }}
        onDraftUpdated={(updated) => {
          setActiveDraft(updated);
        }}
      />
    );
  }

  if (activeAssessment) {
    return (
      <AssessmentEditor
        assessment={activeAssessment}
        onBack={() => {
          setActiveAssessment(null);
          void loadMaterials();
        }}
        onAssessmentUpdated={(updated) => {
          setActiveAssessment(updated);
        }}
      />
    );
  }

  return (
    <div className="grid gap-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-primary" />
            Teacher Content Upload
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Securely upload and organize syllabus notes, textbooks, and problem sheets for your curriculum.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Badge variant="outline" className="text-xs gap-1 py-1 px-2.5">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
            Isolated Storage
          </Badge>
          <Badge variant="outline" className="text-xs gap-1 py-1 px-2.5">
            <HardDrive className="w-3.5 h-3.5 text-primary" />
            15MB Max / File
          </Badge>
        </div>
      </div>

      {/* Lesson Generation Error Alert */}
      {lessonGenError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1">{lessonGenError}</span>
          <button
            onClick={() => setLessonGenError(null)}
            className="text-xs font-semibold hover:opacity-80"
          >
            ×
          </button>
        </div>
      )}

      {/* Ephemeral Mode Warning if MongoDB is offline in development */}
      {storageMode === "in_memory_ephemeral" && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Development Ephemeral Storage Active</p>
            <p className="text-[11px] opacity-90 mt-0.5">
              MongoDB database is offline. Materials uploaded in this session are held in ephemeral memory and will NOT persist across backend server restarts. Connect MongoDB to enable persistent database storage.
            </p>
          </div>
        </div>
      )}

      {/* Grid: Left side upload form & dropzone, Right side list of uploads */}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Upload Form Column (5 cols on large) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-primary" />
                Upload New Document
              </CardTitle>
              <CardDescription className="text-xs">
                Supports PDF, DOCX, TXT, PNG, and JPEG source materials.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUploadSubmit} className="space-y-4">
                {/* Drag and Drop Zone */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "relative border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all duration-200",
                    dragActive
                      ? "border-primary bg-primary/5 scale-[1.01]"
                      : "border-border/70 hover:border-primary/50 hover:bg-muted/30",
                    selectedFile ? "bg-primary/5 border-primary/40" : ""
                  )}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/png,image/jpeg"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={uploading}
                  />

                  {selectedFile ? (
                    <div className="flex flex-col items-center justify-center space-y-2 py-1">
                      <div className="p-2.5 rounded-full bg-background border border-primary/30 shadow-xs">
                        {getFileIcon("." + selectedFile.name.split(".").pop())}
                      </div>
                      <div className="max-w-[240px] text-center">
                        <p className="text-xs font-semibold text-foreground truncate" title={selectedFile.name}>
                          {selectedFile.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {(selectedFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFile();
                        }}
                        disabled={uploading}
                        className="h-6 text-[11px] text-destructive hover:text-destructive px-2"
                      >
                        <X className="w-3 h-3 mr-1" />
                        Remove file
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center space-y-2 py-2">
                      <div className="p-3 rounded-full bg-primary/10 text-primary">
                        <UploadCloud className="w-6 h-6" />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs font-medium text-foreground">
                          <span className="text-primary font-semibold">Click to browse</span> or drag & drop
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          PDF, Word (.docx), Text (.txt), or Images (PNG, JPG) up to 15MB
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* File Error Notice */}
                {fileError && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{fileError}</span>
                  </div>
                )}

                {/* Curriculum Metadata Fields */}
                <div className="space-y-3 pt-1 border-t border-border/40">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-primary" />
                      Curriculum Alignment
                    </span>
                    {/* Education Level Toggle */}
                    <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/40">
                      <button
                        type="button"
                        onClick={() => setEducationLevel("school")}
                        className={cn(
                          "px-2 py-0.5 text-[11px] font-medium rounded-md transition-all",
                          educationLevel === "school"
                            ? "bg-background shadow-xs text-foreground font-semibold"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        School (1-12)
                      </button>
                      <button
                        type="button"
                        onClick={() => setEducationLevel("diploma")}
                        className={cn(
                          "px-2 py-0.5 text-[11px] font-medium rounded-md transition-all",
                          educationLevel === "diploma"
                            ? "bg-background shadow-xs text-foreground font-semibold"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        Diploma
                      </button>
                    </div>
                  </div>

                  {/* School Fields */}
                  {educationLevel === "school" ? (
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-muted-foreground">Class / Grade *</label>
                        <select
                          value={classGrade}
                          onChange={(e) => setClassGrade(e.target.value)}
                          className="w-full h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((c) => (
                            <option key={c} value={c}>Class {c}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-muted-foreground">Board / Council *</label>
                        <select
                          value={board}
                          onChange={(e) => setBoard(e.target.value)}
                          className="w-full h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <option value="cbse">CBSE (National)</option>
                          <option value="icse">ICSE / ISC</option>
                          <option value="msbshse">MSBSHSE (Maharashtra)</option>
                          <option value="state">State Board (General)</option>
                        </select>
                      </div>

                      {parseInt(classGrade, 10) >= 11 && (
                        <div className="col-span-2 space-y-1">
                          <label className="text-[11px] font-medium text-muted-foreground">Stream *</label>
                          <select
                            value={stream}
                            onChange={(e) => setStream(e.target.value)}
                            className="w-full h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            <option value="science">Science</option>
                            <option value="commerce">Commerce</option>
                            <option value="arts">Arts / Humanities</option>
                            <option value="general">General / Common</option>
                          </select>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Diploma Fields */
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="col-span-2 space-y-1">
                        <label className="text-[11px] font-medium text-muted-foreground">Engineering Branch *</label>
                        <select
                          value={branch}
                          onChange={(e) => setBranch(e.target.value)}
                          className="w-full h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <option value="co">Computer Engineering (CO)</option>
                          <option value="if">Information Technology (IF)</option>
                          <option value="me">Mechanical Engineering (ME)</option>
                          <option value="ce">Civil Engineering (CE)</option>
                          <option value="ee">Electrical Engineering (EE)</option>
                          <option value="ej">Electronics & Telecomm (EJ)</option>
                          <option value="aiml">AI & Machine Learning (AIML)</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-muted-foreground">Scheme *</label>
                        <select
                          value={scheme}
                          onChange={(e) => setScheme(e.target.value)}
                          className="w-full h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <option value="k_scheme">K-Scheme (MSBTE NEP)</option>
                          <option value="i_scheme">I-Scheme (MSBTE)</option>
                          <option value="aicte">AICTE Model Curriculum</option>
                          <option value="autonomous">Autonomous / University</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-muted-foreground">Semester *</label>
                        <select
                          value={semester}
                          onChange={(e) => setSemester(e.target.value)}
                          className="w-full h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          {Array.from({ length: 8 }, (_, i) => String(i + 1)).map((s) => (
                            <option key={s} value={s}>Semester {s}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Subject Name with Suggestions */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-medium text-muted-foreground">Subject *</label>
                      <button
                        type="button"
                        onClick={() => {
                          if (customSubject) {
                            setCustomSubject("");
                          } else {
                            setCustomSubject(subjectName);
                          }
                        }}
                        className="text-[10px] text-primary hover:underline"
                      >
                        {customSubject ? "Choose from suggestions" : "+ Custom subject"}
                      </button>
                    </div>

                    {customSubject !== "" ? (
                      <Input
                        placeholder="e.g. Data Structures & Algorithms"
                        value={customSubject}
                        onChange={(e) => setCustomSubject(e.target.value)}
                        className="h-8 text-xs"
                      />
                    ) : (
                      <select
                        value={subjectName}
                        onChange={(e) => setSubjectName(e.target.value)}
                        className="w-full h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        {subjectSuggestions.map((sub) => (
                          <option key={sub} value={sub}>{sub}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Chapter and Topic */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground">Chapter / Unit</label>
                      <Input
                        placeholder="e.g. Chapter 4"
                        value={chapterName}
                        onChange={(e) => setChapterName(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground">Topic Name</label>
                      <Input
                        placeholder="e.g. Quadratic Equations"
                        value={topicName}
                        onChange={(e) => setTopicName(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  {/* Language & Description */}
                  <div className="grid grid-cols-1 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground">Content Language *</label>
                      <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="w-full h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        {LANGUAGES.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.flag} {l.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground">Optional Notes / Summary</label>
                      <textarea
                        rows={2}
                        placeholder="Brief overview of these notes for reference..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full rounded-md border border-input bg-background p-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Upload Progress Bar */}
                {uploading && (
                  <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Validating and uploading...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-200"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Error Banner */}
                {uploadError && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="space-y-1 flex-1">
                      <p>{uploadError}</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleUploadSubmit}
                        className="h-6 text-[11px] px-2 mt-1"
                      >
                        <RefreshCw className="w-3 h-3 mr-1" /> Retry Upload
                      </Button>
                    </div>
                  </div>
                )}

                {/* Success Banner */}
                {uploadSuccess && (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-600 dark:text-emerald-400 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Upload Successful!</p>
                      <p className="text-[11px] opacity-90 mt-0.5">
                        &quot;{uploadSuccess.originalName}&quot; ({uploadSuccess.formattedSize}) stored and ready.
                      </p>
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={uploading || !selectedFile || !!fileError}
                  className="w-full text-xs h-9 gap-1.5 font-medium"
                >
                  {uploading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Uploading Material...
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-3.5 h-3.5" />
                      Upload Learning Material
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Uploaded Materials List Column (7 cols on large) */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-primary" />
                    Your Learning Materials
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {materials.length} material{materials.length === 1 ? "" : "s"} uploaded to your teacher account.
                  </CardDescription>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadMaterials}
                  disabled={loadingList}
                  className="h-7 text-xs self-start sm:self-auto gap-1"
                >
                  <RefreshCw className={cn("w-3 h-3", loadingList && "animate-spin")} />
                  Refresh
                </Button>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input
                    placeholder="Search by file name or subject..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 pl-8 text-xs"
                  />
                </div>

                <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/40 shrink-0">
                  <button
                    type="button"
                    onClick={() => setFilterLevel("all")}
                    className={cn(
                      "px-2.5 py-1 text-[11px] font-medium rounded-md transition-all",
                      filterLevel === "all"
                        ? "bg-background shadow-xs text-foreground font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    All ({materials.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterLevel("school")}
                    className={cn(
                      "px-2.5 py-1 text-[11px] font-medium rounded-md transition-all",
                      filterLevel === "school"
                        ? "bg-background shadow-xs text-foreground font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    School
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterLevel("diploma")}
                    className={cn(
                      "px-2.5 py-1 text-[11px] font-medium rounded-md transition-all",
                      filterLevel === "diploma"
                        ? "bg-background shadow-xs text-foreground font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Diploma
                  </button>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {(lessonGenError || assessmentGenError) && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive flex items-start gap-2 mb-3">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{lessonGenError || assessmentGenError}</span>
                </div>
              )}

              {loadingList ? (
                <div className="flex flex-col items-center justify-center py-10 space-y-2 text-muted-foreground">
                  <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                  <p className="text-xs">Loading your uploaded materials...</p>
                </div>
              ) : listError ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Failed to load materials</p>
                    <p className="text-[11px] opacity-90 mt-0.5">{listError}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadMaterials}
                      className="h-6 text-[11px] px-2 mt-2"
                    >
                      Retry
                    </Button>
                  </div>
                </div>
              ) : filteredMaterials.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                  <div className="p-3 rounded-full bg-muted/60 text-muted-foreground">
                    <FolderOpen className="w-8 h-8 opacity-60" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">
                      {materials.length === 0 ? "No materials uploaded yet" : "No matching materials found"}
                    </p>
                    <p className="text-xs text-muted-foreground max-w-sm">
                      {materials.length === 0
                        ? "Upload your syllabus notes, question banks, or textbooks using the form on the left."
                        : "Try adjusting your search query or education level filter."}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredMaterials.map((mat) => (
                    <div
                      key={mat.id}
                      className="rounded-xl border border-border/70 bg-card p-3.5 hover:border-border transition-all space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="p-2 rounded-lg bg-muted/50 border border-border/50 shrink-0 mt-0.5">
                            {getFileIcon(mat.extension || (mat.originalName?.includes(".") ? mat.originalName.slice(mat.originalName.lastIndexOf(".")) : ""))}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-semibold text-foreground truncate" title={mat.originalName}>
                              {mat.originalName}
                            </h4>
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                              <span>{mat.formattedSize}</span>
                              <span>·</span>
                              <span>{mat.subjectName}</span>
                              {mat.topicName && (
                                <>
                                  <span>·</span>
                                  <span className="truncate max-w-[140px]">{mat.topicName}</span>
                                </>
                              )}
                              <span>·</span>
                              <span>{new Date(mat.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {getStatusBadge(mat.status)}
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={generatingLessonId === mat.id || generatingAssessmentId === mat.id}
                            onClick={() => handleGenerateLesson(mat)}
                            className="h-7 text-xs px-2.5 gap-1.5 text-primary border-primary/30 hover:bg-primary/10 font-medium"
                            title="Generate AI Lesson from this material"
                          >
                            <Sparkles className={cn("w-3.5 h-3.5", generatingLessonId === mat.id && "animate-spin")} />
                            {generatingLessonId === mat.id ? "Generating…" : "Lesson"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={generatingAssessmentId === mat.id || generatingLessonId === mat.id}
                            onClick={() => handleGenerateAssessment(mat)}
                            className="h-7 text-xs px-2.5 gap-1.5 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 font-medium"
                            title="Generate Practice Questions & Assessment from this material"
                          >
                            <Gamepad2 className={cn("w-3.5 h-3.5", generatingAssessmentId === mat.id && "animate-spin")} />
                            {generatingAssessmentId === mat.id ? "Generating…" : "Assessment"}
                          </Button>
                          {confirmDeleteId === mat.id ? (
                            <div className="flex items-center gap-1 bg-destructive/10 border border-destructive/30 rounded-lg p-1 text-[11px]">
                              <span className="text-destructive font-medium px-1 text-[10px]">Delete?</span>
                              <Button
                                variant="destructive"
                                size="sm"
                                className="h-6 px-2 text-[10px]"
                                disabled={deletingId === mat.id}
                                onClick={() => handleDelete(mat.id)}
                              >
                                Yes
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-1.5 text-[10px]"
                                onClick={() => setConfirmDeleteId(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={deletingId === mat.id}
                              onClick={() => setConfirmDeleteId(mat.id)}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                              title="Delete material"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>


                      {/* Curriculum Chips */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/40 text-[10px]">
                        <Badge variant="outline" className="text-[10px] font-normal py-0">
                          {mat.educationLevel === "school" ? "School" : "Diploma"}
                        </Badge>
                        {mat.classGrade && (
                          <Badge variant="outline" className="text-[10px] font-normal py-0">
                            Class {mat.classGrade}
                          </Badge>
                        )}
                        {mat.board && (
                          <Badge variant="outline" className="text-[10px] font-normal py-0 uppercase">
                            {mat.board}
                          </Badge>
                        )}
                        {mat.stream && mat.stream !== "general" && (
                          <Badge variant="outline" className="text-[10px] font-normal py-0 capitalize">
                            {mat.stream}
                          </Badge>
                        )}
                        {mat.branch && (
                          <Badge variant="outline" className="text-[10px] font-normal py-0 uppercase">
                            Branch: {mat.branch}
                          </Badge>
                        )}
                        {mat.scheme && (
                          <Badge variant="outline" className="text-[10px] font-normal py-0">
                            {mat.scheme.replace("_", "-").toUpperCase()}
                          </Badge>
                        )}
                        {mat.semester && (
                          <Badge variant="outline" className="text-[10px] font-normal py-0">
                            Sem {mat.semester}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[10px] font-normal py-0 uppercase">
                          {mat.language}
                        </Badge>

                        {/* Checksum snippet */}
                        <span className="ml-auto text-[10px] text-muted-foreground font-mono truncate max-w-[150px]" title={`SHA256: ${mat.checksum}`}>
                          sha256:{mat.checksum.slice(0, 10)}…
                        </span>
                      </div>

                      {mat.description && (
                        <p className="text-[11px] text-muted-foreground line-clamp-2 bg-muted/20 rounded p-1.5">
                          {mat.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
