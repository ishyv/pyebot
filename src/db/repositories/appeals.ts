/**
 * Appeals repository.
 *
 * Thin wrapper around MongoStore<Appeal>. Key format: `appeal:{guildId}:{caseId}`.
 * All reads return null on miss rather than propagating the Result, because
 * callers treat "not found" as a domain condition, not an error.
 */
import { MongoStore } from "@/db/store";
import { AppealSchema, type Appeal } from "@/db/schemas/appeal";
import type { Result } from "@/core/result";

const store = new MongoStore("appeals", AppealSchema);

function key(guildId: string, caseId: number): string {
  return `appeal:${guildId}:${caseId}`;
}

/**
 * Writes a new appeal. Overwrites any existing record for the same key —
 * callers must check for an existing appeal before calling.
 */
export async function createAppeal(data: Omit<Appeal, "_id">): Promise<Result<Appeal>> {
  const record: Appeal = { _id: key(data.guildId, data.caseId), ...data };
  return store.set(record._id, record);
}

/**
 * Returns the appeal for a specific case, or null if none exists.
 */
export async function getAppeal(guildId: string, caseId: number): Promise<Appeal | null> {
  const result = await store.get(key(guildId, caseId));
  if (result.isErr()) return null;
  return result.unwrap();
}

/**
 * Partially updates an existing appeal. Returns the updated document.
 */
export async function updateAppeal(
  guildId: string,
  caseId: number,
  patch: Partial<Omit<Appeal, "_id">>,
): Promise<Result<Appeal>> {
  return store.patch(key(guildId, caseId), patch);
}

/**
 * Returns all pending appeals for a guild, used to rebuild the queue message.
 * Returns an empty array on any error rather than throwing.
 */
export async function getPendingAppeals(guildId: string): Promise<Appeal[]> {
  const result = await store.find({ guildId, status: "pending" } as any);
  if (result.isErr()) return [];
  return result.unwrap();
}
