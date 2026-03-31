/**
 * Autoroles service.
 *
 * Rule-based automatic role assignment. Supports three trigger types:
 *   - onJoin: grant role when a member joins
 *   - onReact: grant role when a member reacts to a specific message with a specific emoji
 *   - messageContains: grant role when a message contains any of the specified keywords
 *
 * Rules are stored in the `autorole_rules` MongoDB collection.
 * Role grants/revokes are applied directly via Discord.js guild member API.
 */

import { z } from "zod";
import { MongoStore } from "@/db/store";
import { ErrResult, OkResult, type Result } from "@/core/result";
import { createLogger } from "@/core/logger";
import type { Guild, GuildMember } from "discord.js";

const log = createLogger("autoroles");

// ─── Schema ──────────────────────────────────────────────────────────────────

const OnJoinTriggerSchema = z.object({ type: z.literal("onJoin") });
const OnReactTriggerSchema = z.object({
  type: z.literal("onReact"),
  messageId: z.string(),
  emoji: z.string(),
});
const MessageContainsTriggerSchema = z.object({
  type: z.literal("messageContains"),
  keywords: z.array(z.string()),
});

export const AutoroleTriggerSchema = z.discriminatedUnion("type", [
  OnJoinTriggerSchema,
  OnReactTriggerSchema,
  MessageContainsTriggerSchema,
]);

export const AutoroleRuleSchema = z.object({
  _id: z.string(),
  guildId: z.string(),
  name: z.string(),
  enabled: z.boolean().catch(true),
  trigger: AutoroleTriggerSchema,
  roleId: z.string(),
  durationMs: z.number().nullable().catch(null),
  createdAt: z.coerce.date().optional().catch(undefined),
});

export type AutoroleTrigger = z.infer<typeof AutoroleTriggerSchema>;
export type AutoroleRule = z.infer<typeof AutoroleRuleSchema>;

const autoroleRulesStore = new MongoStore("autorole_rules", AutoroleRuleSchema);

function ruleId(guildId: string, name: string): string {
  return `${guildId}:${name}`;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export interface CreateRuleInput {
  guildId: string;
  name: string;
  trigger: AutoroleTrigger;
  roleId: string;
  durationMs?: number | null;
}

export async function createRule(input: CreateRuleInput): Promise<Result<AutoroleRule>> {
  const id = ruleId(input.guildId, input.name);
  const rule: AutoroleRule = {
    _id: id,
    guildId: input.guildId,
    name: input.name,
    enabled: true,
    trigger: input.trigger,
    roleId: input.roleId,
    durationMs: input.durationMs ?? null,
    createdAt: new Date(),
  };
  return autoroleRulesStore.set(id, rule);
}

export async function deleteRule(guildId: string, name: string): Promise<Result<boolean>> {
  return autoroleRulesStore.delete(ruleId(guildId, name));
}

export async function listRules(guildId: string): Promise<Result<AutoroleRule[]>> {
  try {
    const col = await autoroleRulesStore.collection();
    const docs = await col.find({ guildId } as never).toArray();
    return OkResult(docs.map((d) => AutoroleRuleSchema.parse(d)));
  } catch (err) {
    return ErrResult(err instanceof Error ? err : new Error(String(err)));
  }
}

export async function setEnabled(
  guildId: string,
  name: string,
  enabled: boolean,
): Promise<Result<boolean>> {
  try {
    const col = await autoroleRulesStore.collection();
    const res = await col.updateOne(
      { _id: ruleId(guildId, name) } as never,
      { $set: { enabled } } as never,
    );
    return OkResult(res.matchedCount > 0);
  } catch (err) {
    return ErrResult(err instanceof Error ? err : new Error(String(err)));
  }
}

// ─── Apply helpers ────────────────────────────────────────────────────────────

async function grantRole(member: GuildMember, roleId: string, reason: string): Promise<void> {
  try {
    if (!member.roles.cache.has(roleId)) {
      await member.roles.add(roleId, reason);
    }
  } catch (err) {
    log.error("Failed to grant role", { userId: member.id, roleId, err });
  }
}

/**
 * Apply all enabled `onJoin` rules for the guild to a new member.
 */
export async function applyJoinRules(guild: Guild, member: GuildMember): Promise<void> {
  const result = await listRules(guild.id);
  if (result.isErr()) return;

  for (const rule of result.unwrap()) {
    if (!rule.enabled) continue;
    if (rule.trigger.type !== "onJoin") continue;
    await grantRole(member, rule.roleId, `autorole:${rule.name}`);
  }
}

/**
 * Apply all enabled `onReact` rules matching the given message + emoji.
 */
export async function applyReactRules(
  guild: Guild,
  member: GuildMember,
  messageId: string,
  emoji: string,
): Promise<void> {
  const result = await listRules(guild.id);
  if (result.isErr()) return;

  for (const rule of result.unwrap()) {
    if (!rule.enabled) continue;
    if (rule.trigger.type !== "onReact") continue;
    if (rule.trigger.messageId !== messageId) continue;
    if (rule.trigger.emoji !== emoji && rule.trigger.emoji !== "*") continue;
    await grantRole(member, rule.roleId, `autorole:${rule.name}`);
  }
}

/**
 * Check if a message triggers any `messageContains` rules and grant roles.
 */
export async function applyMessageContainsRules(
  guild: Guild,
  member: GuildMember,
  content: string,
): Promise<void> {
  const result = await listRules(guild.id);
  if (result.isErr()) return;

  const lower = content.toLowerCase();

  for (const rule of result.unwrap()) {
    if (!rule.enabled) continue;
    if (rule.trigger.type !== "messageContains") continue;
    const matches = rule.trigger.keywords.some((kw) => lower.includes(kw.toLowerCase()));
    if (matches) {
      await grantRole(member, rule.roleId, `autorole:${rule.name}`);
    }
  }
}
