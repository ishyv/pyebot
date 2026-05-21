import type { Filter } from "mongodb";
import type { Result } from "@/core/result";
import { OkResult } from "@/core/result";
import { type EmbedConfig, EmbedConfigSchema } from "@/db/schemas/embed-config";
import { MongoStore } from "@/db/store";

const embedStore = new MongoStore("embed_configs", EmbedConfigSchema);

export function embedConfigId(guildId: string, name: string): string {
  return `${guildId}:${name}`;
}

export async function getEmbedConfig(
  guildId: string,
  name: string,
): Promise<Result<EmbedConfig | null>> {
  return embedStore.get(embedConfigId(guildId, name));
}

export async function listEmbedConfigs(guildId: string): Promise<Result<EmbedConfig[]>> {
  return embedStore.find({ guildId } as Filter<EmbedConfig>);
}

export async function findStickyForChannel(
  guildId: string,
  channelId: string,
): Promise<Result<EmbedConfig | null>> {
  const res = await embedStore.find({
    guildId,
    channelId,
    stickyEnabled: true,
  } as Filter<EmbedConfig>);
  if (res.isErr()) return res as unknown as Result<EmbedConfig | null>;
  const configs = res.unwrap();
  return OkResult(configs[0] ?? null);
}

export async function findDueScheduled(): Promise<Result<EmbedConfig[]>> {
  return embedStore.find({
    scheduleEnabled: true,
    scheduledNextSendAt: { $lte: new Date() },
  } as Filter<EmbedConfig>);
}

export async function saveEmbedConfig(config: EmbedConfig): Promise<Result<EmbedConfig>> {
  return embedStore.set(config._id, config);
}

export async function patchEmbedConfig(
  id: string,
  patch: Partial<EmbedConfig>,
): Promise<Result<EmbedConfig>> {
  return embedStore.patch(id, patch);
}

export async function deleteEmbedConfig(guildId: string, name: string): Promise<Result<boolean>> {
  return embedStore.delete(embedConfigId(guildId, name));
}
