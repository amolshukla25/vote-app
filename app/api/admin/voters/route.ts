import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { getDb, COLLECTIONS } from "@/lib/db";
import { json, requireAdmin } from "@/lib/http";
import type { VoterTicket } from "@/lib/types";

export const dynamic = "force-dynamic";

interface VoterDoc {
  _id: string;
  votes: number[];
  createdAt: number;
  printed?: boolean;
}

const ticketUrl = (origin: string, token: string) => `${origin}/?t=${token}`;

/** Generates QR codes in small parallel batches so large ticket lists don't
 *  hog the event loop or blow past serverless function time limits. */
async function qrBatch(items: { token: string; url: string }[]): Promise<VoterTicket[]> {
  const out: VoterTicket[] = [];
  for (let i = 0; i < items.length; i += 25) {
    const chunk = items.slice(i, i + 25);
    const results = await Promise.all(
      chunk.map(async ({ token, url }) => ({
        token,
        url,
        short: token.slice(0, 8),
        votes: [],
        voteCount: 0,
        qr: await QRCode.toDataURL(url, { width: 200, margin: 1 }).catch(() => ""),
      }))
    );
    out.push(...results);
  }
  return out;
}

/** Generate N printable voter QR tickets.
 *  POST /api/admin/voters  body: { count } */
export async function POST(req: NextRequest) {
  try {
    const denied = await requireAdmin(req);
    if (denied) return denied;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const count = Math.min(Math.max(parseInt(String(body.count), 10) || 1, 1), 500);
    const origin = new URL(req.url).origin;
    const db = await getDb();

    // Generate all QR codes first (parallel), then insert every voter in one
    // call — a mid-way failure can no longer leave half-created tickets.
    const tokens = Array.from({ length: count }, () => randomBytes(10).toString("hex"));
    const created = await qrBatch(tokens.map((token) => ({ token, url: ticketUrl(origin, token) })));

    await db.collection<VoterDoc>(COLLECTIONS.VOTERS).insertMany(
      created.map((c) => ({ _id: c.token, votes: [], createdAt: Date.now(), printed: true }))
    );

    return json({ created });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Request failed" }, 500);
  }
}

/** List all registered voters with their vote counts + QR codes.
 *  GET /api/admin/voters */
export async function GET(req: NextRequest) {
  try {
    const denied = await requireAdmin(req);
    if (denied) return denied;

    const origin = new URL(req.url).origin;
    const db = await getDb();
    const voters = await db.collection<VoterDoc>(COLLECTIONS.VOTERS).find({}).toArray();

    const tickets = await qrBatch(
      voters.map((v) => ({ token: v._id, url: ticketUrl(origin, v._id) }))
    );
    const list = tickets
      .map((t) => {
        const v = voters.find((x) => x._id === t.token);
        const votes = v?.votes || [];
        return { ...t, votes, voteCount: votes.length };
      })
      .sort((a, b) => b.voteCount - a.voteCount);

    return NextResponse.json({ voters: list });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Request failed" }, 500);
  }
}
