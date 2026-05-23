import { type Client, type Guild, type GuildMember, PermissionFlagsBits } from "discord.js";
import { ErrResult, OkResult, type Result } from "@/core/result";
import type { BotEvent } from "../bridge-types";

/** Emits bridge events to the shared webapp event stream. */
export type BridgeEmit = (event: BotEvent) => void;

/** Guild and member pair after the dashboard actor has passed a Discord permission check. */
export interface GuildPermissionContext {
  readonly guild: Guild;
  readonly member: GuildMember;
}

/** Checks direct permission or administrator override on a guild member. */
export function hasPermission(member: GuildMember, permission: bigint): boolean {
  return (
    member.permissions.has(permission) || member.permissions.has(PermissionFlagsBits.Administrator)
  );
}

/**
 * Resolves and authorizes a dashboard actor against the live Discord guild.
 * Bridge write paths call this before destructive or moderator-only actions.
 */
export async function requireGuildPermission(
  client: Client,
  guildId: string,
  actorId: string | null | undefined,
  permission: bigint,
): Promise<Result<GuildPermissionContext, Error>> {
  if (!actorId) return ErrResult(new Error("Authentication required."));
  const guild =
    client.guilds.cache.get(guildId) ?? (await client.guilds.fetch(guildId).catch(() => null));
  if (!guild) return ErrResult(new Error("Guild not in bot cache."));
  const member = await guild.members.fetch(actorId).catch(() => null);
  if (!member) return ErrResult(new Error("Actor is not in this server."));
  if (!hasPermission(member, permission)) {
    return ErrResult(new Error("Missing required Discord permission."));
  }
  return OkResult({ guild, member });
}
