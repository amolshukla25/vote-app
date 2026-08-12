export class ApiError extends Error {
  status: number;
  data: Record<string, unknown>;

  constructor(message: string, status: number, data: Record<string, unknown> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

async function handle<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError(String(data.error || "Request failed"), res.status, data);
  }
  return data as T;
}

export async function apiGet<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(url, { headers, cache: "no-store" });
  return handle<T>(res);
}

export async function apiPost<T>(
  url: string,
  body: unknown,
  headers: Record<string, string> = {}
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  return handle<T>(res);
}

export async function apiDelete<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(url, { method: "DELETE", headers });
  return handle<T>(res);
}
