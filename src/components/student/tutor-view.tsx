"use client";

import * as React from "react";
import Link from "next/link";
import {
  Sparkles,
  Plus,
  History,
  RotateCcw,
  Send,
  Trash2,
  ChevronDown,
  ChevronUp,
  Check,
  Copy,
  Info,
  Globe,
  SlidersHorizontal,
  Bot,
  User,
  Lightbulb,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Video,
  X,
  Eye,
  EyeOff,
  HelpCircle,
  Paperclip,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RequireStudent } from "@/components/student/require-student";
import { TutorMarkdown } from "@/components/student/tutor-markdown";
import { renderTopicDiagram } from "@/components/student/tutor-visuals";
import {
  apiFetch,
  type TutorResponse,
  type TutorConversationSummary,
  type TutorMessage,
  type TutorVideoContext,
} from "@/lib/api";
import {
  SUPPORTED_LANGUAGES,
  GRADE_LEVELS,
  TEACHING_STYLES,
  type LanguageCode,
} from "@/lib/tutor-languages";

// Other Indian languages offered in the tutor's "Other" dropdown (the 22 scheduled languages of India).
// "locale" is the browser speech locale for voice input / read-aloud; where a browser has no voice
// for a language, a close fallback is used.
interface IndianLanguage {
  code: string;
  name: string;
  nativeName: string;
  locale: string;
}

