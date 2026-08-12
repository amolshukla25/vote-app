import { NextRequest } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/db";
import { json, requireAdmin } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Reset votes and/or all voter tickets.
 *  POST /api/admin/reset  body: { type: "votes" | "all" } */
export async function POST(req: NextRequest) {
  try {
    const denied = await requireAdmin(req);
    if (denied) return denied;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const type = body.type;
    const db = await getDb();

    if (type === "votes") {
      await db.collection(COLLECTIONS.VOTES).deleteMany({});
      await db
        .collection<{ _id: string; votes: number[] }>(COLLECTIONS.VOTERS)
        .updateMany({}, { $set: { votes: [] } });
    } else if (type === "all") {
      await db.collection(COLLECTIONS.VOTES).deleteMany({});
      await db.collection(COLLECTIONS.VOTERS).deleteMany({});
    } else {
      return json({ error: 'type must be "votes" or "all"' }, 400);
    }

    return json({ ok: true });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Request failed" }, 500);
  }
}
