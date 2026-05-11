import { z } from "zod";
import { MongoStore } from "@/db/store";
import type { Result } from "@/core/result";

export const CountingStateSchema = z.object({
  _id: z.string(),
  guildId: z.string(),
  channelId: z.string(),
  expectedValue: z.number().int().min(0).catch(0),
  lastUserId: z.string().nullable().catch(null),
  updatedAt: z.coerce.date().catch(() => new Date(0)),
});

export type CountingStateRecord = z.infer<typeof CountingStateSchema>;

export interface CountingStateRepository {
  getState(guildId: string, channelId: string): Promise<Result<CountingStateRecord | null>>;
  setState(state: CountingStateRecord): Promise<Result<CountingStateRecord>>;
}

const countingStore = new MongoStore("counting_states", CountingStateSchema);

export function countingStateId(guildId: string, channelId: string): string {
  return `${guildId}:${channelId}`;
}

export const mongoCountingStateRepository: CountingStateRepository = {
  getState(guildId: string, channelId: string): Promise<Result<CountingStateRecord | null>> {
    return countingStore.get(countingStateId(guildId, channelId));
  },

  setState(state: CountingStateRecord): Promise<Result<CountingStateRecord>> {
    return countingStore.set(state._id, state);
  },
};

export function createDefaultCountingState(guildId: string, channelId: string): CountingStateRecord {
  return {
    _id: countingStateId(guildId, channelId),
    guildId,
    channelId,
    expectedValue: 0,
    lastUserId: null,
    updatedAt: new Date(),
  };
}
