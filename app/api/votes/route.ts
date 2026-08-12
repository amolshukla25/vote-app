import { NextRequest, NextResponse } from "next/server";
import { getCounts } from "@/lib/data";

export const dynamic = "force-dynamic";

/** Live vote counts. GET /api/votes */
export async function GET(_req: NextRequest) {
  try {
    return NextResponse.json(await getCounts());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request failed" },
      { status: 500 }
    );
  }
}
