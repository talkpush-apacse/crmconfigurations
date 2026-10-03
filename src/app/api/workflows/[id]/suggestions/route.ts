import { NextRequest } from "next/server";
import { z } from "zod";
import { readJson, withStaff } from "@/lib/workflow/access/route-helpers";
import { acceptAllFromAuthor } from "@/lib/workflow/access/suggestions-service";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({ action: z.literal("accept_all"), authorName: z.string().min(1).max(80) });

/** "Accept all from <person>". */
export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return withStaff(request, async ({ who }) => {
    const input = schema.parse(await readJson(request));
    return { outcomes: await acceptAllFromAuthor(id, input.authorName, who) };
  });
}
