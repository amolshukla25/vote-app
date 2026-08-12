import { NextRequest, NextResponse } from "next/server";
import { categoryOf } from "@/lib/config";
import { getCounts, getConfig } from "@/lib/data";
import { getDb, COLLECTIONS } from "@/lib/db";
import { errMsg } from "@/lib/http";

export const dynamic = "force-dynamic";

interface VoterDoc {
  _id: string;
  votes: number[];
}

/**
 * Casts / toggles a vote for one artwork.
 * POST /api/vote  body: { token, artNumber }
 *
 * Votes live in two collections (voter.votes + votes[art].voters), so updates
 * are intentionally idempotent ($pull / $addToSet) to stay consistent even if
 * a request retries. The vote-limit check uses an atomic $expr guard so two
 * rapid taps can't exceed the per-voter limit.
 *
 * Tradeoff: the two writes aren't wrapped in a transaction (Atlas M0 shared
 * clusters don't support them). A failure between the two leaves a stale
 * count until that vote is toggled again or an admin reset — acceptable at
 * this scale, and fixable by moving to a transaction on a paid Atlas tier.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const { token, artNumber } = body;

    const num = parseInt(String(artNumber), 10);
    if (!Number.isInteger(num)) {
      return NextResponse.json({ error: "Invalid artwork number" }, { status: 400 });
    }

    const config = await getConfig();
    if (!config.votingOpen) {
      return NextResponse.json(
        { error: "Voting is closed. Thank you for participating!" },
        { status: 403 }
      );
    }
    if (!categoryOf(config, num)) {
      return NextResponse.json({ error: "No artwork with that number" }, { status: 404 });
    }
    if (typeof token !== "string" || !token) {
      return NextResponse.json({ error: "unknown voter", needRegister: true }, { status: 401 });
    }

    const db = await getDb();
    const votersCol = db.collection<VoterDoc>(COLLECTIONS.VOTERS);
    const votesCol = db.collection<{ _id: number; voters: string[] }>(COLLECTIONS.VOTES);

    const voter = await votersCol.findOne({ _id: token });
    if (!voter) {
      return NextResponse.json({ error: "unknown voter", needRegister: true }, { status: 401 });
    }

    const idx = voter.votes.indexOf(num);
    const maxVotes = config.votesPerVoter;

    if (idx >= 0) {
      // Toggle OFF — remove the vote from both collections.
      await votersCol.updateOne({ _id: token }, { $pull: { votes: num } });
      await votesCol.updateOne({ _id: num }, { $pull: { voters: token } });
    } else {
      if (voter.votes.length >= maxVotes) {
        return voteLimitResponse(maxVotes);
      }
      // Atomic guard: only add the vote while the voter is still under the limit.
      const guard = await votersCol.updateOne(
        { _id: token, $expr: { $lt: [{ $size: { $ifNull: ["$votes", []] } }, maxVotes] } },
        { $addToSet: { votes: num } }
      );
      if (guard.modifiedCount === 0) {
        // Could be a double-tap race where the vote landed anyway — check.
        const after = await votersCol.findOne({ _id: token });
        if (!after || !after.votes.includes(num)) {
          return voteLimitResponse(maxVotes);
        }
      }
      await votesCol.updateOne(
        { _id: num },
        { $addToSet: { voters: token } },
        { upsert: true }
      );
    }

    const fresh = await votersCol.findOne({ _id: token });
    const { counts } = await getCounts();

    return NextResponse.json({
      voted: idx < 0,
      myVotes: fresh?.votes ?? [],
      counts,
      votingOpen: config.votingOpen,
    });
  } catch (err) {
    return NextResponse.json({ error: errMsg(err) }, { status: 500 });
  }
}

function voteLimitResponse(maxVotes: number): NextResponse {
  const word = maxVotes === 1 ? "one artwork only" : `${maxVotes} artworks`;
  return NextResponse.json(
    {
      error: `You already used your votes — you can vote for ${word}. Tap your voted artwork to change it.`,
    },
    { status: 409 }
  );
}
