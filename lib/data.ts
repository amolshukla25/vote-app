import { DEFAULT_CONFIG } from "./config";
import { getDb, COLLECTIONS } from "./db";
import type { AppConfig } from "./types";

const CONFIG_ID = "app";
const CACHE_TTL_MS = 3000;

type ConfigDoc = AppConfig & { _id: string };

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

let configCache: CacheEntry<AppConfig> | null = null;
let countsCache: CacheEntry<{
  counts: Record<string, number>;
  publicCounts: Record<string, number>;
  adminCounts: Record<string, number>;
  totalVotes: number;
  totalPublicVotes: number;
  totalAdminVotes: number;
}> | null = null;
let voterCountCache: CacheEntry<number> | null = null;

export function invalidateCache(): void {
  configCache = null;
  countsCache = null;
  voterCountCache = null;
}

/**
 * Reads the stored config from MongoDB, seeding the default config on first
 * run. Always returns a plain object (no `_id`).
 */
export async function getConfig(): Promise<AppConfig> {
  const now = Date.now();
  if (configCache && now - configCache.timestamp < CACHE_TTL_MS) {
    return configCache.data;
  }

  const db = await getDb();
  const col = db.collection<ConfigDoc>(COLLECTIONS.CONFIG);

  const doc = await col.findOne({ _id: CONFIG_ID as string });
  if (!doc) {
    await col.updateOne(
      { _id: CONFIG_ID as string },
      { $setOnInsert: { ...DEFAULT_CONFIG } },
      { upsert: true }
    );
    const initialConfig = { ...DEFAULT_CONFIG };
    configCache = { data: initialConfig, timestamp: now };
    return initialConfig;
  }

  const { _id, ...config } = doc;
  void _id;

  // Fallback if categories is missing or empty
  if (!config.categories || !Array.isArray(config.categories) || config.categories.length === 0) {
    config.categories = DEFAULT_CONFIG.categories;
    col.updateOne(
      { _id: CONFIG_ID as string },
      { $set: { categories: DEFAULT_CONFIG.categories } }
    ).catch(() => {});
  }

  configCache = { data: config, timestamp: now };
  return config;
}

export async function saveConfig(config: AppConfig): Promise<void> {
  invalidateCache();
  const db = await getDb();
  await db
    .collection<ConfigDoc>(COLLECTIONS.CONFIG)
    .updateOne({ _id: CONFIG_ID as string }, { $set: config }, { upsert: true });
}

/**
 * Aggregates the votes collection into per-artwork counts, split into public
 * (real voter tickets) and admin-added votes. Each votes doc is keyed by
 * artwork number with an array of voter tokens; admin-managed votes use
 * tokens prefixed with `admin_added_`.
 *
 * `counts` is the combined total used by the leaderboard, so the public
 * leaderboard always matches the admin panel's totals. `publicCounts` and
 * `adminCounts` power the admin panel's separate breakdown.
 */
export async function getCounts(): Promise<{
  counts: Record<string, number>;
  publicCounts: Record<string, number>;
  adminCounts: Record<string, number>;
  totalVotes: number;
  totalPublicVotes: number;
  totalAdminVotes: number;
}> {
  const now = Date.now();
  if (countsCache && now - countsCache.timestamp < CACHE_TTL_MS) {
    return countsCache.data;
  }

  const db = await getDb();
  const docs = await db
    .collection<{ _id: number; voters: string[] }>(COLLECTIONS.VOTES)
    .find({})
    .toArray();

  const counts: Record<string, number> = {};
  const publicCounts: Record<string, number> = {};
  const adminCounts: Record<string, number> = {};
  let totalVotes = 0;
  let totalPublicVotes = 0;
  let totalAdminVotes = 0;

  for (const d of docs) {
    const voters = d.voters ?? [];
    const publicN = voters.filter((t) => !t.startsWith("admin_added_")).length;
    const adminN = voters.length - publicN;
    counts[String(d._id)] = voters.length;
    publicCounts[String(d._id)] = publicN;
    adminCounts[String(d._id)] = adminN;
    totalVotes += voters.length;
    totalPublicVotes += publicN;
    totalAdminVotes += adminN;
  }

  const result = { counts, publicCounts, adminCounts, totalVotes, totalPublicVotes, totalAdminVotes };
  countsCache = { data: result, timestamp: now };
  return result;
}

/** Total number of registered voter tickets. */
export async function getVoterCount(): Promise<number> {
  const now = Date.now();
  if (voterCountCache && now - voterCountCache.timestamp < CACHE_TTL_MS) {
    return voterCountCache.data;
  }
  const db = await getDb();
  const count = await db.collection(COLLECTIONS.VOTERS).estimatedDocumentCount();
  voterCountCache = { data: count, timestamp: now };
  return count;
}

