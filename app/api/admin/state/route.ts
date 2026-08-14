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

    const [config, countsData, voterCount] = await Promise.all([
      getConfig(),
      getCounts(),
      getVoterCount(),
    ]);
    const { counts, publicCounts, adminCounts, totalVotes, totalPublicVotes, totalAdminVotes } = countsData;
    const arts = artList(config);
    const blockedSet = new Set(config.blockedArtworks || []);
    const artworks = arts.map((a) => ({
      number: a.number,
      category: a.category,
      votes: counts[a.number] || 0,
      publicVotes: publicCounts[a.number] || 0,
      adminVotes: adminCounts[a.number] || 0,
      blocked: blockedSet.has(a.number),
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
      blockedArtworks: config.blockedArtworks || [],
      totalVotes,
      totalPublicVotes,
      totalAdminVotes,
      winner: winner && winner.votes > 0 ? winner : null,
      voterCount,
      artCount: arts.length,
      artworks,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Request failed" }, 500);
  }
}
