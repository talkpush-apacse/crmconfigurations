import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authed, readJson } from "@/lib/tracker/route-helpers";
import { getProjectDetail } from "@/lib/tracker/project-service";
import { buildListWorkbook } from "@/lib/tracker/list-export";
import { exportName } from "@/lib/tracker/print-layout";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  /** The items shown on screen, in order. The server reads the item data itself and uses this only to pick and order rows. */
  itemIds: z.array(z.string().min(1).max(64)).max(5000),
  filterLabel: z.string().max(300).optional(),
});

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** POST { itemIds, filterLabel } returns the List view as an .xlsx file (staff only). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return authed(request, async () => {
    const body = bodySchema.parse(await readJson(request));
    const detail = await getProjectDetail(id);

    const byId = new Map(detail.items.map((i) => [i.id, i]));
    const seen = new Set<string>();
    const items = body.itemIds.flatMap((itemId) => {
      const item = byId.get(itemId);
      if (!item || seen.has(itemId)) return [];
      seen.add(itemId);
      return [item];
    });

    const file = await buildListWorkbook({
      account: detail.project.accountName,
      project: detail.project.title,
      today: detail.today,
      items,
      allItems: detail.items,
      filterLabel: body.filterLabel?.trim() ?? "",
    });
    const name = exportName({ account: detail.project.accountName, project: detail.project.title, view: "List", date: detail.today });

    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": XLSX_TYPE,
        "Content-Disposition": `attachment; filename="${name}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
