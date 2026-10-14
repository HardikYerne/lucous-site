/**
 * Document Processing Service for LUCOUS
 * Extracts text from supported teacher materials (PDF, DOCX, TXT).
 * 
 * Security & Reliability Guardrails:
 * 1. Validates file integrity and signature before parsing.
 * 2. Pure, macro-free extraction (never executes scripts or embedded macros).
 * 3. Enforces extraction size caps (max 30,000 chars) and minimum content thresholds.
 * 4. Treats extracted content as untrusted raw text.
 * 5. Detects scanned/image-only PDFs and unconfigured OCR honestly.
 */

const zlib = require("zlib");
const path = require("path");

// Configuration limits
const MAX_EXTRACT_CHARS = 30000; // ~7,500 tokens
const MIN_EXTRACT_CHARS = 20;
const PROCESSING_TIMEOUT_MS = 15000;

/**
 * Extracts plain text from UTF-8 / ASCII text buffer.
 */
function extractFromTxt(buffer) {
  if (!buffer || buffer.length === 0) {
    throw new Error("Text document is empty (0 bytes).");
  }

  // Convert buffer to UTF-8 string
  let text = buffer.toString("utf8");

  // Remove null bytes and non-printable control characters (keep \t, \n, \r)
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  text = text.trim();

  if (text.length < MIN_EXTRACT_CHARS) {
    throw new Error(
      `Text document contains insufficient readable text (${text.length} characters found; minimum ${MIN_EXTRACT_CHARS} required).`
    );
  }

  return {
    text: text.slice(0, MAX_EXTRACT_CHARS),
    truncated: text.length > MAX_EXTRACT_CHARS,
    originalCharCount: text.length,
    wordCount: countWords(text),
    sections: splitIntoSections(text),
    format: "txt",
  };
}

/**
 * Parses ZIP container and extracts text from Word document.xml
 * Does not execute macros (vbaProject.bin) or embedded active objects.
 */
function extractFromDocx(buffer) {
  if (!buffer || buffer.length < 30) {
    throw new Error("Invalid or corrupted Word (.docx) document.");
  }

  // Verify ZIP header: PK\x03\x04
  if (
    buffer[0] !== 0x50 ||
    buffer[1] !== 0x4b ||
    buffer[2] !== 0x03 ||
    buffer[3] !== 0x04
  ) {
    throw new Error("Invalid Word file signature. Expected ZIP-based OpenXML document.");
  }

  let offset = 0;
  let documentXmlBuffer = null;

  // Scan local file entries in ZIP
  while (offset + 30 <= buffer.length) {
    const signature = buffer.readUInt32LE(offset);
    if (signature !== 0x04034b50) {
      // End of local file headers or central directory reached
      break;
    }

    const compressionMethod = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const uncompressedSize = buffer.readUInt32LE(offset + 22);
    const filenameLength = buffer.readUInt16LE(offset + 26);
    const extraFieldLength = buffer.readUInt16LE(offset + 28);

    const nameStart = offset + 30;
    const nameEnd = nameStart + filenameLength;

    if (nameEnd > buffer.length) break;

    const fileName = buffer.toString("utf8", nameStart, nameEnd);
    const dataStart = nameEnd + extraFieldLength;
    const dataEnd = dataStart + compressedSize;

    if (fileName === "word/document.xml") {
      if (dataEnd > buffer.length) {
        throw new Error("Corrupted DOCX archive: word/document.xml stream exceeds file boundary.");
      }

      const compressedData = buffer.subarray(dataStart, dataEnd);

      if (compressionMethod === 0) {
        // Stored (no compression)
        documentXmlBuffer = compressedData;
      } else if (compressionMethod === 8) {
        // Deflate compression
        try {
          documentXmlBuffer = zlib.inflateRawSync(compressedData);
        } catch (inflateErr) {
          throw new Error(`Failed to decompress word/document.xml: ${inflateErr.message}`);
        }
      } else {
        throw new Error(`Unsupported DOCX compression method (${compressionMethod}).`);
      }
      break;
    }

    offset = dataEnd;
  }

  if (!documentXmlBuffer) {
    throw new Error("Invalid Word document: word/document.xml entry not found in archive.");
  }

  // Parse paragraphs and text runs from OpenXML
  const xmlString = documentXmlBuffer.toString("utf8");
  const text = parseOpenXmlText(xmlString);

  if (text.length < MIN_EXTRACT_CHARS) {
    throw new Error(
      `Word document contains insufficient readable text (${text.length} characters found; minimum ${MIN_EXTRACT_CHARS} required).`
    );
  }

  return {
    text: text.slice(0, MAX_EXTRACT_CHARS),
    truncated: text.length > MAX_EXTRACT_CHARS,
    originalCharCount: text.length,
    wordCount: countWords(text),
    sections: splitIntoSections(text),
    format: "docx",
  };
}

/**
 * Extracts text from OpenXML document.xml preserving paragraph breaks.
 */
