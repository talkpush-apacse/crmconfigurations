import type { UserRow } from "./types";
import { downloadCsv } from "./csv-utils";

/**
 * Normalize a phone number for Talkpush import.
 * Keeps a single leading "+" if present, strips everything non-digit after.
 * Examples:
 *   "+63 917 123 4567" -> "+639171234567"
 *   "(917) 123-4567"   -> "9171234567"
 *   "09171234567"      -> "09171234567"
 * No country-code inference — malformed numbers are exported as-is for
 * Talkpush to reject on upload (per product decision).
 */
export function formatTalkpushPhone(raw: string): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return hasPlus ? `+${digits}` : digits;
}

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

const TALKPUSH_HEADERS = ["name", "email", "role", "phone"] as const;

export function generateTalkpushUsersCsv(users: UserRow[]): string {
  const visible = users.filter((u) => !u.deletedAt);
  const rows = visible.map((u) =>
    [u.name, u.email, u.accessType, formatTalkpushPhone(u.phone)]
      .map((v) => escapeCsvField(v ?? ""))
      .join(","),
  );
  return [TALKPUSH_HEADERS.join(","), ...rows].join("\n");
}

export function downloadTalkpushUsersCsv(users: UserRow[]): { exported: number } {
  const csv = generateTalkpushUsersCsv(users);
  downloadCsv(csv, "users-talkpush-import.csv");
  return { exported: users.filter((u) => !u.deletedAt).length };
}
