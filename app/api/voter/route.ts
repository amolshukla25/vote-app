import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Registers a new voter and returns a unique token (QR check-in).
 * POST /api/voter
 */
export async function POST() {
  try {
    const db = await getDb();
    const token = randomBytes(12).toString("hex");

    await db
      .collection<{ _id: string; votes: number[]; createdAt: number }>(COLLECTIONS.VOTERS)
      .insertOne({ _id: token, votes: [], createdAt: Date.now() });

    return NextResponse.json({ token });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to register voter" },
      { status: 500 }
    );
  }
}