function parseOpenXmlText(xml) {
  // Replace paragraph endings </w:p> with newlines
  const paragraphMatches = xml.split(/<\/w:p>/gi);
  const paragraphs = [];

  for (const paraXml of paragraphMatches) {
    // Extract all <w:t>...</w:t> tags
    const runs = [];
    const runRegex = /<w:t(?:\s+[^>]*)?>([^<]*)<\/w:t>/gi;
    let match;
    while ((match = runRegex.exec(paraXml)) !== null) {
      if (match[1]) {
        runs.push(decodeXmlEntities(match[1]));
      }
    }

    // Also handle line breaks <w:br/>
    const paraText = runs.join("").trim();
    if (paraText) {
      paragraphs.push(paraText);
    }
  }

  return paragraphs.join("\n\n").trim();
}

/**
 * Extracts text from PDF stream objects and text blocks (BT ... ET).
 * Handles FlateDecode decompression and string literal/hex encoding.
 */
function extractFromPdf(buffer) {
  if (!buffer || buffer.length < 32) {
    throw new Error("Invalid or corrupted PDF document (file too small).");
  }

  // Verify %PDF- header
  if (
    buffer[0] !== 0x25 ||
    buffer[1] !== 0x50 ||
    buffer[2] !== 0x44 ||
    buffer[3] !== 0x46
  ) {
    throw new Error("Invalid PDF file header signature. Expected %PDF-.");
  }

  const rawLatin = buffer.toString("latin1");
  const extractedPieces = [];
  let foundStreamCount = 0;
  let hasImageObjects = rawLatin.includes("/Subtype/Image") || rawLatin.includes("/Subtype /Image");

  // Find all stream ... endstream blocks
  const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
  let streamMatch;

  while ((streamMatch = streamRegex.exec(rawLatin)) !== null) {
    foundStreamCount++;
    const streamContentLatin = streamMatch[1];
    const streamBuffer = Buffer.from(streamContentLatin, "latin1");

    // Attempt FlateDecode decompression
    let decompressed = null;
    try {
      decompressed = zlib.inflateSync(streamBuffer);
    } catch {
      try {
        decompressed = zlib.inflateRawSync(streamBuffer);
      } catch {
        // Not a FlateDecode stream or uncompressed stream
        decompressed = streamBuffer;
      }
    }

    if (decompressed && decompressed.length > 0) {
      const streamText = decompressed.toString("latin1");
      const textFromStream = parsePdfTextOperators(streamText);
      if (textFromStream) {
        extractedPieces.push(textFromStream);
      }
    }
  }

  // Fallback: If stream parsing found nothing, inspect raw content outside streams
  if (extractedPieces.length === 0) {
    const directText = parsePdfTextOperators(rawLatin);
    if (directText) {
      extractedPieces.push(directText);
    }
  }

  const fullText = cleanExtractedText(extractedPieces.join("\n\n").trim());

  if (fullText.length < MIN_EXTRACT_CHARS) {
    if (hasImageObjects) {
      throw new Error(
        "No extractable text found in PDF. This document appears to be scanned or image-based. Scanned documents require OCR."
      );
    }
    throw new Error(
      `PDF document contains insufficient extractable text (${fullText.length} characters found; minimum ${MIN_EXTRACT_CHARS} required). Document may be empty, image-only, or encrypted.`
    );
  }

  return {
    text: fullText.slice(0, MAX_EXTRACT_CHARS),
    truncated: fullText.length > MAX_EXTRACT_CHARS,
    originalCharCount: fullText.length,
    wordCount: countWords(fullText),
    sections: splitIntoSections(fullText),
    format: "pdf",
  };
}

/**
 * Parses PDF operators between BT (Begin Text) and ET (End Text).
 * Supports:
 * - (Text) Tj
 * - [(Text1) 120 (Text2)] TJ
 * - ' and "
 * - Hexadecimal strings <48656c6c6f> Tj
 */
function parsePdfTextOperators(streamContent) {
  const parts = [];
  const btRegex = /BT\s+([\s\S]*?)\s+ET/g;
  let btMatch;

  while ((btMatch = btRegex.exec(streamContent)) !== null) {
    const btBody = btMatch[1];

    // 1. Array TJ operator: [(Part 1) -120 (Part 2)] TJ
    const tjArrayRegex = /\[((?:(?:\([^)]*\)|<[^>]*>|[-+]?[0-9.]+)\s*)+)\]\s*TJ/g;
    let arrayMatch;
    while ((arrayMatch = tjArrayRegex.exec(btBody)) !== null) {
      const items = arrayMatch[1];
      const stringItemRegex = /\(([^)]*)\)|<([0-9a-fA-F]+)>/g;
      let sMatch;
      let phrase = "";
      while ((sMatch = stringItemRegex.exec(items)) !== null) {
        if (sMatch[1] !== undefined) {
          phrase += decodePdfString(sMatch[1]);
        } else if (sMatch[2] !== undefined) {
          phrase += decodePdfHex(sMatch[2]);
        }
      }
      if (phrase.trim()) {
        parts.push(phrase.trim());
      }
    }

    // 2. Simple Tj operator: (Hello World) Tj
    const tjSimpleRegex = /\(([^)]*)\)\s*Tj/g;
    let simpleMatch;
    while ((simpleMatch = tjSimpleRegex.exec(btBody)) !== null) {
      const decoded = decodePdfString(simpleMatch[1]);
      if (decoded.trim()) {
        parts.push(decoded.trim());
      }
    }

    // 3. Hexadecimal Tj operator: <48656c6c6f> Tj
    const hexSimpleRegex = /<([0-9a-fA-F]+)>\s*Tj/g;
    let hexMatch;
    while ((hexMatch = hexSimpleRegex.exec(btBody)) !== null) {
      const decoded = decodePdfHex(hexMatch[1]);
      if (decoded.trim()) {
        parts.push(decoded.trim());
      }
    }
  }

  return parts.join(" ").trim();
}

