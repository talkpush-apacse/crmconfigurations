import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { linkChecklistToAccount, parseAccountId } from "@/lib/accounts/company-link";

/**
 * File a checklist under a company, or take it out (accountId: null). Filing is not an edit of the checklist:
 * its version, its fields and its client link are untouched, so a client editing at the same time is never disturbed.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = parseAccountId(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const result = await linkChecklistToAccount(id, parsed.value);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ id, accountId: result.accountId, account: result.account });
  } catch (err) {
    console.error("PUT /api/checklists/[id]/account error:", err);
    return NextResponse.json({ error: "Could not change the company. Please try again." }, { status: 500 });
  }
}
