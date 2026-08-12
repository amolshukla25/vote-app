import { NextRequest } from "next/server";
import { artList, normalizeCategories } from "@/lib/config";
import { getConfig, saveConfig } from "@/lib/data";
import { getDb, COLLECTIONS } from "@/lib/db";
import { isAdmin, json } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Update event settings and/or categories (requires X-Admin-Pin).
 *  POST /api/admin/config */
export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) return json({ error: "Invalid admin PIN" }, 401);
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const config = await getConfig();

    if (typeof body.eventTitle === "string" && body.eventTitle.trim()) {
      config.eventTitle = body.eventTitle.trim().slice(0, 80);
    }
    if (typeof body.adminPin === "string" && body.adminPin.trim()) {
      config.adminPin = body.adminPin.trim().slice(0, 20);
    }
    if (typeof body.votingOpen === "boolean") config.votingOpen = body.votingOpen;
    if (Number.isInteger(body.votesPerVoter) && (body.votesPerVoter as number) >= 1 && (body.votesPerVoter as number) <= 50) {
      config.votesPerVoter = body.votesPerVoter as number;
    }
    if (Array.isArray(body.categories)) {
      config.categories = normalizeCategories(body.categories);
    }

    await saveConfig(config);

    // Drop votes for artworks that no longer exist in any category range.
    const valid = new Set(artList(config).map((a) => a.number));
    const db = await getDb();
    const votesCol = db.collection<{ _id: number; voters: string[] }>(COLLECTIONS.VOTES);
    const stale = (await votesCol.find({}).toArray())
      .filter((d) => !valid.has(d._id))
      .map((d) => d._id);
    if (stale.length > 0) {
      await votesCol.deleteMany({ _id: { $in: stale } });
      // Keep voter vote-arrays consistent too, so freed slots don't stay used.
      await db
        .collection<{ _id: string; votes: number[] }>(COLLECTIONS.VOTERS)
        .updateMany({}, { $pull: { votes: { $in: stale } } });
    }

    return json({ ok: true, config: await getConfig() });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Request failed" }, 500);
  }
}
