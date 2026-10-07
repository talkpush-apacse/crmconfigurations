import { NextResponse } from "next/server";
import { EditLinkError } from "./links-service";

/** Responses that carry secret link text must never be cached. */
export const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export function editLinkError(err: unknown, label: string) {
  if (err instanceof EditLinkError) return NextResponse.json({ error: err.message }, { status: err.status, headers: NO_STORE });
  console.error(label, err);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500, headers: NO_STORE });
}
