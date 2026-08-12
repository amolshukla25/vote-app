import { NextRequest, NextResponse } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Returns which artworks the current voter has voted for.
 *  GET /api/me?token=... */
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token") || "";
    const db = await getDb();
    const voter = await db
      .collection<{ _id: string; votes: number[] }>(COLLECTIONS.VOTERS)
      .findOne({ _id: token });

    if (!token || !voter) {
      return NextResponse.json({ error: "unknown voter" }, { status: 404 });
    }
    return NextResponse.json({ votes: voter.votes || [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request failed" },
      { status: 500 }
    );
  }
}
