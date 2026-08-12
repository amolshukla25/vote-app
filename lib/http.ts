import { getConfig } from "./data";

/** JSON response helper. */
export function json(data: Record<string, unknown>, status = 200): Response {
  return Response.json(data, { status });
}

/** Returns the error message from an unknown thrown value. */
export function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Validates the X-Admin-Pin header against the stored admin PIN. */
export async function isAdmin(req: Request): Promise<boolean> {
  const pin = req.headers.get("x-admin-pin") || "";
  if (!pin) return false;
  const config = await getConfig();
  return pin === String(config.adminPin);
}

/**
 * Admin gate for route handlers: returns a `Response` to short-circuit with
 * when the caller is not authorized (or the DB is unreachable), or `null` to
 * proceed. Never throws, so a DB outage yields a clean JSON error.
 */
export async function requireAdmin(req: Request): Promise<Response | null> {
  try {
    if (await isAdmin(req)) return null;
    return json({ error: "Invalid admin PIN" }, 401);
  } catch {
    return json({ error: "Database unavailable — please try again" }, 500);
  }
}
