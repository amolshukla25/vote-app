import { NextResponse } from "next/server";
import { artList } from "@/lib/config";
import { getConfig, getCounts, getVoterCount } from "@/lib/data";
import { json, requireAdmin } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Full admin state (requires X-Admin-Pin header).
 *  GET /api/admin/state */
export async function GET(req: Request) {
  try {
    const denied = await requireAdmin(req);
    if (denied) return denied;

    const config = await getConfig();
    const { counts, totalVotes } = await getCounts();
    const arts = artList(config);
    const artworks = arts.map((a) => ({
      number: a.number,
      category: a.category,
      votes: counts[a.number] || 0,
    }));

    const winner =
      artworks
        .slice()
        .sort((a, b) => b.votes - a.votes)[0] ?? null;

    return NextResponse.json({
      eventTitle: config.eventTitle,
      votingOpen: config.votingOpen,
      votesPerVoter: config.votesPerVoter,
      categories: config.categories,
      totalVotes,
      winner: winner && winner.votes > 0 ? winner : null,
      voterCount: await getVoterCount(),
      artCount: arts.length,
      artworks,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Request failed" }, 500);
  }
}
