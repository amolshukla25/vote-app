import { NextResponse } from "next/server";
import { getCounts } from "@/lib/data";

export const dynamic = "force-dynamic";

/** Live vote counts. GET /api/votes */
export async function GET() {
  try {
    const { counts, totalVotes } = await getCounts();
    return NextResponse.json({ counts, totalVotes });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request failed" },
      { status: 500 }
    );
  }
}
