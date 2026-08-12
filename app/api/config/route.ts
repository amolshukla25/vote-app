import { NextRequest, NextResponse } from "next/server";
import { artImages } from "@/lib/art";
import { toPublicConfig } from "@/lib/config";
import { getConfig } from "@/lib/data";

export const dynamic = "force-dynamic";

/** Public event config + artwork images.
 *  GET /api/config */
export async function GET(_req: NextRequest) {
  try {
    const config = await getConfig();
    return NextResponse.json(toPublicConfig(config, artImages()));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request failed" },
      { status: 500 }
    );
  }
}
