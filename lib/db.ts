import { MongoClient, type Db } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI || "";
const MONGODB_DB = process.env.MONGODB_DB || "art-showdown";

/** Cached connection so serverless function warm starts reuse the pool. */
const globalForMongo = globalThis as unknown as {
  __artShowdownMongo?: { client: MongoClient; promise: Promise<MongoClient> };
};

export async function getDb(): Promise<Db> {
  if (!MONGODB_URI) {
    throw new Error(
      "MONGODB_URI is not set. Add your MongoDB Atlas connection string to .env.local (see .env.example)."
    );
  }

  if (!globalForMongo.__artShowdownMongo) {
    const client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 8000,
      appName: "art-showdown",
    });
    const promise = client.connect();
    globalForMongo.__artShowdownMongo = { client, promise };
  }

  try {
    await globalForMongo.__artShowdownMongo.promise;
  } catch (err) {
    // A failed connect leaves a dead client behind — retry with a fresh one.
    globalForMongo.__artShowdownMongo = undefined;
    throw err;
  }

  return globalForMongo.__artShowdownMongo.client.db(MONGODB_DB);
}

export const COLLECTIONS = {
  CONFIG: "config",
  VOTERS: "voters",
  VOTES: "votes",
} as const;
