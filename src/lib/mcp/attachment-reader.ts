/**
 * Turns an uploaded file into something Claude can read: text for spreadsheets, Word files, PDFs, web pages and
 * plain text, or the picture itself for images. Used by the read_attachment tool.
 *
 * Nothing here talks to the database or to storage; it takes the file's bytes and says what is in them.
 */

import ExcelJS from "exceljs";
import { convert as htmlToPlainText } from "html-to-text";

export type ReadableKind = "spreadsheet" | "word" | "pdf" | "html" | "text" | "image";

export type AttachmentContent =
  | {
      kind: "text";
      format: ReadableKind;
      /** The text of the requested part. */
      text: string;
      part: number;
      totalParts: number;
      totalChars: number;
      /** Things Claude should know about what it is (not) seeing, e.g. "images inside the document are not included". */
      notes: string[];
    }
  | { kind: "image"; mimeType: string; base64: string; notes: string[] }
  | { kind: "unsupported"; reason: string };

/** Longest piece of text returned in one call. Longer files come back in parts. */
export const MAX_CHARS_PER_PART = 40_000;
/** Biggest file we will open. Uploads are capped at 10 MB, this leaves room for older, larger ones. */
export const MAX_READ_BYTES = 20 * 1024 * 1024;
/** Biggest picture we hand to Claude directly. */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const MAX_ROWS_PER_SHEET = 5000;
const MAX_COLUMNS_PER_SHEET = 100;
const MAX_CELL_CHARS = 2000;

const IMAGE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

const TEXT_EXTENSIONS = new Set(["txt", "csv", "tsv", "md", "markdown", "json", "log"]);

const OLD_FORMATS: Record<string, string> = {
  xls: "Old Excel (.xls) files cannot be read. Re-save it as .xlsx and upload it again.",
  doc: "Old Word (.doc) files cannot be read. Re-save it as .docx and upload it again.",
  ppt: "PowerPoint files cannot be read yet. Export it as PDF and upload it again.",
  pptx: "PowerPoint files cannot be read yet. Export it as PDF and upload it again.",
};

function extensionOf(fileName: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(fileName.trim());
  return match ? match[1].toLowerCase() : "";
}

/** Works out what kind of file this is from its name, then its declared type. Null means "cannot read this". */
export function detectKind(fileName: string, mimeType: string | null): { kind: ReadableKind; imageType?: string } | null {
  const ext = extensionOf(fileName);
  const mime = (mimeType ?? "").toLowerCase();

  if (IMAGE_TYPES[ext]) return { kind: "image", imageType: IMAGE_TYPES[ext] };
  if (Object.values(IMAGE_TYPES).includes(mime)) return { kind: "image", imageType: mime };

  if (ext === "xlsx" || ext === "xlsm" || mime.includes("spreadsheetml")) return { kind: "spreadsheet" };
  if (ext === "docx" || mime.includes("wordprocessingml")) return { kind: "word" };
  if (ext === "pdf" || mime === "application/pdf") return { kind: "pdf" };
  if (ext === "html" || ext === "htm" || mime === "text/html") return { kind: "html" };
  if (TEXT_EXTENSIONS.has(ext) || mime.startsWith("text/") || mime === "application/json") return { kind: "text" };
  return null;
}

export function unsupportedReason(fileName: string, mimeType: string | null): string {
  const ext = extensionOf(fileName);
  if (OLD_FORMATS[ext]) return OLD_FORMATS[ext];
  if (ext === "svg" || ext === "heic" || ext === "heif" || ext === "bmp" || ext === "tiff") {
    return `${ext.toUpperCase()} pictures cannot be shown to Claude. Upload it as PNG or JPG instead.`;
  }
  return `Claude cannot read ${ext ? `.${ext}` : "this type of"} files (${mimeType ?? "unknown type"}). It can read .xlsx, .docx, .pdf, .html, .txt/.csv/.md/.json and PNG/JPG/GIF/WEBP pictures.`;
}

// ---------------------------------------------------------------------------------------------------------------
// Readers (each returns text plus notes)
// ---------------------------------------------------------------------------------------------------------------

type Extracted = { text: string; notes: string[] };

