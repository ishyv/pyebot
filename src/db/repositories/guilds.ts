import { MongoStore } from "@/db/store";
import { GuildSchema, type Guild } from "@/db/schemas/guild";
import type { Result } from "@/core/result";
import type { Document } from "mongodb";

export const guildStore = new MongoStore("guilds", GuildSchema);

export async function getGuild(guildId: string): Promise<Result<Guild | null>> {
  return guildStore.get(guildId);
}

export async function ensureGuild(guildId: string): Promise<Result<Guild>> {
  return guildStore.ensure(guildId);
}

export async function patchGuild(guildId: string, patch: Partial<Guild>): Promise<Result<Guild>> {
  return guildStore.patch(guildId, patch);
}

export async function updateGuildPaths(
  guildId: string,
  paths: Record<string, unknown>,
  options?: { upsert?: boolean; unset?: string[]; pipeline?: Document[] },
): Promise<Result<void>> {
  return guildStore.updatePaths(guildId, paths, options);
}
