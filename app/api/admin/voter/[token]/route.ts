import { NextRequest } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/db";
import { json, requireAdmin } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Delete a voter ticket and remove their votes from the counts.
 *  DELETE /api/admin/voter/:token */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const denied = await requireAdmin(req);
    if (denied) return denied;
    const { token } = await params;
    const db = await getDb();
    const votersCol = db.collection<{ _id: string; votes: number[] }>(COLLECTIONS.VOTERS);
    const votesCol = db.collection<{ _id: number; voters: string[] }>(COLLECTIONS.VOTES);

    const voter = await votersCol.findOne({ _id: token });
    if (!voter) return json({ error: "voter not found" }, 404);

    for (const num of voter.votes || []) {
      await votesCol.updateOne({ _id: num }, { $pull: { voters: token } });
    }
    await votersCol.deleteOne({ _id: token });

    return json({ ok: true });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Request failed" }, 500);
  }
}