function cellToText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const obj = value as unknown as Record<string, unknown>;
    if (Array.isArray(obj.richText)) return (obj.richText as { text: string }[]).map((r) => r.text).join("");
    if ("result" in obj) return cellToText(obj.result as ExcelJS.CellValue);
    if (typeof obj.text === "string") return obj.text;
    if (typeof obj.error === "string") return obj.error;
    if (typeof obj.formula === "string") return `=${obj.formula}`;
    return "";
  }
  return String(value);
}

function cleanCell(text: string): string {
  const flat = text.replace(/\r?\n/g, " ⏎ ").replace(/\|/g, "\\|").trim();
  return flat.length > MAX_CELL_CHARS ? `${flat.slice(0, MAX_CELL_CHARS)}…` : flat;
}

export async function readSpreadsheet(bytes: Buffer): Promise<Extracted> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as unknown as ArrayBuffer);

  const notes: string[] = [];
  const sections: string[] = [];

  for (const sheet of workbook.worksheets) {
    const hidden = sheet.state !== "visible";
    const lines: string[] = [];
    let shownRows = 0;
    let lastColumn = 0;

    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (shownRows >= MAX_ROWS_PER_SHEET) return;
      const cells: string[] = [];
      const width = Math.min(row.cellCount, MAX_COLUMNS_PER_SHEET);
      for (let c = 1; c <= width; c++) cells.push(cleanCell(cellToText(row.getCell(c).value)));
      while (cells.length && cells[cells.length - 1] === "") cells.pop();
      if (cells.length === 0) return;
      lastColumn = Math.max(lastColumn, cells.length);
      lines.push(`${rowNumber} | ${cells.join(" | ")}`);
      shownRows++;
    });

    const totalRows = sheet.actualRowCount;
    if (totalRows > MAX_ROWS_PER_SHEET) {
      notes.push(`Sheet "${sheet.name}": only the first ${MAX_ROWS_PER_SHEET} of ${totalRows} rows are shown.`);
    }
    if (sheet.actualColumnCount > MAX_COLUMNS_PER_SHEET) {
      notes.push(`Sheet "${sheet.name}": only the first ${MAX_COLUMNS_PER_SHEET} columns are shown.`);
    }

    const heading = `## Sheet: ${sheet.name}${hidden ? " (hidden)" : ""} — ${totalRows} row(s)`;
    sections.push(lines.length ? `${heading}\n(each line starts with the spreadsheet row number)\n${lines.join("\n")}` : `${heading}\n(empty)`);
  }

  if (sections.length === 0) return { text: "(this workbook has no sheets)", notes };
  notes.push("Cell colours, comments and images are not included.");
  return { text: sections.join("\n\n"), notes };
}

/** Shared by Word files and web pages: tables stay as rows, pictures and scripts are dropped. */
export function htmlToText(html: string): string {
  return htmlToPlainText(html, {
    wordwrap: false,
    selectors: [
      { selector: "img", format: "skip" },
      { selector: "script", format: "skip" },
      { selector: "style", format: "skip" },
      { selector: "noscript", format: "skip" },
      { selector: "head", format: "skip" },
      { selector: "svg", format: "skip" },
      { selector: "h1", options: { uppercase: false } },
      { selector: "h2", options: { uppercase: false } },
      { selector: "h3", options: { uppercase: false } },
      { selector: "h4", options: { uppercase: false } },
      { selector: "h5", options: { uppercase: false } },
      { selector: "h6", options: { uppercase: false } },
      { selector: "a", options: { ignoreHref: false, hideLinkHrefIfSameAsText: true } },
      { selector: "table", format: "dataTable", options: { uppercaseHeaderCells: false, maxColumnWidth: 500, colSpacing: 3 } },
    ],
  }).trim();
}

export async function readWord(bytes: Buffer): Promise<Extracted> {
  // Loaded on demand: the library is only needed when someone opens a Word file.
  const mammoth = (await import("mammoth")).default;
  const result = await mammoth.convertToHtml(
    { buffer: bytes },
    // Pictures would otherwise be inlined as huge base64 blobs; we only want the words.
    { convertImage: mammoth.images.imgElement(async () => ({ src: "" })) }
  );
  const notes = ["Pictures, text boxes and comments inside the document are not included."];
  const warnings = result.messages.filter((m) => m.type === "warning").length;
  if (warnings > 0) notes.push(`${warnings} part(s) of the document used formatting that could not be fully converted.`);
  return { text: htmlToText(result.value), notes };
}

