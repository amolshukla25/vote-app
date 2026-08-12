// Client-safe shared helpers (no Node APIs — safe to import in components).

const CAT_COLORS: Record<string, string> = {
  painting: "#f472b6",
  "2d": "#60a5fa",
  "3d": "#34d399",
  ai: "#a78bfa",
  sketch: "#fbbf24",
  game: "#fb7185",
};

export function catColor(id: string): string {
  return CAT_COLORS[id] || "#8b5cf6";
}

export function shortToken(token: string): string {
  return "#" + token.slice(0, 6).toUpperCase();
}