const OTHER_INDIAN_LANGUAGES: IndianLanguage[] = [
  { code: "as", name: "Assamese", nativeName: "অসমীয়া", locale: "as-IN" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা", locale: "bn-IN" },
  { code: "brx", name: "Bodo", nativeName: "बड़ो", locale: "hi-IN" },
  { code: "doi", name: "Dogri", nativeName: "डोगरी", locale: "hi-IN" },
  { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી", locale: "gu-IN" },
  { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ", locale: "kn-IN" },
  { code: "ks", name: "Kashmiri", nativeName: "کٲشُر", locale: "ur-IN" },
  { code: "kok", name: "Konkani", nativeName: "कोंकणी", locale: "mr-IN" },
  { code: "mai", name: "Maithili", nativeName: "मैथिली", locale: "hi-IN" },
  { code: "ml", name: "Malayalam", nativeName: "മലയാളം", locale: "ml-IN" },
  { code: "mni", name: "Manipuri (Meitei)", nativeName: "ꯃꯩꯇꯩꯂꯣꯟ", locale: "bn-IN" },
  { code: "ne", name: "Nepali", nativeName: "नेपाली", locale: "ne-NP" },
  { code: "or", name: "Odia", nativeName: "ଓଡ଼ିଆ", locale: "or-IN" },
  { code: "pa", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ", locale: "pa-IN" },
  { code: "sa", name: "Sanskrit", nativeName: "संस्कृतम्", locale: "hi-IN" },
  { code: "sat", name: "Santali", nativeName: "ᱥᱟᱱᱛᱟᱲᱤ", locale: "bn-IN" },
  { code: "sd", name: "Sindhi", nativeName: "سنڌي", locale: "ur-IN" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்", locale: "ta-IN" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు", locale: "te-IN" },
  { code: "ur", name: "Urdu", nativeName: "اردو", locale: "ur-IN" },
];

// Speech recognition type polyfill for Web Speech API
interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
}

const VIDEO_DOUBT_PROMPTS: Record<
  LanguageCode,
  { label: string; prompt: (title: string) => string }[]
> = {
  en: [
    { label: "Explain Simpler", prompt: (t) => `Can you explain the main concept of "${t}" in simpler everyday terms?` },
    { label: "Real-Life Example", prompt: (t) => `Give me a relatable real-life example to understand "${t}".` },
    { label: "Step-by-Step", prompt: (t) => `Break down "${t}" into clear, numbered steps.` },
    { label: "Practice Question", prompt: (t) => `Give me a quick understanding check question based on "${t}".` },
    { label: "Key Summary", prompt: (t) => `What is the most important lesson takeaway from "${t}"?` },
  ],
  hi: [
    { label: "सरल भाषा में समझाएं", prompt: (t) => `कृपया "${t}" की मुख्य बात को और सरल भाषा में समझाएं।` },
    { label: "दैनिक उदाहरण", prompt: (t) => `"${t}" को समझने के लिए हमारे दैनिक जीवन से एक अच्छा उदाहरण दें।` },
    { label: "चरण-दर-चरण", prompt: (t) => `"${t}" को छोटे-छोटे चरणों (Step-by-step) में समझाएं।` },
    { label: "अभ्यास प्रश्न", prompt: (t) => `"${t}" पर मेरी समझ जांचने के लिए एक अभ्यास प्रश्न पूछें।` },
    { label: "मुख्य सारांश", prompt: (t) => `"${t}" से मुझे क्या मुख्य बात हमेशा याद रखनी चाहिए?` },
  ],
  mr: [
    { label: "सोप्या भाषेत सांगा", prompt: (t) => `कृपया "${t}" ची संकल्पना आणखी सोप्या मराठीत समजवून सांगा.` },
    { label: "रोजचे उदाहरण", prompt: (t) => `"${t}" समजण्यासाठी दैनंदिन जीवनातील एक सोपे उदाहरण द्या.` },
    { label: "टप्प्याटप्प्याने सांगा", prompt: (t) => `"${t}" चे स्पष्टीकरण टप्प्याटप्प्याने (Step-by-step) द्या.` },
    { label: "सराव प्रश्न", prompt: (t) => `"${t}" वर मला समजले की नाही हे तपासण्यासाठी एक प्रश्न विचारा.` },
    { label: "महत्त्वाचा सारांश", prompt: (t) => `"${t}" चा सर्वात महत्त्वाचा मुद्दा काय आहे?` },
  ],
  te: [
    { label: "సులభంగా వివరించండి", prompt: (t) => `దయచేసి "${t}" అంశాన్ని మరింత సరళమైన తెలుగులో వివరించండి.` },
    { label: "నిజ జీవిత ఉదాహరణ", prompt: (t) => `"${t}" అర్థం చేసుకోవడానికి మన నిత్య జీవితం నుండి ఒక ఉదాహరణ ఇవ్వండి.` },
    { label: "దశలవారీగా", prompt: (t) => `"${t}" ను చిన్న చిన్న దశలుగా విభజించి చెప్పండి.` },
    { label: "అభ్యాస ప్రశ్న", prompt: (t) => `"${t}" పై నాకు ఎంత అర్థమైందో పరీక్షించడానికి ఒక ప్రశ్న అడగండి.` },
    { label: "ముఖ్య సారాంశం", prompt: (t) => `"${t}" లో నేను గుర్తుంచుకోవాల్సిన అతి ముఖ్యమైన విషయం ఏమిటి?` },
  ],
};

function cleanMarkdownForSpeech(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/\[([^\]]+)\]\(.*?\)/g, "$1")
    .replace(/[#*_~>]/g, "")
    .replace(/\n+/g, " ")
    .trim();
}

export interface TutorTopicContext {
  topic?: string;
  subject?: string;
  chapter?: string;
  board?: string;
  classGrade?: string;
  grade?: string;
  educationLevel?: string;
  stream?: string;
  branch?: string;
  scheme?: string;
  semester?: string;
  title?: string;
  videoId?: string;
}

export interface TutorViewProps {
  initialContext?: TutorTopicContext | null;
  embedded?: boolean;
}

export function TutorView({ initialContext, embedded = false }: TutorViewProps = {}) {
  const [language, setLanguage] = React.useState<LanguageCode>(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("lucous_tutor_lang") as LanguageCode | null;
      if (saved && SUPPORTED_LANGUAGES[saved]) return saved;
    }
    return "en";
  });
  // "Other" Indian language chosen from the dropdown (null = one of the four built-in languages).
  const [otherLang, setOtherLang] = React.useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("lucous_tutor_other_lang");
      if (saved && saved !== "te" && OTHER_INDIAN_LANGUAGES.some((l) => l.code === saved)) return saved;
    }
    return null;
  });
  const [messages, setMessages] = React.useState<TutorMessage[]>([]);
  const [conversationId, setConversationId] = React.useState<string | null>(null);
  const [conversations, setConversations] = React.useState<TutorConversationSummary[]>([]);
  const [input, setInput] = React.useState("");
  const [attachments, setAttachments] = React.useState<File[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [loading, setLoading] = React.useState(false);
  const [historyLoading, setHistoryLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);
  const [configured, setConfigured] = React.useState<boolean | null>(null);

  // Phase 2: Video context state
  const [videoContext, setVideoContext] = React.useState<TutorVideoContext | null>(null);

  // Phase 2: Speech Recognition (Voice Input)
  const [speechSupported, setSpeechSupported] = React.useState(false);
  const [isListening, setIsListening] = React.useState(false);
  const [speechError, setSpeechError] = React.useState<string | null>(null);
  const recognitionRef = React.useRef<SpeechRecognitionInstance | null>(null);

  // Phase 2: Speech Synthesis (Spoken Output)
  const [synthSupported, setSynthSupported] = React.useState(false);
  const [speakingIndex, setSpeakingIndex] = React.useState<number | null>(null);

  // Phase 2: Visual Diagram display state (by message index)
  const [expandedDiagrams, setExpandedDiagrams] = React.useState<Record<number, boolean>>({});

  // Preferences
  const [grade, setGrade] = React.useState<string>(() => {
    if (typeof window !== "undefined") {
      return window.localStorage.getItem("lucous_tutor_grade") || "all";
    }
    return "all";
  });
  const [style, setStyle] = React.useState<string>(() => {
    if (typeof window !== "undefined") {
      return window.localStorage.getItem("lucous_tutor_style") || "adaptive";
    }
    return "adaptive";
  });
  const [showPreferences, setShowPreferences] = React.useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = React.useState(false);

  const endRef = React.useRef<HTMLDivElement | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  const activeLangConfig = SUPPORTED_LANGUAGES[language] || SUPPORTED_LANGUAGES.en;
  const otherLangInfo = otherLang ? OTHER_INDIAN_LANGUAGES.find((l) => l.code === otherLang) ?? null : null;

  // Initialize browser capabilities & read video URL params
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      // Check Speech Recognition capability
      const win = window as any;
      const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;
      if (SpeechRecognition) {
        setSpeechSupported(true);
      }

      // Check Speech Synthesis capability
      if ("speechSynthesis" in window) {
        setSynthSupported(true);
      }

      // Read optional video query parameters
      const params = new URLSearchParams(window.location.search);
      const vId = params.get("videoId");
      const vTitle = params.get("videoTitle");
      const vTopic = params.get("topic");
      const vLang = params.get("language");
      const vLevel = params.get("educationLevel");
      const vClass = params.get("classGrade");
      const vGrade = params.get("grade");
      const vBoard = params.get("board");
      const vStream = params.get("stream");
      const vBranch = params.get("branch");
      const vScheme = params.get("scheme");
      const vSem = params.get("semester");
      const vSubj = params.get("subject");
      const vChap = params.get("chapter");

      if (initialContext) {
        setVideoContext({
          videoId: initialContext.videoId,
          title: initialContext.title || initialContext.topic,
          topic: initialContext.topic,
          subject: initialContext.subject,
          chapter: initialContext.chapter,
          educationLevel: initialContext.educationLevel,
          classGrade: initialContext.classGrade,
          grade: initialContext.grade,
          board: initialContext.board,
          stream: initialContext.stream,
          branch: initialContext.branch,
          scheme: initialContext.scheme,
          semester: initialContext.semester,
        });

        if (initialContext.educationLevel === "diploma") {
          setGrade("diploma");
        } else if (initialContext.educationLevel === "primary") {
          setGrade("primary");
        } else if (initialContext.educationLevel === "middle") {
          setGrade("middle");
        } else if (initialContext.educationLevel === "secondary") {
          setGrade("secondary");
        } else if (initialContext.educationLevel === "higher_secondary") {
          setGrade("senior");
        }
      } else if (vId || vTitle || vTopic) {
        setVideoContext({
          videoId: vId || undefined,
          title: vTitle ? decodeURIComponent(vTitle) : (vTopic ? decodeURIComponent(vTopic) : undefined),
          topic: vTopic ? decodeURIComponent(vTopic) : undefined,
          educationLevel: vLevel || undefined,
          classGrade: vClass || undefined,
          grade: vGrade || undefined,
          board: vBoard || undefined,
          stream: vStream || undefined,
          branch: vBranch || undefined,
          scheme: vScheme || undefined,
          semester: vSem || undefined,
          subject: vSubj ? decodeURIComponent(vSubj) : undefined,
          chapter: vChap ? decodeURIComponent(vChap) : undefined,
        });

        if (vLevel === "diploma") {
          setGrade("diploma");
        } else if (vLevel === "primary") {
          setGrade("primary");
        } else if (vLevel === "middle") {
          setGrade("middle");
        } else if (vLevel === "secondary") {
          setGrade("secondary");
        } else if (vLevel === "higher_secondary") {
          setGrade("senior");
        }

        if (vLang && (vLang === "en" || vLang === "hi" || vLang === "mr" || vLang === "te")) {
          setLanguage(vLang as LanguageCode);
        }
      }
    }
  }, [initialContext]);

  // Cleanup speech synthesis on unmount
  React.useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, []);

  const prevTopicRef = React.useRef<string | undefined>(initialContext?.topic);
  React.useEffect(() => {
    if (initialContext?.topic && prevTopicRef.current && prevTopicRef.current !== initialContext.topic) {
      setConversationId(null);
      setMessages([]);
      setInput("");
      setError("");
    }
    prevTopicRef.current = initialContext?.topic;
  }, [initialContext?.topic]);

  // Fetch initial chat and conversations list
  React.useEffect(() => {
    let isMounted = true;

    if (!embedded) {
      apiFetch<{
        configured: boolean;
        conversationId: string | null;
        messages: TutorMessage[];
      }>("/ai/tutor")
        .then((data) => {
          if (!isMounted) return;
          if (typeof data.configured === "boolean") {
            setConfigured(data.configured);
          }
          if (data.conversationId) {
            setConversationId(data.conversationId);
          }
          if (Array.isArray(data.messages)) {
            setMessages(data.messages);
          }
        })
        .catch(() => {});
    }

    loadConversations();

    return () => {
      isMounted = false;
    };
  }, [embedded]);

  // Auto-scroll on new message
  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Adjust textarea height dynamically
  React.useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        180
      )}px`;
    }
  }, [input]);

  async function loadConversations() {
    setHistoryLoading(true);
    try {
      const data = await apiFetch<{
        conversations: TutorConversationSummary[];
      }>("/ai/tutor/conversations");
      if (Array.isArray(data.conversations)) {
        setConversations(data.conversations);
      }
    } catch {
    } finally {
      setHistoryLoading(false);
    }
  }

  function handleSelectLanguage(newLang: LanguageCode) {
    setLanguage(newLang);
    setOtherLang(null);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("lucous_tutor_lang", newLang);
      window.localStorage.removeItem("lucous_tutor_other_lang");
    }
    // Cancel speaking if language switches
    stopSpeaking();
  }

  // Language picked from the "Other" dropdown. Telugu has full built-in support; the rest keep the
  // English screen text and the AI Teacher is asked to reply in the chosen language.
  function handleSelectOther(code: string) {
    if (!code) return;
    if (code === "te") {
      handleSelectLanguage("te");
      return;
    }
    handleSelectLanguage("en");
    setOtherLang(code);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("lucous_tutor_other_lang", code);
    }
  }

  function handleSelectGrade(newGrade: string) {
    setGrade(newGrade);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("lucous_tutor_grade", newGrade);
    }
  }

  function handleSelectStyle(newStyle: string) {
    setStyle(newStyle);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("lucous_tutor_style", newStyle);
    }
  }

  function startNewConversation() {
    stopSpeaking();
    setConversationId(null);
    setMessages([]);
    setInput("");
    setError("");
    setExpandedDiagrams({});
    setIsHistoryOpen(false);
  }

  async function selectConversation(id: string) {
    if (id === conversationId) {
      setIsHistoryOpen(false);
      return;
    }
    stopSpeaking();
    setError("");
    setLoading(true);
    setExpandedDiagrams({});
    try {
      const data = await apiFetch<{
        configured: boolean;
        conversationId: string;
        messages: TutorMessage[];
      }>(`/ai/tutor?conversationId=${encodeURIComponent(id)}`);
      setConversationId(data.conversationId);
      setMessages(data.messages || []);
      if (typeof data.configured === "boolean") {
        setConfigured(data.configured);
      }
      setIsHistoryOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load conversation");
    } finally {
      setLoading(false);
    }
  }

  async function deleteConversation(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    try {
      await apiFetch(`/ai/tutor/conversations/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (conversationId === id) {
        startNewConversation();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete conversation");
    }
  }

  // ---- Multi-file attach ----
  const MAX_FILES = 5;
  const MAX_FILE_BYTES = 5 * 1024 * 1024;
  const MAX_FILE_CHARS = 3000;
  const TEXT_EXT = /\.(txt|md|csv|json|xml|html|css|js|ts|tsx|jsx|py|java|c|cpp|sql)$/i;

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (picked.length === 0) return;
    setError("");
    setAttachments((prev) => {
      const next = [...prev];
      for (const f of picked) {
        if (f.size > MAX_FILE_BYTES) {
          setError(`"${f.name}" is larger than 5 MB and was skipped.`);
          continue;
        }
        if (next.some((x) => x.name === f.name && x.size === f.size && x.lastModified === f.lastModified)) continue;
        if (next.length >= MAX_FILES) {
          setError(`You can attach up to ${MAX_FILES} files at a time.`);
          break;
        }
        next.push(f);
      }
      return next;
    });
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  // Text-based files are read and sent with the question; other files are listed by name only.
  async function readAttachments(files: File[]): Promise<string> {
    const blocks: string[] = [];
    for (const f of files) {
      if (f.type.startsWith("text/") || TEXT_EXT.test(f.name)) {
        try {
          const raw = await f.text();
          const clipped = raw.length > MAX_FILE_CHARS ? raw.slice(0, MAX_FILE_CHARS) + "\n…(truncated)" : raw;
          blocks.push(`[Attached file: ${f.name}]\n${clipped}\n[End of file]`);
          continue;
        } catch {
          /* fall through to name-only */
        }
      }
      blocks.push(`[Attached file: ${f.name} (${f.type || "unknown type"}) - the student attached this file but its contents could not be read in chat]`);
    }
    return blocks.join("\n\n");
  }

  async function sendMessage(textToSend?: string) {
    const files = textToSend ? [] : attachments;
    const text =
      (textToSend ?? input).trim() ||
      (files.length > 0 ? "Please help me understand the attached file(s)." : "");
    if (!text || loading) return;

    stopSpeaking();
    setError("");
    setLoading(true);
    const shownText =
      files.length > 0 ? `${text}\n\n📎 ${files.map((f) => f.name).join(", ")}` : text;
    const userMsg: TutorMessage = { role: "user", content: shownText };
    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) {
      setInput("");
      setAttachments([]);
    }

    try {
      const fileText = files.length > 0 ? await readAttachments(files) : "";
      const d = await apiFetch<TutorResponse>("/ai/tutor", {
        method: "POST",
        body: {
          message:
            (fileText ? `${text}\n\n${fileText}` : text) +
            (otherLangInfo
              ? `\n\n(Please reply in ${otherLangInfo.name} — ${otherLangInfo.nativeName}.)`
              : ""),
          conversationId: conversationId ?? undefined,
          language,
          grade,
          style,
          curriculumContext: initialContext ? {
            topic: initialContext.topic,
            subject: initialContext.subject,
            chapter: initialContext.chapter,
            board: initialContext.board,
            classGrade: initialContext.classGrade || initialContext.grade,
            educationType: initialContext.educationLevel,
            branch: initialContext.branch,
            semester: initialContext.semester,
          } : (videoContext ? {
            topic: videoContext.topic,
            subject: videoContext.subject,
            chapter: videoContext.chapter,
            board: videoContext.board,
            classGrade: videoContext.classGrade || videoContext.grade,
            educationType: videoContext.educationLevel,
            branch: videoContext.branch,
            semester: videoContext.semester,
          } : undefined),
          videoContext: videoContext ? {
            videoId: videoContext.videoId,
            title: videoContext.title,
            topic: videoContext.topic,
            subject: videoContext.subject,
            chapter: videoContext.chapter,
            educationLevel: videoContext.educationLevel,
            classGrade: videoContext.classGrade,
            grade: videoContext.grade,
            board: videoContext.board,
            stream: videoContext.stream,
            branch: videoContext.branch,
            scheme: videoContext.scheme,
            semester: videoContext.semester,
          } : undefined,
        },
      });

      if (typeof d.configured === "boolean") {
        setConfigured(d.configured);
      }
      setConversationId(d.conversationId);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: d.reply,
          conversationId: d.conversationId,
          createdAt: new Date().toISOString(),
        },
      ]);

      void loadConversations();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "The AI teacher could not reply. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  }

  async function copyText(text: string, index: number) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      // Fallback
    }
  }

  // -------------------------------------------------------------------------
  // Speech Recognition (Voice Input) Handlers
  // -------------------------------------------------------------------------
  function toggleVoiceInput() {
    if (!speechSupported) return;

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    try {
      const win = window as any;
      const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;
      const recognition: SpeechRecognitionInstance = new SpeechRecognition();

      recognitionRef.current = recognition;
      recognition.continuous = false;
      recognition.interimResults = true;

      // Locale mapping per language
      const langLocales: Record<LanguageCode, string> = {
        en: "en-IN",
        hi: "hi-IN",
        mr: "mr-IN",
        te: "te-IN",
      };
      recognition.lang = otherLangInfo?.locale || langLocales[language] || "en-IN";

      setSpeechError(null);

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript.trim()) {
          setInput(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        if (event.error === "not-allowed") {
          setSpeechError("Microphone access was denied. Please allow microphone permissions in your browser.");
        } else if (event.error === "no-speech") {
          setSpeechError("No speech detected. Please try speaking again.");
        } else {
          setSpeechError(`Voice input error (${event.error}). You can continue using text input.`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err: unknown) {
      console.error("Failed to start voice recognition:", err);
      setSpeechError("Speech recognition is unavailable in this environment.");
      setIsListening(false);
    }
  }

  // -------------------------------------------------------------------------
  // Speech Synthesis (Spoken Response) Handlers
  // -------------------------------------------------------------------------
  function stopSpeaking() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingIndex(null);
  }

  function speakMessage(text: string, index: number) {
    if (!synthSupported) return;

    if (speakingIndex === index) {
      stopSpeaking();
      return;
    }

    stopSpeaking();

    const cleanText = cleanMarkdownForSpeech(text);
    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);

    // Language selection
    const voices = window.speechSynthesis.getVoices();
    const langCodes: Record<LanguageCode, string[]> = {
      hi: ["hi-in", "hi"],
      mr: ["mr-in", "mr", "hi-in", "hi"],
      te: ["te-in", "te"],
      en: ["en-in", "en-gb", "en-us", "en"],
    };

    const targetCodes = otherLangInfo
      ? [otherLangInfo.locale.toLowerCase(), otherLangInfo.code]
      : langCodes[language] || ["en"];
    let matchedVoice: SpeechSynthesisVoice | null = null;

    if (voices && voices.length > 0) {
      for (const code of targetCodes) {
        matchedVoice = voices.find((v) => v.lang.toLowerCase().replace("_", "-").startsWith(code)) || null;
        if (matchedVoice) break;
      }
    }

    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }
    utterance.lang = matchedVoice?.lang || targetCodes[0] || "en-US";
    utterance.rate = 0.95; // Slightly slower, clear pedagogical pace

    utterance.onend = () => {
      setSpeakingIndex(null);
    };

    utterance.onerror = () => {
      setSpeakingIndex(null);
    };

    setSpeakingIndex(index);
    window.speechSynthesis.speak(utterance);
  }

  function toggleDiagram(index: number) {
    setExpandedDiagrams((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  }

  const tutorBody = (
    <div className={cn(embedded ? "w-full space-y-4 p-0" : "container max-w-5xl mx-auto px-2 sm:px-4 py-4 sm:py-6 space-y-4")}>
        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="h-4 w-4" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-sans">
                {activeLangConfig.ui.tutorTitle}
              </h1>
              <Badge variant="outline" className="text-xs px-2 py-0.5 border-primary/30 text-primary font-medium">
                {otherLangInfo?.nativeName ?? activeLangConfig.nativeName}
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {activeLangConfig.ui.tutorSubtitle} • {activeLangConfig.tagline}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Language Switcher */}
            <div className="flex items-center rounded-lg border bg-muted/40 p-0.5 text-xs">
              {(["en", "hi", "mr"] as LanguageCode[]).map((code) => {
                const cfg = SUPPORTED_LANGUAGES[code];
                const isActive = language === code && !otherLang;
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => handleSelectLanguage(code)}
                    className={cn(
                      "px-2.5 py-1 rounded-md transition font-medium text-xs cursor-pointer",
                      isActive
                        ? "bg-background text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    title={cfg.name}
                  >
                    <span>{cfg.flag} </span>
                    <span>{cfg.nativeName}</span>
                  </button>
                );
              })}
              {/* Other Indian languages (includes Telugu) */}
              <select
                aria-label="Other languages"
                value={otherLang ?? (language === "te" ? "te" : "")}
                onChange={(e) => handleSelectOther(e.target.value)}
                className={cn(
                  "px-2 py-1 rounded-md transition font-medium text-xs cursor-pointer outline-none max-w-[130px]",
                  otherLang || language === "te"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "bg-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <option value="" className="bg-background text-foreground">
                  🌐 Other
                </option>
                {OTHER_INDIAN_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code} className="bg-background text-foreground">
                    {l.nativeName} ({l.name})
                  </option>
                ))}
              </select>
            </div>

            {/* Discussion History Drawer */}
            <Sheet open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsHistoryOpen(true)}
                className="h-8 gap-1.5 text-xs cursor-pointer"
              >
                <History className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{activeLangConfig.ui.history}</span>
                {conversations.length > 0 && (
                  <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                    {conversations.length}
                  </Badge>
                )}
              </Button>
              <SheetContent side="right" className="w-[320px] sm:w-[400px]">
                <SheetHeader>
                  <SheetTitle className="text-base font-semibold">
                    {activeLangConfig.ui.history}
                  </SheetTitle>
                  <SheetDescription className="text-xs text-muted-foreground">
                    Review and continue your past discussions
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-4 space-y-2 max-h-[80vh] overflow-y-auto pr-1">
                  {historyLoading ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">Loading discussions…</p>
                  ) : conversations.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-8 text-center">
                      {activeLangConfig.ui.noHistory}
                    </p>
                  ) : (
                    conversations.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => void selectConversation(c.id)}
                        className={cn(
                          "group flex items-start justify-between rounded-lg border p-2.5 text-left transition hover:bg-muted/70 cursor-pointer",
                          c.id === conversationId ? "border-primary bg-primary/5" : "border-border"
                        )}
                      >
                        <div className="space-y-1 pr-2 overflow-hidden flex-1">
                          <p className="text-xs font-medium text-foreground truncate">
                            {c.title}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {c.lastMessage}
                          </p>
                          <span className="text-[10px] text-muted-foreground/75 block">
                            {new Date(c.updatedAt).toLocaleDateString()} • {c.messageCount} msgs
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => void deleteConversation(e, c.id)}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition p-1"
                          title={activeLangConfig.ui.deleteChat}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </SheetContent>
            </Sheet>

            {/* New Discussion Button */}
            <Button
              variant="default"
              size="sm"
              onClick={startNewConversation}
              className="h-8 gap-1 text-xs cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{activeLangConfig.ui.newChat}</span>
            </Button>
          </div>
        </div>

        {/* Phase 2: Active Video Study Banner (When redirected from a video) */}
        {videoContext && (videoContext.title || videoContext.topic) && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 sm:p-4 space-y-3 transition">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary shrink-0">
                  <Video className="h-4 w-4" />
                </div>
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px] bg-background border-primary/30 text-primary">
                      Studying Video Lesson
                    </Badge>
                    {videoContext.educationLevel && (
                      <Badge variant="secondary" className="text-[10px] capitalize">
                        {videoContext.educationLevel === "diploma" ? "Diploma / Polytechnic" : videoContext.educationLevel.replace("_", " ")}
                      </Badge>
                    )}
                    {videoContext.branch && (
                      <Badge variant="secondary" className="text-[10px] uppercase">
                        {videoContext.branch}
                      </Badge>
                    )}
                    {videoContext.semester && (
                      <Badge variant="outline" className="text-[10px]">
                        Sem {videoContext.semester}
                      </Badge>
                    )}
                    {videoContext.classGrade && (
                      <Badge variant="outline" className="text-[10px]">
                        Class {videoContext.classGrade}
                      </Badge>
                    )}
                    {videoContext.board && videoContext.board !== "all" && (
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {videoContext.board}
                      </Badge>
                    )}
                    {(videoContext.subject || videoContext.topic) && (
                      <span className="text-xs text-muted-foreground">
                        {videoContext.subject || videoContext.topic}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-foreground line-clamp-1">
                    {videoContext.title || "Educational Lesson"}
                  </h3>
                  {videoContext.chapter && (
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      Chapter: {videoContext.chapter}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {videoContext.videoId && (
                  <Link
                    href={`/student/videos`}
                    className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                  >
                    <span>Library</span>
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => setVideoContext(null)}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-md"
                  title="Close Video Context"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Suggested quick doubt prompts for this video */}
            <div className="pt-1 border-t border-primary/10">
              <p className="text-[11px] text-muted-foreground mb-1.5 font-medium">
                Ask the AI Teacher about this video:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(VIDEO_DOUBT_PROMPTS[language] || VIDEO_DOUBT_PROMPTS.en).map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => void sendMessage(item.prompt(videoContext.title || videoContext.topic || "this lesson"))}
                    className="rounded-full border border-primary/30 bg-background px-2.5 py-1 text-xs text-foreground hover:bg-primary/10 transition cursor-pointer"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Unconfigured / Preview Notice Banner */}
        {configured === false && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
            <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium">{activeLangConfig.ui.unconfiguredBanner}</p>
            </div>
          </div>
        )}

        {/* Speech Error Banner (If microphone permission was denied) */}
        {speechError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2 text-xs text-destructive flex items-center justify-between gap-2">
            <span>{speechError}</span>
            <button
              type="button"
              onClick={() => setSpeechError(null)}
              className="text-destructive hover:opacity-80 p-0.5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Learning Preferences Accordion */}
        <div className="rounded-lg border bg-card text-card-foreground">
          <button
            type="button"
            onClick={() => setShowPreferences((p) => !p)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>{activeLangConfig.ui.preferences}</span>
              <span className="text-[11px] opacity-75">
                • {GRADE_LEVELS.find((g) => g.id === grade)?.label || "All Grades"} •{" "}
                {TEACHING_STYLES.find((s) => s.id === style)?.label || "Adaptive"}
              </span>
            </div>
            {showPreferences ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {showPreferences && (
            <div className="px-3 pb-3 pt-1 border-t grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">{activeLangConfig.ui.gradeLabel}</label>
                <div className="flex flex-wrap gap-1">
                  {GRADE_LEVELS.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => handleSelectGrade(g.id)}
                      className={cn(
                        "px-2 py-1 rounded-md border text-[11px] transition cursor-pointer",
                        grade === g.id
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">{activeLangConfig.ui.styleLabel}</label>
                <div className="flex flex-wrap gap-1">
                  {TEACHING_STYLES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSelectStyle(s.id)}
                      className={cn(
                        "px-2 py-1 rounded-md border text-[11px] transition cursor-pointer",
                        style === s.id
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:bg-muted"
                      )}
                      title={s.desc}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Chat Stream Main Card */}
        <Card className="min-h-[500px] flex flex-col justify-between shadow-xs border-border/80">
          <CardContent className="p-3 sm:p-4 flex-1 flex flex-col justify-between space-y-4">
            <div className="space-y-4 flex-1 overflow-y-auto max-h-[60vh] pr-1">
              {messages.length === 0 ? (
                /* Empty Chat: Welcome and Pedagogical Starter Prompts */
                <div className="py-8 sm:py-12 px-2 text-center space-y-6 max-w-2xl mx-auto">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mx-auto shadow-inner">
                    <Sparkles className="h-7 w-7" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground font-sans">
                      {activeLangConfig.ui.noMessagesTitle}
                    </h2>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      {activeLangConfig.ui.noMessagesSubtitle}
                    </p>
                  </div>

                  {/* Starter question cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left pt-2">
                    {activeLangConfig.starterQuestions.map((q, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => void sendMessage(q.text)}
                        className="group flex flex-col justify-between rounded-xl border border-border p-3 text-xs transition hover:border-primary/50 hover:bg-primary/5 cursor-pointer"
                      >
                        <div className="space-y-1">
                          <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">
                            {q.categoryLabel}
                          </span>
                          <p className="font-medium text-foreground group-hover:text-primary transition line-clamp-2 leading-relaxed">
                            {q.text}
                          </p>
                        </div>
                        <span className="text-[10px] text-muted-foreground pt-2">
                          Click to ask →
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                /* Message List */
                messages.map((m, i) => {
                  const isUser = m.role === "user";
                  const isSpeakingThis = speakingIndex === i;

                  // Check if this assistant message touches a concept with visual explanation
                  const topicDiagram = !isUser
                    ? renderTopicDiagram(m.content + " " + (videoContext?.topic || ""), language)
                    : null;
                  const showDiagram = !!expandedDiagrams[i];

                  return (
                    <div
                      key={i}
                      className={cn(
                        "flex gap-3",
                        isUser ? "justify-end" : "justify-start"
                      )}
                    >
                      {!isUser && (
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary mt-0.5">
                          <Bot className="h-4 w-4" />
                        </div>
                      )}

                      <div
                        className={cn(
                          "relative group max-w-[90%] sm:max-w-[82%] rounded-2xl px-4 py-3 text-sm transition-all",
                          isUser
                            ? "bg-primary text-primary-foreground rounded-tr-xs"
                            : "bg-muted/70 text-foreground border border-border/60 rounded-tl-xs"
                        )}
                      >
                        {isUser ? (
                          <p className="whitespace-pre-wrap leading-relaxed font-sans">{m.content}</p>
                        ) : (
                          <div className="space-y-3">
                            <TutorMarkdown content={m.content} />

                            {/* Phase 5: Inline Visual Diagram (if matched and toggled) */}
                            {showDiagram && topicDiagram && (
                              <div className="pt-2 border-t border-border/40">
                                {topicDiagram}
                              </div>
                            )}

                            {/* Action Bar (Audio speak, Visual diagram toggle, Copy) */}
                            <div className="flex items-center justify-between pt-1 border-t border-border/30 text-[11px] text-muted-foreground flex-wrap gap-2">
                              <span className="text-[10px] opacity-75">LUCOUS Teacher</span>

                              <div className="flex items-center gap-2">
                                {/* Visual Diagram toggle (if concept matches) */}
                                {topicDiagram && (
                                  <button
                                    type="button"
                                    onClick={() => toggleDiagram(i)}
                                    className="flex items-center gap-1 text-[10px] font-medium text-primary hover:underline p-0.5"
                                    title="View interactive visual diagram"
                                  >
                                    {showDiagram ? (
                                      <>
                                        <EyeOff className="h-3 w-3" />
                                        <span>Hide Visual</span>
                                      </>
                                    ) : (
                                      <>
                                        <Eye className="h-3 w-3" />
                                        <span>Visual Diagram</span>
                                      </>
                                    )}
                                  </button>
                                )}

                                {/* Spoken Response audio control (Phase 3) */}
                                {synthSupported && (
                                  <button
                                    type="button"
                                    onClick={() => speakMessage(m.content, i)}
                                    className={cn(
                                      "flex items-center gap-1 transition p-0.5 rounded-sm",
                                      isSpeakingThis
                                        ? "text-primary font-semibold animate-pulse"
                                        : "opacity-70 hover:opacity-100"
                                    )}
                                    title={isSpeakingThis ? "Stop speaking" : "Listen to explanation"}
                                  >
                                    {isSpeakingThis ? (
                                      <>
                                        <VolumeX className="h-3 w-3 text-destructive" />
                                        <span className="text-[10px] text-destructive">Stop</span>
                                      </>
                                    ) : (
                                      <>
                                        <Volume2 className="h-3 w-3" />
                                        <span className="text-[10px]">Listen</span>
                                      </>
                                    )}
                                  </button>
                                )}

                                {/* Copy button */}
                                <button
                                  type="button"
                                  onClick={() => copyText(m.content, i)}
                                  className="flex items-center gap-1 opacity-70 hover:opacity-100 transition p-0.5"
                                  title="Copy answer"
                                >
                                  {copiedIndex === i ? (
                                    <>
                                      <Check className="h-3 w-3 text-emerald-600" />
                                      <span className="text-[10px] text-emerald-600">Copied</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="h-3 w-3" />
                                      <span className="text-[10px]">Copy</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {isUser && (
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground mt-0.5">
                          <User className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {/* Loading Indicator */}
              {loading && (
                <div className="flex gap-3 items-start">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Bot className="h-4 w-4 animate-spin" />
                  </div>
                  <div className="rounded-2xl rounded-tl-xs bg-muted/70 border border-border/60 px-4 py-3 text-xs text-muted-foreground flex items-center gap-2">
                    <span className="flex h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
                    <span>{activeLangConfig.ui.thinking}</span>
                  </div>
                </div>
              )}

              {/* Quick Action Follow-Up Chips */}
              {messages.length > 0 && !loading && (
                <div className="pt-2">
                  <p className="text-[11px] text-muted-foreground mb-1.5 font-medium flex items-center gap-1">
                    <Lightbulb className="h-3 w-3 text-amber-500" />
                    <span>Explore further:</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {activeLangConfig.quickActions.map((qa) => (
                      <button
                        key={qa.id}
                        type="button"
                        onClick={() => void sendMessage(qa.prompt)}
                        className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-foreground transition cursor-pointer"
                      >
                        {qa.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div ref={endRef} />
            </div>

            {/* Error Message & Retry */}
            {error && (
              <div className="flex items-center justify-between rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <span>{error}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void sendMessage()}
                  className="h-7 text-xs text-destructive hover:bg-destructive/20 gap-1"
                >
                  <RotateCcw className="h-3 w-3" />
                  {activeLangConfig.ui.retry}
                </Button>
              </div>
            )}

            {/* Input Composer with Voice Microphone toggle */}
            <div className="pt-2 border-t mt-auto">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void sendMessage();
                }}
                className={cn(
                  "relative flex flex-col gap-2 rounded-xl border bg-background p-2 transition",
                  isListening
                    ? "ring-2 ring-primary border-primary bg-primary/5"
                    : "focus-within:ring-2 focus-within:ring-primary/20"
                )}
              >
                {attachments.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 px-1 pt-1">
                    {attachments.map((f, i) => (
                      <span
                        key={`${f.name}-${f.size}-${f.lastModified}`}
                        className="inline-flex max-w-[220px] items-center gap-1 rounded-md border bg-muted/50 px-2 py-1 text-[11px]"
                      >
                        <Paperclip className="h-3 w-3 shrink-0" />
                        <span className="truncate">{f.name}</span>
                        <button
                          type="button"
                          onClick={() => removeAttachment(i)}
                          className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
                          aria-label={`Remove ${f.name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                <textarea
                  ref={textareaRef}
                  value={input}
                  disabled={loading}
                  rows={2}
                  maxLength={2000}
                  onKeyDown={handleKeyDown}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    isListening
                      ? "Listening... speak clearly in " + activeLangConfig.name
                      : activeLangConfig.ui.inputPlaceholder
                  }
                  className="w-full resize-none border-0 bg-transparent p-1.5 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0 leading-relaxed font-sans"
                />

                <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".txt,.md,.csv,.json,.xml,.html,.css,.js,.ts,.tsx,.jsx,.py,.java,.c,.cpp,.sql,.pdf,.doc,.docx,image/*"
                      className="hidden"
                      onChange={handleFilesSelected}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={loading}
                      className="h-7 px-2 text-xs gap-1 cursor-pointer"
                      title="Attach one or more files"
                    >
                      <Paperclip className="h-3.5 w-3.5 text-primary" />
                      <span className="hidden sm:inline">Attach</span>
                    </Button>

                    {/* Microphone control — rendered ONLY when speech recognition is supported */}
                    {speechSupported && (
                      <Button
                        type="button"
                        variant={isListening ? "default" : "outline"}
                        size="sm"
                        onClick={toggleVoiceInput}
                        className={cn(
                          "h-7 px-2 text-xs gap-1 cursor-pointer transition",
                          isListening && "bg-destructive text-destructive-foreground animate-pulse"
                        )}
                        title={isListening ? "Stop listening" : "Speak your doubt"}
                      >
                        {isListening ? (
                          <>
                            <MicOff className="h-3.5 w-3.5" />
                            <span>Listening…</span>
                          </>
                        ) : (
                          <>
                            <Mic className="h-3.5 w-3.5 text-primary" />
                            <span className="hidden sm:inline">Voice</span>
                          </>
                        )}
                      </Button>
                    )}

                    <span className="hidden sm:inline text-muted-foreground/70">
                      Press <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px]">Enter</kbd> to send
                    </span>
                    {input.length > 100 && (
                      <span className="text-muted-foreground/80 font-mono text-[10px]">
                        {input.length}/2000
                      </span>
                    )}
                  </div>

                  <Button
                    type="submit"
                    size="sm"
                    disabled={loading || (!input.trim() && attachments.length === 0)}
                    className="h-8 gap-1.5 px-3 text-xs font-medium cursor-pointer"
                  >
                    <span>{loading ? "Thinking…" : activeLangConfig.ui.send}</span>
                    <Send className="h-3 w-3" />
                  </Button>
                </div>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>
  );

  if (embedded) {
    return tutorBody;
  }

  return <RequireStudent>{tutorBody}</RequireStudent>;
}
