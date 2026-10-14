"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import {
  Bookmark,
  Check,
  Copy,
  Mic,
  Send,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import "./lucous-chatbot.css";

/* ------------------------------------------------------------------ */
/* Config: the chatbot backend runs separately (its own deployment).   */
/* Override with NEXT_PUBLIC_CHATBOT_API_URL / NEXT_PUBLIC_CHATBOT_API_PATH */
/* ------------------------------------------------------------------ */
const API_URL = (
  process.env.NEXT_PUBLIC_CHATBOT_API_URL ??
  "https://lucous-chatbot-backend.vercel.app"
).replace(/\/+$/, "");
const API_PATH =
  process.env.NEXT_PUBLIC_CHATBOT_API_PATH ?? "/api/v1/chat/stream";
const LOGO_SRC = "/chatbot/lucous-chatbot-logo.png";

const GREETING =
  "Hi there! 👋\nI'm LUCOUS, your AI study assistant.\nAsk me anything about your studies.";

const MOST_ASKED = [
  "What is LUCOUS?",
  "What services does LUCOUS provide?",
  "How much does the Pro plan cost?",
  "How can I access the games on LUCOUS?",
];

type Role = "user" | "assistant";
type Feedback = "up" | "down" | null;

interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  feedback: Feedback;
  streaming?: boolean;
}

interface SavedItem {
  id: string;
  question: string;
  content: string;
}

const SAVED_KEY = "lucous-chatbot-saved-answers";

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult:
    | ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void)
    | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Reads a Server-Sent-Events response and calls onEvent(eventName, data)
 * for every event. `data` is parsed JSON when possible, otherwise raw text.
 */
async function readSse(
  res: Response,
  onEvent: (event: string, data: unknown) => void,
) {
  if (!res.body) throw new Error("Empty response body");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const handleBlock = (block: string) => {
    let event = "message";
    const dataLines: string[] = [];
    for (const line of block.split("\n")) {
      if (!line || line.startsWith(":")) continue;
      const i = line.indexOf(":");
      const field = i === -1 ? line : line.slice(0, i);
      let value = i === -1 ? "" : line.slice(i + 1);
      if (value.startsWith(" ")) value = value.slice(1);
      if (field === "event") event = value;
      else if (field === "data") dataLines.push(value);
    }
    if (dataLines.length === 0) return;
    const raw = dataLines.join("\n");
    let data: unknown = raw;
    try {
      data = JSON.parse(raw);
    } catch {
      /* keep raw text */
    }
    onEvent(event, data);
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    buffer = buffer.replace(/\r\n/g, "\n");
    let idx = buffer.indexOf("\n\n");
    while (idx !== -1) {
      handleBlock(buffer.slice(0, idx));
      buffer = buffer.slice(idx + 2);
      idx = buffer.indexOf("\n\n");
    }
  }
  if (buffer.trim()) handleBlock(buffer);
}

function Logo() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={LOGO_SRC} alt="" draggable={false} />
  );
}

