import { NextResponse } from "next/server";
import { categoryOf } from "@/lib/config";
import { getConfig, getCounts } from "@/lib/data";
import { getDb, COLLECTIONS } from "@/lib/db";
import { json, requireAdmin } from "@/lib/http";
import crypto from "crypto";

export const dynamic = "force-dynamic";

/**
 * Manually add / adjust votes for a candidate / artwork.
 * POST /api/admin/votes
 * Body: { artNumber: number, count?: number, action?: "add" | "remove" }
 */
export async function POST(req: Request) {
  try {
    const denied = await requireAdmin(req);
    if (denied) return denied;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const artNumber = parseInt(String(body.artNumber), 10);
    const action = body.action === "clear" ? "clear" : body.action === "remove" ? "remove" : "add";
    const countInput = parseInt(String(body.count ?? 1), 10);
    const count = Math.max(1, Math.abs(Number.isNaN(countInput) ? 1 : countInput));

    if (!Number.isInteger(artNumber) || artNumber <= 0) {
      return json({ error: "Invalid candidate/artwork number" }, 400);
    }

    const config = await getConfig();
    const cat = categoryOf(config, artNumber);
    if (!cat) {
      return json({ error: `Candidate / Artwork #${artNumber} does not exist in any category range.` }, 404);
    }

    const db = await getDb();
    const votesCol = db.collection<{ _id: number; voters: string[] }>(COLLECTIONS.VOTES);
    const votersCol = db.collection<{ _id: string; votes: number[] }>(COLLECTIONS.VOTERS);

    if (action === "add") {
      const newTokens: string[] = [];
      for (let i = 0; i < count; i++) {
        newTokens.push(`admin_added_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`);
      }

      await votesCol.updateOne(
        { _id: artNumber },
        { $push: { voters: { $each: newTokens } } },
        { upsert: true }
      );
    } else if (action === "clear") {
      const doc = await votesCol.findOne({ _id: artNumber });
      if (doc && Array.isArray(doc.voters) && doc.voters.length > 0) {
        for (const token of doc.voters) {
          if (!token.startsWith("admin_added_")) {
            await votersCol.updateOne({ _id: token }, { $pull: { votes: artNumber } });
          }
        }
        await votesCol.updateOne({ _id: artNumber }, { $set: { voters: [] } });
      }
    } else {
      const doc = await votesCol.findOne({ _id: artNumber });
      if (doc && Array.isArray(doc.voters) && doc.voters.length > 0) {
        const removeCount = Math.min(count, doc.voters.length);
        const adminTokens = doc.voters.filter((v) => v.startsWith("admin_added_"));
        const nonAdminTokens = doc.voters.filter((v) => !v.startsWith("admin_added_"));
        const reordered = [...nonAdminTokens, ...adminTokens];
        const removed = reordered.splice(reordered.length - removeCount, removeCount);

        for (const token of removed) {
          if (!token.startsWith("admin_added_")) {
            await votersCol.updateOne({ _id: token }, { $pull: { votes: artNumber } });
          }
        }

        await votesCol.updateOne(
          { _id: artNumber },
          { $set: { voters: reordered } }
        );
      }
    }

    const { counts, totalVotes } = await getCounts();
    const currentVotes = counts[String(artNumber)] || 0;

    return NextResponse.json({
      success: true,
      artNumber,
      action,
      count,
      artVotes: currentVotes,
      totalVotes,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Request failed" }, 500);
  }
}