/**
 * Decodes PDF escaped characters (\n, \r, \t, \(, \), \\).
 */
function decodePdfString(str) {
  if (!str) return "";
  return str
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\");
}

/**
 * Decodes hexadecimal string in PDF (<48656c6c6f>).
 */
function decodePdfHex(hex) {
  if (!hex) return "";
  let cleanHex = hex.trim();
  if (cleanHex.length % 2 !== 0) {
    cleanHex += "0";
  }
  try {
    return Buffer.from(cleanHex, "hex").toString("utf8");
  } catch {
    return "";
  }
}

function decodeXmlEntities(str) {
  if (!str) return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function cleanExtractedText(text) {
  if (!text) return "";
  // Normalize whitespace and remove non-printable characters
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function countWords(text) {
  if (!text) return 0;
  const matches = text.match(/\b\w+\b/g);
  return matches ? matches.length : 0;
}

/**
 * Splits extracted text into logical sections / paragraphs for grounding references.
 */
function splitIntoSections(text) {
  if (!text) return [];
  const paragraphs = text.split(/\n\s*\n/);
  const sections = [];
  let currentHeading = "Overview";

  paragraphs.forEach((p, idx) => {
    const trimmed = p.trim();
    if (!trimmed) return;

    // Check if paragraph looks like a heading (short line, ending with colon or title-like)
    const isHeading =
      trimmed.length < 80 &&
      !trimmed.endsWith(".") &&
      (trimmed.endsWith(":") || /^(chapter|unit|section|topic|\d+\.|\b[A-Z\s]{4,}\b)/i.test(trimmed));

    if (isHeading) {
      currentHeading = trimmed.replace(/:$/, "").trim();
    } else {
      sections.push({
        sectionIndex: sections.length + 1,
        heading: currentHeading,
        snippet: trimmed.slice(0, 300),
        charCount: trimmed.length,
      });
    }
  });

  return sections.slice(0, 25); // cap at 25 section markers
}

/**
 * Main entry point: processes an uploaded document buffer.
 * 
 * @param {Object} params
 * @param {Buffer} params.buffer - The document binary buffer
 * @param {string} params.fileType - MIME type or extension
 * @param {string} params.originalName - Sanitized original filename
 * @returns {Promise<Object>} Extraction result with text, wordCount, sections, and metadata
 */
async function processDocument({ buffer, fileType, originalName }) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error("Invalid document buffer: buffer is empty or missing.");
  }

  const ext = path.extname(originalName || "").toLowerCase();
  const mime = (fileType || "").toLowerCase();

  // Route by file type
  const isPdf = ext === ".pdf" || mime.includes("pdf");
  const isDocx =
    ext === ".docx" ||
    mime.includes("wordprocessingml") ||
    mime.includes("officedocument");
  const isTxt = ext === ".txt" || mime.includes("text/plain");
  const isImage =
    ext === ".png" ||
    ext === ".jpg" ||
    ext === ".jpeg" ||
    mime.includes("image/");

  if (isImage) {
    throw new Error(
      "Image OCR is not configured on this server. Please upload notes as a PDF (.pdf), Word document (.docx), or plain text (.txt)."
    );
  }

  if (isTxt) {
    return extractFromTxt(buffer);
  }

  if (isDocx) {
    return extractFromDocx(buffer);
  }

  if (isPdf) {
    return extractFromPdf(buffer);
  }

  throw new Error(
    `Unsupported document format (${ext || fileType}). Only PDF (.pdf), Word (.docx), and plain text (.txt) files are supported for AI lesson generation.`
  );
}

module.exports = {
  processDocument,
  extractFromTxt,
  extractFromDocx,
  extractFromPdf,
  parseOpenXmlText,
  parsePdfTextOperators,
  cleanExtractedText,
  countWords,
  splitIntoSections,
  MAX_EXTRACT_CHARS,
  MIN_EXTRACT_CHARS,
  PROCESSING_TIMEOUT_MS,
};