export function LucousChatbot() {
  const { resolvedTheme } = useTheme();
  const light = resolvedTheme === "light";

  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [showSaved, setShowSaved] = React.useState(false);
  const [recording, setRecording] = React.useState(false);
  const [micSupported, setMicSupported] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [savedItems, setSavedItems] = React.useState<SavedItem[]>([]);
  const [speakingId, setSpeakingId] = React.useState<string | null>(null);
  const [ttsSupported, setTtsSupported] = React.useState(false);

  const listRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null);
  const sessionIdRef = React.useRef<string | null>(null);
  const sendSessionRef = React.useRef(true);

  const stopSpeaking = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingId(null);
  };

  React.useEffect(() => {
    setMicSupported(getSpeechRecognition() !== null);
    setTtsSupported(
      "speechSynthesis" in window &&
        typeof SpeechSynthesisUtterance !== "undefined",
    );
    try {
      const raw = window.localStorage.getItem(SAVED_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        setSavedItems(
          parsed.filter(
            (x): x is SavedItem =>
              !!x &&
              typeof x.id === "string" &&
              typeof x.content === "string" &&
              typeof x.question === "string",
          ),
        );
      }
    } catch {
      /* storage unavailable or corrupted */
    }
    return () => {
      abortRef.current?.abort();
      recognitionRef.current?.stop();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  React.useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading, open, showSaved]);

  React.useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        stopSpeaking();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: uid(),
      role: "user",
      content: text,
      feedback: null,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setShowSaved(false);
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const assistantId = uid();
    let answer = "";

    const upsert = (content: string, streaming: boolean) =>
      setMessages((prev) =>
        prev.some((m) => m.id === assistantId)
          ? prev.map((m) =>
              m.id === assistantId ? { ...m, content, streaming } : m,
            )
          : [
              ...prev,
              {
                id: assistantId,
                role: "assistant",
                content,
                feedback: null,
                streaming,
              },
            ],
      );

    const post = (sessionId: string | null) =>
      fetch(`${API_URL}${API_PATH}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify(
          sessionId ? { message: text, sessionId } : { message: text },
        ),
        signal: controller.signal,
      });

    try {
      let res = await post(
        sendSessionRef.current ? sessionIdRef.current : null,
      );
      // If the backend rejects the follow-up with a sessionId, retry without it.
      if (
        !res.ok &&
        sendSessionRef.current &&
        sessionIdRef.current &&
        (res.status === 400 || res.status === 422)
      ) {
        sendSessionRef.current = false;
        res = await post(null);
      }
      if (!res.ok) throw new Error(`Chatbot request failed (${res.status})`);

      await readSse(res, (event, data) => {
        const d = (
          data && typeof data === "object" ? data : {}
        ) as Record<string, unknown>;
        if (event === "meta" && typeof d.sessionId === "string") {
          sessionIdRef.current = d.sessionId;
        } else if (event === "token" && typeof d.text === "string" && d.text) {
          answer += d.text;
          upsert(answer, true);
        }
      });
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error("[LUCOUS chatbot]", err);
    }

    if (controller.signal.aborted) return;
    if (answer.trim()) {
      upsert(answer, false);
    } else {
      upsert(
        "Sorry, I couldn't reach the assistant right now. Please try again in a moment.",
        false,
      );
    }
    setLoading(false);
  };

  const clearChat = () => {
    abortRef.current?.abort();
    stopSpeaking();
    sessionIdRef.current = null;
    setMessages([]);
    setLoading(false);
    setShowSaved(false);
  };

  const patchMessage = (id: string, patch: (m: ChatMessage) => ChatMessage) =>
    setMessages((prev) => prev.map((m) => (m.id === id ? patch(m) : m)));

  const copyMessage = async (m: { id: string; content: string }) => {
    try {
      await navigator.clipboard.writeText(m.content);
      setCopiedId(m.id);
      window.setTimeout(
        () => setCopiedId((c) => (c === m.id ? null : c)),
        1500,
      );
    } catch {
      /* clipboard unavailable */
    }
  };

  const toggleMic = () => {
    if (recording) {
      recognitionRef.current?.stop();
      return;
    }
    const Ctor = getSpeechRecognition();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "en-IN";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      setInput(t);
    };
    rec.onend = () => setRecording(false);
    rec.onerror = () => setRecording(false);
    recognitionRef.current = rec;
    setRecording(true);
    rec.start();
  };

  const persistSaved = (items: SavedItem[]) => {
    setSavedItems(items);
    try {
      window.localStorage.setItem(SAVED_KEY, JSON.stringify(items));
    } catch {
      /* storage unavailable */
    }
  };

  const toggleSave = (m: { id: string; content: string }) => {
    if (savedItems.some((x) => x.id === m.id)) {
      persistSaved(savedItems.filter((x) => x.id !== m.id));
      return;
    }
    let question = "";
    const idx = messages.findIndex((x) => x.id === m.id);
    for (let i = idx - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        question = messages[i].content;
        break;
      }
    }
    persistSaved([{ id: m.id, question, content: m.content }, ...savedItems]);
  };

  const toggleSpeak = (m: { id: string; content: string }) => {
    if (!ttsSupported) return;
    if (speakingId === m.id) {
      stopSpeaking();
      return;
    }
    window.speechSynthesis.cancel();
    const clean = m.content.replace(/[*_`#>~]/g, "").replace(/\s+/g, " ").trim();
    if (!clean) return;
    const utter = new SpeechSynthesisUtterance(clean);
    utter.lang = /[\u0900-\u097F]/.test(clean) ? "hi-IN" : "en-IN";
    const done = () => setSpeakingId((c) => (c === m.id ? null : c));
    utter.onend = done;
    utter.onerror = done;
    setSpeakingId(m.id);
    window.speechSynthesis.speak(utter);
  };

  const renderActions = (
    m: { id: string; content: string; feedback?: Feedback },
    withFeedback: boolean,
  ) => {
    const isSaved = savedItems.some((x) => x.id === m.id);
    const speaking = speakingId === m.id;
    return (
      <div className="lc-message-actions">
        <button
          type="button"
          onClick={() => void copyMessage(m)}
          aria-label="Copy answer"
          title="Copy"
        >
          {copiedId === m.id ? <Check size={15} /> : <Copy size={15} />}
        </button>
        {ttsSupported && (
          <button
            type="button"
            className={speaking ? "lc-feedback-active" : ""}
            onClick={() => toggleSpeak(m)}
            aria-label={speaking ? "Stop listening" : "Listen to answer"}
            aria-pressed={speaking}
            title={speaking ? "Stop" : "Listen"}
          >
            {speaking ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
        )}
        {withFeedback && (
          <>
            <button
              type="button"
              className={m.feedback === "up" ? "lc-feedback-active" : ""}
              onClick={() =>
                patchMessage(m.id, (x) => ({
                  ...x,
                  feedback: x.feedback === "up" ? null : "up",
                }))
              }
              aria-label="Good answer"
              aria-pressed={m.feedback === "up"}
              title="Good answer"
            >
              <ThumbsUp size={15} />
            </button>
            <button
              type="button"
              className={m.feedback === "down" ? "lc-feedback-negative" : ""}
              onClick={() =>
                patchMessage(m.id, (x) => ({
                  ...x,
                  feedback: x.feedback === "down" ? null : "down",
                }))
              }
              aria-label="Bad answer"
              aria-pressed={m.feedback === "down"}
              title="Bad answer"
            >
              <ThumbsDown size={15} />
            </button>
          </>
        )}
        <button
          type="button"
          className={isSaved ? "lc-feedback-active" : ""}
          onClick={() => toggleSave(m)}
          aria-label={isSaved ? "Remove from saved" : "Save answer"}
          aria-pressed={isSaved}
          title={isSaved ? "Remove from saved" : "Save answer"}
        >
          <Bookmark size={15} fill={isSaved ? "currentColor" : "none"} />
        </button>
      </div>
    );
  };

  return (
    <div className="lucous-chatbot-shell">
      {open ? (
        <section
          className={`lucous-chatbot${light ? " lc-light" : ""}`}
          role="dialog"
          aria-label="LUCOUS AI chatbot"
        >
          <header className="lucous-chat-header">
            <div className="lucous-brand-group">
              <div className="lucous-avatar">
                <Logo />
              </div>
              <div>
                <div className="lucous-title">
                  <span className="lucous-wordmark">
                    <span className="lc-blue">L</span>
                    <span className="lc-blue">U</span>
                    <span className="lc-orange">C</span>
                    <span className="lc-yellow">O</span>
                    <span className="lc-green">U</span>
                    <span className="lc-orange">S</span>
                  </span>
                  <span className="lc-ai-label">AI</span>
                </div>
                <div className="lucous-status">
                  <span /> Online
                </div>
              </div>
            </div>

            <div className="lucous-header-actions">
              <button
                type="button"
                onClick={clearChat}
                disabled={messages.length === 0}
                aria-label="Clear chat"
                title="Clear chat"
              >
                <Trash2 size={18} />
              </button>
              <button
                type="button"
                className={showSaved ? "lc-active" : ""}
                onClick={() => setShowSaved((v) => !v)}
                aria-label="Saved answers"
                aria-pressed={showSaved}
                title="Saved answers"
              >
                <Bookmark size={18} />
              </button>
              <button
                type="button"
                onClick={() => {
                  stopSpeaking();
                  setOpen(false);
                }}
                aria-label="Close chat"
                title="Close"
              >
                <X size={19} />
              </button>
            </div>
          </header>

          <div className="lucous-chat-messages" ref={listRef}>
            {!showSaved && messages.length === 0 && (
              <div className="lc-most-asked">
                <p className="lc-section-label">Most asked questions</p>
                <div className="lc-question-grid">
                  {MOST_ASKED.map((q) => (
                    <button key={q} type="button" onClick={() => void send(q)}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {showSaved ? (
              <p className="lc-section-label">Saved answers</p>
            ) : (
              <div className="lc-message-row lc-assistant">
                <div className="lc-mini-avatar">
                  <Logo />
                </div>
                <div className="lc-message-stack">
                  <div className="lc-message-bubble">{GREETING}</div>
                </div>
              </div>
            )}

            {showSaved && savedItems.length === 0 && (
              <p className="lc-saved-empty">
                No saved answers yet. Tap the bookmark under any answer to save
                it.
              </p>
            )}

            {showSaved &&
              savedItems.map((item) => (
                <React.Fragment key={item.id}>
                  {item.question && (
                    <div className="lc-message-row lc-user">
                      <div className="lc-message-stack">
                        <div className="lc-message-bubble">{item.question}</div>
                      </div>
                    </div>
                  )}
                  <div className="lc-message-row lc-assistant">
                    <div className="lc-mini-avatar">
                      <Logo />
                    </div>
                    <div className="lc-message-stack">
                      <div className="lc-message-bubble">{item.content}</div>
                      {renderActions(item, false)}
                    </div>
                  </div>
                </React.Fragment>
              ))}

            {!showSaved &&
              messages.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="lc-message-row lc-user">
                    <div className="lc-message-stack">
                      <div className="lc-message-bubble">{m.content}</div>
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="lc-message-row lc-assistant">
                    <div className="lc-mini-avatar">
                      <Logo />
                    </div>
                    <div className="lc-message-stack">
                      <div className="lc-message-bubble">
                        {m.content}
                        {m.streaming && <span className="lc-cursor">▍</span>}
                      </div>
                      {!m.streaming && renderActions(m, true)}
                    </div>
                  </div>
                ),
              )}

            {loading && !showSaved && !messages.some((m) => m.streaming) && (
              <div className="lc-message-row lc-assistant">
                <div className="lc-mini-avatar">
                  <Logo />
                </div>
                <div className="lc-thinking-bubble" aria-live="polite">
                  <span className="lc-thinking-dot" />
                  <span className="lc-thinking-dot" />
                  <span className="lc-thinking-dot" />
                </div>
              </div>
            )}
          </div>

          <div className="lucous-composer-wrap">
            <form
              className="lucous-composer"
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <button
                type="button"
                className={`lc-icon-button${recording ? " lc-recording" : ""}`}
                onClick={toggleMic}
                disabled={!micSupported}
                aria-label={recording ? "Stop recording" : "Speak your question"}
                title={micSupported ? "Voice input" : "Voice input not supported"}
              >
                <Mic size={19} />
              </button>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything about your studies..."
                aria-label="Message"
                autoComplete="off"
              />
              <button
                type="submit"
                className="lc-send-button"
                disabled={!input.trim() || loading}
                aria-label="Send message"
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        </section>
      ) : (
        <button
          type="button"
          className="lucous-chat-launcher"
          onClick={() => setOpen(true)}
          aria-label="Open LUCOUS AI chatbot"
        >
          <Logo />
          <span className="lc-launcher-status" />
        </button>
      )}
    </div>
  );
}
