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
