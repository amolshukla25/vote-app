import type { AppConfig, Category } from "./types";

/**
 * Default configuration. Edit ranges here OR in the browser admin panel
 * (/admin) once a MongoDB Atlas connection is configured.
 */
export const DEFAULT_CONFIG: AppConfig = {
  eventTitle: "Art Showdown 2026",
  adminPin: "1234",
  votingOpen: true,
  votesPerVoter: 3,
  blockedArtworks: [],
  categories: [
    { id: "2d", name: "2D", start: 1, end: 44 },
    { id: "3d", name: "3D", start: 53, end: 78 },
    { id: "painting", name: "Painting", start: 84, end: 119 },
    { id: "sketch", name: "Sketch", start: 120, end: 148 },
    { id: "ai", name: "AI", start: null, end: null },
    { id: "game", name: "Game / Event", start: null, end: null },
  ],
};

/** Returns the category that owns artwork number `n`, or null. */
export function categoryOf(config: Pick<AppConfig, "categories">, n: number): Category | null {
  return (
    config.categories.find(
      (c) => c.start != null && c.end != null && n >= c.start && n <= c.end
    ) ?? null
  );
}

/** Flattens all category ranges into the full list of artworks. */
export function artList(config: Pick<AppConfig, "categories">) {
  const out: { number: number; category: Category }[] = [];
  for (const cat of config.categories) {
    if (cat.start == null || cat.end == null) continue;
    for (let n = cat.start; n <= cat.end; n++) {
      out.push({ number: n, category: cat });
    }
  }
  return out;
}

/** Public-safe copy of the config (never leaks adminPin). */
export function toPublicConfig(config: AppConfig, artImages: Record<string, string>) {
  return {
    eventTitle: config.eventTitle,
    votingOpen: config.votingOpen,
    votesPerVoter: config.votesPerVoter,
    categories: config.categories,
    artImages,
    blockedArtworks: config.blockedArtworks || [],
  };
}

/** Validates + normalizes a category list submitted from the admin panel. */
export function normalizeCategories(input: unknown): Category[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter(
      (c): c is Record<string, unknown> =>
        !!c && typeof c === "object" && typeof c.id === "string" && typeof c.name === "string" && c.name.trim().length > 0
    )
    .map((c) => ({
      id: (c.id as string).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || "category",
      name: (c.name as string).trim().slice(0, 40),
      start: c.start == null ? null : parseInt(String(c.start), 10),
      end: c.end == null ? null : parseInt(String(c.end), 10),
    }));
}
