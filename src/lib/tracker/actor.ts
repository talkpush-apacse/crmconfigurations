import { prisma } from "@/lib/db";
import type { Via } from "./constants";

/** Who is making a change, for the activity log. */
export interface Actor {
  label: string;
  via: Via;
}

/** Staff sessions only carry a user id, so look up the email for a readable label. */
export async function resolveStaffActor(userId: string): Promise<Actor> {
  try {
    const user = await prisma.adminUser.findUnique({ where: { id: userId }, select: { email: true } });
    return { label: user?.email ?? "Staff", via: "web" };
  } catch {
    return { label: "Staff", via: "web" };
  }
}
