import { MongoClient, type Db } from "mongodb";

let client: MongoClient | null = null;
let dbInstance: Db | null = null;

function getUri(): string {
  const uri = process.env.MONGO_URI?.trim();
  if (!uri) throw new Error("MONGO_URI environment variable is not set.");
  return uri;
}

function getDbName(): string {
  return process.env.DB_NAME ?? "txbot";
}

export async function getDb(): Promise<Db> {
  if (dbInstance) return dbInstance;
  if (!client) client = new MongoClient(getUri());
  await client.connect();
  dbInstance = client.db(getDbName());
  return dbInstance;
}

export async function getMongoClient(): Promise<MongoClient> {
  if (!client) client = new MongoClient(getUri());
  await client.connect();
  return client;
}

export async function disconnectDb(): Promise<void> {
  if (client) await client.close();
  client = null;
  dbInstance = null;
}
