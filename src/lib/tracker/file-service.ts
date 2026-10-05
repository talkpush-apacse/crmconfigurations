import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { Actor } from "./actor";
import { logActivity } from "./activity";
import { badRequest, notFound, TrackerError } from "./errors";
import { buildStoragePath, checkFile, FILE_KINDS, FILE_FOLDER, MAX_FILE_BYTES, pathBelongsToProject, safeFileName } from "./file-rules";

/**
 * Project files (contracts, Gantt charts, notes). Staff only.
 *
 * The bytes live in the PRIVATE bucket below. A browser never receives a permanent address: it uploads straight to
 * storage with a one-off signed upload link (so a big PDF does not pass through the server, which would cap it at about
 * 4.5 MB on Vercel), and it downloads through a signed link that expires after one minute.
 * "Remove" hides the file (archived) and keeps the bytes, like items.
 */

export const PROJECT_FILES_BUCKET = "project-files";
const DOWNLOAD_LINK_SECONDS = 60;

/**
 * Loaded on first use, not at the top of the file: the Supabase helper is "server-only" and refuses to load outside
 * the web server, but the tool list for Claude (and its tests) imports this file just to read file names from the
 * database, which never needs storage.
 */
async function storage() {
  const { supabase } = await import("@/lib/supabase");
  if (!supabase) throw new TrackerError("File storage is not set up on this server.", 503);
  return supabase.storage.from(PROJECT_FILES_BUCKET);
}

const note = z
  .string()
  .trim()
  .max(300)
  .nullish()
  .transform((v) => (v ? v : null));

const uploadRequestSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  size: z.number().int().positive(),
  kind: z.enum(FILE_KINDS).default("contract"),
});

const registerSchema = z.object({
  path: z.string().trim().min(1).max(400),
  fileName: z.string().trim().min(1).max(255),
  kind: z.enum(FILE_KINDS).default("contract"),
  note,
});

function serializeFile(f: {
  id: string;
  projectId: string;
  kind: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  note: string | null;
  uploadedBy: string;
  createdAt: Date;
}) {
  return {
    id: f.id,
    projectId: f.projectId,
    kind: f.kind,
    fileName: f.fileName,
    mimeType: f.mimeType,
    sizeBytes: f.sizeBytes,
    note: f.note,
    uploadedBy: f.uploadedBy,
    createdAt: f.createdAt.toISOString(),
  };
}
export type ProjectFileDTO = ReturnType<typeof serializeFile>;

async function loadOpenProject(projectId: string) {
  const project = await prisma.trackerProject.findUnique({ where: { id: projectId }, select: { id: true, archived: true } });
  if (!project) throw notFound("Project");
  if (project.archived) throw badRequest("This project is archived.");
}

export async function listProjectFiles(projectId: string): Promise<ProjectFileDTO[]> {
  const exists = await prisma.trackerProject.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!exists) throw notFound("Project");
  const files = await prisma.trackerProjectFile.findMany({
    where: { projectId, archived: false },
    orderBy: { createdAt: "desc" },
  });
  return files.map(serializeFile);
}

/** Step 1 of an upload: check the file, then hand back a one-off address the browser can send the bytes to. */
export async function createUploadTicket(projectId: string, input: unknown) {
  const data = uploadRequestSchema.parse(input);
  await loadOpenProject(projectId);
  const check = checkFile(data.fileName, data.size);
  if (!check.ok) throw badRequest(check.error);

  const path = buildStoragePath(projectId, randomUUID(), check.safeName);
  const { data: ticket, error } = await (await storage()).createSignedUploadUrl(path);
  if (error || !ticket) {
    console.error("[tracker files] signed upload link failed:", error?.message);
    throw new TrackerError("Could not start the upload. Please try again.", 502);
  }
  return { path, signedUrl: ticket.signedUrl, mimeType: check.mimeType };
}

/** Step 2: after the browser has uploaded, confirm the file really is in storage and record it against the project. */
export async function registerProjectFile(projectId: string, input: unknown, actor: Actor): Promise<ProjectFileDTO> {
  const data = registerSchema.parse(input);
  await loadOpenProject(projectId);
  if (!pathBelongsToProject(data.path, projectId)) throw badRequest("That file does not belong to this project.");

  const name = data.path.split("/").pop() as string;
  const { data: found, error } = await (await storage()).list(`${FILE_FOLDER}/${projectId}`, { search: name, limit: 20 });
  if (error) {
    console.error("[tracker files] storage lookup failed:", error.message);
    throw new TrackerError("Could not confirm the upload. Please try again.", 502);
  }
  const object = (found ?? []).find((o) => o.name === name);
  if (!object) throw badRequest("The upload did not finish. Please try again.");

  // What storage actually holds is the truth about the size, not what the browser said.
  const size = Number((object.metadata as { size?: number } | null)?.size ?? 0);
  const check = checkFile(data.fileName, size);
  if (!check.ok) throw badRequest(check.error);
  if (size > MAX_FILE_BYTES) throw badRequest("That file is too large.");

  const already = await prisma.trackerProjectFile.findUnique({ where: { storagePath: data.path }, select: { id: true } });
  if (already) throw badRequest("That file is already recorded.");

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.trackerProjectFile.create({
      data: {
        projectId,
        kind: data.kind,
        fileName: displayName(data.fileName),
        mimeType: check.mimeType,
        sizeBytes: size,
        storagePath: data.path,
        note: data.note,
        uploadedBy: actor.label,
      },
    });
    await logActivity(tx, {
      projectId,
      entityType: "project",
      entityId: projectId,
      action: "file.added",
      after: { fileName: row.fileName, kind: row.kind },
      actor,
    });
    return row;
  });
  return serializeFile(created);
}

/** The name shown to people: what they called the file, without folder pieces or control characters. */
function displayName(fileName: string): string {
  const base = (fileName.split(/[\\/]/).pop() ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return (base || safeFileName(fileName)).slice(0, 200);
}

/** A link that opens the file as a download for one minute. */
export async function createDownloadUrl(fileId: string): Promise<string> {
  const file = await prisma.trackerProjectFile.findUnique({ where: { id: fileId } });
  if (!file || file.archived) throw notFound("File");
  const { data, error } = await (await storage()).createSignedUrl(file.storagePath, DOWNLOAD_LINK_SECONDS, { download: file.fileName });
  if (error || !data) {
    console.error("[tracker files] signed download link failed:", error?.message);
    throw new TrackerError("Could not open the file. Please try again.", 502);
  }
  return data.signedUrl;
}

/** Hides a file from the project. The bytes stay in storage and the activity history keeps the record. */
export async function removeProjectFile(fileId: string, actor: Actor): Promise<ProjectFileDTO> {
  const file = await prisma.trackerProjectFile.findUnique({ where: { id: fileId } });
  if (!file) throw notFound("File");
  if (file.archived) return serializeFile(file);
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.trackerProjectFile.update({ where: { id: fileId }, data: { archived: true } });
    await logActivity(tx, {
      projectId: file.projectId,
      entityType: "project",
      entityId: file.projectId,
      action: "file.removed",
      before: { fileName: file.fileName, kind: file.kind },
      actor,
    });
    return row;
  });
  return serializeFile(updated);
}
