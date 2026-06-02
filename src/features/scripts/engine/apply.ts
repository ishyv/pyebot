/**
 * Applies an operation plan against a real guild.
 *
 * Runs on the main thread (it needs the discord.js client). There is no
 * transaction across the Discord API, so each operation is attempted
 * independently and its outcome recorded — partial success is the norm. A
 * dry-run validates and reports without performing any mutation.
 */
import { ChannelType, type Guild } from "discord.js";
import type { Operation } from "./operations";

export interface ApplyOptions {
  readonly dryRun?: boolean;
}

export interface OperationResult {
  readonly operation: Operation;
  readonly ok: boolean;
  readonly error?: string;
}

export interface ApplyReport {
  readonly dryRun: boolean;
  readonly results: OperationResult[];
  readonly applied: number;
  readonly failed: number;
}

function resolveRoleId(guild: Guild, nameOrId: string): string | null {
  const byId = guild.roles.cache.get(nameOrId);
  if (byId) return byId.id;
  return guild.roles.cache.find((r) => r.name === nameOrId)?.id ?? null;
}

async function applyOne(guild: Guild, op: Operation): Promise<void> {
  switch (op.kind) {
    case "add_role":
    case "remove_role": {
      const roleId = resolveRoleId(guild, op.role);
      if (!roleId) throw new Error(`Unknown role: ${op.role}`);
      const member = await guild.members.fetch(op.userId);
      if (op.kind === "add_role") await member.roles.add(roleId);
      else await member.roles.remove(roleId);
      return;
    }
    case "dm": {
      const member = await guild.members.fetch(op.userId);
      await member.send(op.content);
      return;
    }
    case "create_channel": {
      await guild.channels.create({
        name: op.name,
        type: op.channelType === "voice" ? ChannelType.GuildVoice : ChannelType.GuildText,
      });
      return;
    }
    case "create_role": {
      await guild.roles.create({ name: op.name, color: op.color ?? undefined });
      return;
    }
  }
}

export async function applyOperations(
  guild: Guild,
  operations: readonly Operation[],
  options: ApplyOptions = {},
): Promise<ApplyReport> {
  const dryRun = options.dryRun ?? false;
  const results: OperationResult[] = [];

  for (const operation of operations) {
    if (dryRun) {
      results.push({ operation, ok: true });
      continue;
    }
    try {
      await applyOne(guild, operation);
      results.push({ operation, ok: true });
    } catch (err) {
      results.push({
        operation,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const applied = results.filter((r) => r.ok).length;
  return { dryRun, results, applied, failed: results.length - applied };
}
