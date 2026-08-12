import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { getDb, COLLECTIONS } from "@/lib/db";
import { isAdmin, json } from "@/lib/http";
import type { VoterTicket } from "@/lib/types";

export const dynamic = "force-dynamic";

interface VoterDoc {
  _id: string;
  votes: number[];
  createdAt: number;
  printed?: boolean;
}

const ticketUrl = (origin: string, token: string) => `${origin}/?t=${token}`;

/** Generate N printable voter QR tickets.
 *  POST /api/admin/voters  body: { count } */
export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) return json({ error: "Invalid admin PIN" }, 401);
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const count = Math.min(Math.max(parseInt(String(body.count), 10) || 1, 1), 500);
    const origin = new URL(req.url).origin;
    const db = await getDb();
    const col = db.collection<VoterDoc>(COLLECTIONS.VOTERS);
    const created: VoterTicket[] = [];

    for (let i = 0; i < count; i++) {
      const token = randomBytes(10).toString("hex");
      await col.insertOne({ _id: token, votes: [], createdAt: Date.now(), printed: true });
      const url = ticketUrl(origin, token);
      created.push({
        token,
        url,
        short: token.slice(0, 8),
        votes: [],
        voteCount: 0,
        qr: await QRCode.toDataURL(url, { width: 200, margin: 1 }),
      });
    }

    return json({ created });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Request failed" }, 500);
  }
}

/** List all registered voters with their vote counts + QR codes.
 *  GET /api/admin/voters */
export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) return json({ error: "Invalid admin PIN" }, 401);
  try {
    const origin = new URL(req.url).origin;
    const db = await getDb();
    const voters = await db.collection<VoterDoc>(COLLECTIONS.VOTERS).find({}).toArray();

    const list: VoterTicket[] = [];
    for (const v of voters) {
      const votes = v.votes || [];
      const url = ticketUrl(origin, v._id);
      list.push({
        token: v._id,
        short: v._id.slice(0, 8),
        url,
        votes,
        voteCount: votes.length,
        qr: await QRCode.toDataURL(url, { width: 160, margin: 1 }),
      });
    }
    list.sort((a, b) => b.voteCount - a.voteCount);

    return NextResponse.json({ voters: list });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Request failed" }, 500);
  }
}
