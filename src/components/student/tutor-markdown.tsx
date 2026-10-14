"use client";

import * as React from "react";
import { cn } from "cn";

interface TutorMarkdownProps {
  content: string;
  className?: string;
}

/**
 * A lightweight, secure Markdown renderer designed specifically for educational content.
 * Handles headings, bold/italic, lists, numbered steps, blockquotes, code, and native scripts
 * without external dependency overhead or raw HTML injection risks.
 */
export function TutorMarkdown({ content, className }: TutorMarkdownProps) {
  const blocks = React.useMemo(() => {
    return parseMarkdownBlocks(content);
  }, [content]);

  return (
    <div
      className={cn(
        "space-y-3 text-sm leading-relaxed text-foreground select-text",
        className
      )}
    >
      {blocks.map((block, i) => renderBlock(block, i))}
    </div>
  );
}

type Block =
  | { type: "h1" | "h2" | "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "quote"; text: string }
  | { type: "code"; code: string; language?: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] };

function parseMarkdownBlocks(raw: string): Block[] {
  const lines = raw.split(/\r?\n/);
  const blocks: Block[] = [];

  let inCode = false;
  let codeLines: string[] = [];
  let codeLang = "";

  let listType: "ul" | "ol" | null = null;
  let listItems: string[] = [];

  const flushList = () => {
    if (listType && listItems.length > 0) {
      blocks.push({ type: listType, items: [...listItems] });
      listItems = [];
      listType = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Code fence
    if (trimmed.startsWith("```")) {
      if (inCode) {
        blocks.push({
          type: "code",
          code: codeLines.join("\n"),
          language: codeLang,
        });
        codeLines = [];
        codeLang = "";
        inCode = false;
      } else {
        flushList();
        inCode = true;
        codeLang = trimmed.slice(3).trim();
        codeLines = [];
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    // Blank line flushes lists
    if (!trimmed) {
      flushList();
      continue;
    }

    // Headers
    if (trimmed.startsWith("### ")) {
      flushList();
      blocks.push({ type: "h3", text: trimmed.slice(4) });
      continue;
    }
    if (trimmed.startsWith("## ")) {
      flushList();
      blocks.push({ type: "h2", text: trimmed.slice(3) });
      continue;
    }
    if (trimmed.startsWith("# ")) {
      flushList();
      blocks.push({ type: "h1", text: trimmed.slice(2) });
      continue;
    }

    // Blockquote
    if (trimmed.startsWith("> ")) {
      flushList();
      blocks.push({ type: "quote", text: trimmed.slice(2) });
      continue;
    }

    // Unordered list
    if (/^[-*•]\s+/.test(trimmed)) {
      if (listType !== "ul") {
        flushList();
        listType = "ul";
      }
      listItems.push(trimmed.replace(/^[-*•]\s+/, ""));
      continue;
    }

    // Ordered list
    if (/^\d+[.)]\s+/.test(trimmed)) {
      if (listType !== "ol") {
        flushList();
        listType = "ol";
      }
      listItems.push(trimmed.replace(/^\d+[.)]\s+/, ""));
      continue;
    }

    // Regular paragraph
    flushList();
    blocks.push({ type: "p", text: trimmed });
  }

  if (inCode) {
    blocks.push({ type: "code", code: codeLines.join("\n"), language: codeLang });
  }
  flushList();

  return blocks;
}

function renderBlock(block: Block, key: number) {
  switch (block.type) {
    case "h1":
      return (
        <h2 key={key} className="font-heading text-lg font-bold text-foreground mt-2">
          {renderInline(block.text)}
        </h2>
      );
    case "h2":
      return (
        <h3 key={key} className="font-heading text-base font-semibold text-foreground mt-2">
          {renderInline(block.text)}
        </h3>
      );
    case "h3":
      return (
        <h4 key={key} className="font-heading text-sm font-semibold text-primary mt-1">
          {renderInline(block.text)}
        </h4>
      );
    case "quote":
      return (
        <blockquote
          key={key}
          className="border-l-3 border-primary/50 bg-primary/5 px-3 py-2 italic text-foreground/90 rounded-r-md my-1"
        >
          {renderInline(block.text)}
        </blockquote>
      );
    case "code":
      return (
        <pre
          key={key}
          className="overflow-x-auto rounded-lg bg-zinc-900 text-zinc-100 p-3 text-xs font-mono my-2"
        >
          <code>{block.code}</code>
        </pre>
      );
    case "ul":
      return (
        <ul key={key} className="list-disc list-inside space-y-1 pl-1 text-foreground/90 my-1">
          {block.items.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInline(item)}
            </li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol key={key} className="list-decimal list-inside space-y-1 pl-1 text-foreground/90 my-1">
          {block.items.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInline(item)}
            </li>
          ))}
        </ol>
      );
    case "p":
    default:
      return (
        <p key={key} className="leading-relaxed text-foreground/95">
          {renderInline(block.text)}
        </p>
      );
  }
}

function renderInline(text: string): React.ReactNode {
  // Parse bold (**bold**), inline code (`code`), and italic (*italic*)
  const tokens: React.ReactNode[] = [];
  const regex = /(\*\*([^*]+)\*\*|`([^`]+)`|\*([^*]+)\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      // Bold
      tokens.push(
        <strong key={match.index} className="font-semibold text-foreground">
          {match[2]}
        </strong>
      );
    } else if (match[3]) {
      // Inline code
      tokens.push(
        <code
          key={match.index}
          className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono font-medium text-primary"
        >
          {match[3]}
        </code>
      );
    } else if (match[4]) {
      // Italic
      tokens.push(
        <em key={match.index} className="italic text-foreground/90">
          {match[4]}
        </em>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    tokens.push(text.slice(lastIndex));
  }

  return tokens.length > 0 ? tokens : text;
}
