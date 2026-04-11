import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { supabase, STORAGE_BUCKET } from "@/lib/supabase";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  // Excel + CSV — used by tab-upload banner ("Skip manual entry")
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/csv",
];
const ALLOWED_FOLDERS = [
  "logos",
  "banners",
  "documents",
  "general",
  "tab-uploads",
] as const;
type AllowedFolder = typeof ALLOWED_FOLDERS[number];

export async function POST(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json(
        { error: "File uploads not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." },
        { status: 503 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const rawFolder = (formData.get("folder") as string) || "general";
    const folder: AllowedFolder = (ALLOWED_FOLDERS as readonly string[]).includes(rawFolder)
      ? (rawFolder as AllowedFolder)
      : "general";

    // --- Auth: admin cookie OR valid editor-token / client-slug ---
    //
    // Admin cookie holders can upload to any folder.
    //
    // Public editor-link or client-link holders can ONLY upload to the
    // "tab-uploads" folder, and must provide a valid editorToken or slug
    // that resolves to an existing checklist. The link itself is the access
    // control (same pattern as PUT /api/checklists/by-token/[token]).
    const adminCookie = request.cookies.get("admin_token")?.value;
    const isAdmin = !!adminCookie && !!verifyToken(adminCookie);

    if (!isAdmin) {
      const editorToken = (formData.get("editorToken") as string) || "";
      const slug = (formData.get("slug") as string) || "";

      if (!editorToken && !slug) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 }
        );
      }

      if (folder !== "tab-uploads") {
        return NextResponse.json(
          { error: "This folder requires admin access" },
          { status: 403 }
        );
      }

      // Validate the token/slug resolves to an existing checklist.
      const checklist = editorToken
        ? await prisma.checklist.findUnique({
            where: { editorToken },
            select: { id: true },
          })
        : await prisma.checklist.findUnique({
            where: { slug },
            select: { id: true },
          });

      if (!checklist) {
        return NextResponse.json(
          { error: "Invalid or expired link" },
          { status: 401 }
        );
      }
    }

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large. Maximum size is 10 MB." }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `File type '${file.type}' is not allowed. Accepted: images and PDF.` },
        { status: 400 }
      );
    }

    // Sanitize filename and create unique path
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${folder}/${Date.now()}-${safeName}`;

    const buffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(path);

    return NextResponse.json({ url: urlData.publicUrl });
  } catch (err) {
    console.error("POST /api/upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
