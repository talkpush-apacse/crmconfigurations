import "server-only";
import { sendUserInvitation } from "@/lib/email";
import { canEmailInvitation, type InvitationOutcome } from "@/lib/invitation-email";
import type { Role } from "@/lib/roles";

export async function inviteByEmail(params: { to: string; role: Role; inviterEmail: string; signInUrl: string }): Promise<InvitationOutcome> {
  if (!canEmailInvitation(params.to)) return { status: "skipped" };
  const result = await sendUserInvitation(params);
  if (result.ok) {
    console.info(`[users] invitation emailed to ${params.to}`);
    return { status: "sent" };
  }
  console.error(`[users] invitation email to ${params.to} failed: ${result.error ?? "unknown error"}`);
  return { status: "failed", message: "The invitation email could not be sent." };
}