export async function readPdf(bytes: Buffer): Promise<Extracted> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  const pages = Array.isArray(text) ? text : [text];

  const body = pages.map((page, i) => `--- Page ${i + 1} of ${totalPages} ---\n${page.trim()}`).join("\n\n");
  const notes = ["Pictures and drawings inside the PDF are not included; tables come out as plain lines of text."];
  if (pages.join("").trim().length < 20) {
    notes.push("This PDF has almost no readable text. It is probably a scan or a picture, so its contents cannot be read here.");
  }
  return { text: body, notes };
}

export function readHtml(bytes: Buffer): Extracted {
  return { text: htmlToText(bytes.toString("utf8")), notes: ["Scripts, styles and pictures are removed."] };
}

export function readPlainText(bytes: Buffer): Extracted {
  return { text: bytes.toString("utf8").replace(/^﻿/, ""), notes: [] };
}

// ---------------------------------------------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------------------------------------------

function paginate(extracted: Extracted, format: ReadableKind, part: number): AttachmentContent {
  const totalChars = extracted.text.length;
  const totalParts = Math.max(1, Math.ceil(totalChars / MAX_CHARS_PER_PART));
  const notes = [...extracted.notes];

  if (part > totalParts) {
    return { kind: "unsupported", reason: `This file only has ${totalParts} part(s); part ${part} does not exist.` };
  }
  if (totalParts > 1) {
    notes.push(`Long file: this is part ${part} of ${totalParts}. Ask for the next part with part=${Math.min(part + 1, totalParts)}.`);
  }
  if (totalChars === 0) notes.push("The file contains no readable text.");

  const start = (part - 1) * MAX_CHARS_PER_PART;
  return {
    kind: "text",
    format,
    text: extracted.text.slice(start, start + MAX_CHARS_PER_PART),
    part,
    totalParts,
    totalChars,
    notes,
  };
}

export async function readAttachmentContent(
  bytes: Buffer,
  file: { fileName: string; mimeType: string | null },
  part = 1
): Promise<AttachmentContent> {
  const detected = detectKind(file.fileName, file.mimeType);
  if (!detected) return { kind: "unsupported", reason: unsupportedReason(file.fileName, file.mimeType) };

  if (detected.kind === "image") {
    if (bytes.byteLength > MAX_IMAGE_BYTES) {
      return { kind: "unsupported", reason: "This picture is too large to show Claude (over 4 MB). Upload a smaller version." };
    }
    return { kind: "image", mimeType: detected.imageType!, base64: bytes.toString("base64"), notes: [] };
  }

  let extracted: Extracted;
  try {
    switch (detected.kind) {
      case "spreadsheet":
        extracted = await readSpreadsheet(bytes);
        break;
      case "word":
        extracted = await readWord(bytes);
        break;
      case "pdf":
        extracted = await readPdf(bytes);
        break;
      case "html":
        extracted = readHtml(bytes);
        break;
      default:
        extracted = readPlainText(bytes);
    }
  } catch (error) {
    // A damaged or password-protected file: say so in plain words and keep the detail in the server log.
    console.error(`[read_attachment] could not open ${detected.kind} file`, error);
    return {
      kind: "unsupported",
      reason: `The file could not be opened. It may be damaged or password-protected (${detected.kind}).`,
    };
  }

  return paginate(extracted, detected.kind, part);
}

/** Downloads a file, refusing to hold more than maxBytes in memory. */
export async function downloadBytes(url: string, maxBytes = MAX_READ_BYTES): Promise<Buffer | { tooLarge: true }> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download attachment: ${response.status} ${response.statusText}`);

  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return { tooLarge: true };

  if (!response.body) {
    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer.byteLength > maxBytes ? { tooLarge: true } : buffer;
  }

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return { tooLarge: true };
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}
