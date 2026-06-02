/**
 * Builds the serializable `ScriptSnapshot` the engine runs against.
 *
 * Collect-then-apply means reads happen here, on the main thread, before the
 * worker runs — the script sees a frozen view of the guild. Fetching the full
 * member list is the expensive part and needs the `GUILD_MEMBERS` intent; for
 * large guilds this should later be narrowed to what a script declares it needs.
 */
import type { Guild } from "discord.js";
import type { MemberSnapshot, ScriptSnapshot } from "./engine";

export interface SnapshotContext {
  channel?: { id: string; name: string } | null;
  invoker?: { id: string; tag: string } | null;
}

export async function buildSnapshot(
  guild: Guild,
  context: SnapshotContext = {},
): Promise<ScriptSnapshot> {
  const memberCollection = await guild.members.fetch();
  const members: MemberSnapshot[] = memberCollection.map((m) => ({
    id: m.id,
    tag: m.user.tag,
    bot: m.user.bot,
    roleIds: [...m.roles.cache.keys()],
    joinedAt: m.joinedTimestamp,
  }));

  const roles = guild.roles.cache.map((r) => ({ id: r.id, name: r.name }));
  const channels = guild.channels.cache.map((c) => ({ id: c.id, name: c.name }));

  return {
    guild: { id: guild.id, name: guild.name, memberCount: guild.memberCount },
    channel: context.channel ?? null,
    invoker: context.invoker ?? null,
    members,
    roles,
    channels,
    now: Date.now(),
  };
}
