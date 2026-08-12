import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";

/** QR data-URL for any http(s) URL (used by the kiosk "scan to vote" box).
 *  GET /api/qr?url=... */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url") || "";
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "A valid http(s) url is required" }, { status: 400 });
  }
  try {
    const dataUrl = await QRCode.toDataURL(url, { width: 320, margin: 1 });
    return NextResponse.json({ dataUrl });
  } catch {
    return NextResponse.json({ error: "Could not generate QR" }, { status: 400 });
  }
}
