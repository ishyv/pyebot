import { MongoStore } from "@/db/store";
import { TempBanSchema, type TempBan } from "@/db/schemas/tempBan";
import type { Result } from "@/core/result";
import { OkResult, ErrResult } from "@/core/result";
import { getDb } from "@/core/db";

export const tempBanStore = new MongoStore("temp_bans", TempBanSchema);

export async function createTempBan(ban: Omit<TempBan, "_id">): Promise<Result<TempBan>> {
  const record: TempBan = { _id: `${ban.guildId}:${ban.userId}`, ...ban };
  return tempBanStore.set(record._id, record);
}

export async function getTempBan(guildId: string, userId: string): Promise<Result<TempBan | null>> {
  return tempBanStore.get(`${guildId}:${userId}`);
}

export async function deleteTempBan(guildId: string, userId: string): Promise<Result<boolean>> {
  return tempBanStore.delete(`${guildId}:${userId}`);
}

export async function getExpiredTempBans(): Promise<Result<TempBan[]>> {
  try {
    const db = await getDb();
    const docs = await db
      .collection("temp_bans")
      .find({ unbanAt: { $lte: new Date() } })
      .toArray();
    const parsed = docs.map((d) => TempBanSchema.parse(d));
    return OkResult(parsed);
  } catch (err) {
    return ErrResult(err instanceof Error ? err : new Error(String(err)));
  }
}
