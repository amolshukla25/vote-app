import { DEFAULT_CONFIG } from "./config";
import { getDb, COLLECTIONS } from "./db";
import type { AppConfig } from "./types";

const CONFIG_ID = "app";

type ConfigDoc = AppConfig & { _id: string };

/**
 * Reads the stored config from MongoDB, seeding the default config on first
 * run. Always returns a plain object (no `_id`).
 */
export async function getConfig(): Promise<AppConfig> {
  const db = await getDb();
  const col = db.collection<ConfigDoc>(COLLECTIONS.CONFIG);

  const doc = await col.findOne({ _id: CONFIG_ID as string });
  if (!doc) {
    await col.updateOne(
      { _id: CONFIG_ID as string },
      { $setOnInsert: { ...DEFAULT_CONFIG } },
      { upsert: true }
    );
    return { ...DEFAULT_CONFIG };
  }

  const { _id, ...config } = doc;
  void _id;
  return config;
}

export async function saveConfig(config: AppConfig): Promise<void> {
  const db = await getDb();
  await db
    .collection<ConfigDoc>(COLLECTIONS.CONFIG)
    .updateOne({ _id: CONFIG_ID as string }, { $set: config }, { upsert: true });
}

/**
 * Aggregates the votes collection into { [artNumber]: count } plus the total.
 * Each votes doc is keyed by artwork number with an array of voter tokens.
 */
export async function getCounts(): Promise<{ counts: Record<string, number>; totalVotes: number }> {
  const db = await getDb();
  const docs = await db
    .collection<{ _id: number; voters: string[] }>(COLLECTIONS.VOTES)
    .find({})
    .toArray();

  const counts: Record<string, number> = {};
  let totalVotes = 0;
  for (const d of docs) {
    const n = d.voters?.length ?? 0;
    counts[String(d._id)] = n;
    totalVotes += n;
  }
  return { counts, totalVotes };
}

/** Total number of registered voter tickets. */
export async function getVoterCount(): Promise<number> {
  const db = await getDb();
  return db.collection(COLLECTIONS.VOTERS).countDocuments();
}
