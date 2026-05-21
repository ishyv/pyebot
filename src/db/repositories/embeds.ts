import type { Filter } from "mongodb";
import type { Result } from "@/core/result";
import { ErrResult, OkResult } from "@/core/result";
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

/** Reads an embed config by its durable `{guildId}:{name}` document id. */
export async function getEmbedConfigById(id: string): Promise<Result<EmbedConfig | null>> {
  return embedStore.get(id);
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
  if (res.isErr()) return ErrResult(res.error);
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
  try {
    const col = await embedStore.collection();
    const { _id: _ignoredId, ...safePatch } = patch;
    const res = await col.findOneAndUpdate(
      { _id: id } as Filter<EmbedConfig>,
      { $set: { ...safePatch, updatedAt: new Date() } },
      { returnDocument: "after" },
    );
    if (!res) return ErrResult(new Error(`Embed config not found: ${id}`));

    const parsed = EmbedConfigSchema.safeParse(res);
    if (!parsed.success) return ErrResult(parsed.error);
    return OkResult(parsed.data);
  } catch (error) {
    return ErrResult(error instanceof Error ? error : new Error(String(error)));
  }
}

export async function deleteEmbedConfig(id: string): Promise<Result<boolean>> {
  return embedStore.delete(id);
}
