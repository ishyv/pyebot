import { type Db, MongoClient, ServerApiVersion } from "mongodb";
import { requireEnv } from "./auth";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function getDashboardDb(): Promise<Db> {
  if (db) {
    return db;
  }

  const env = requireEnv();
  client = new MongoClient(env.MONGO_URI, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
    tls: true,
    serverSelectionTimeoutMS: 10_000,
    connectTimeoutMS: 10_000,
  });

  try {
    await client.connect();
  } catch (err) {
    // Reset handles so the next request retries from scratch rather than
    // returning a client that never finished connecting.
    client = null;
    db = null;
    throw err;
  }

  db = client.db(env.DB_NAME);
  return db;
}

export async function closeDashboardDb(): Promise<void> {
  await client?.close();
  client = null;
  db = null;
}
