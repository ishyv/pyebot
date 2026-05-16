/**
 * AutoroleRule — a single autorole entry, keyed by `${guildId}:${name}`.
 *
 * Trigger kinds are represented as a discriminated union so commands narrow
 * untrusted Discord input once, then handlers can match rules directly.
 */

import { z } from "zod";
import { component } from "@/framework/component";

const OnJoinTrigger = z.object({ type: z.literal("onJoin") });
const OnReactTrigger = z.object({
  type: z.literal("onReact"),
  messageId: z.string(),
  emoji: z.string(),
});
const OnButtonTrigger = z.object({
  type: z.literal("onButton"),
  messageId: z.string(),
  label: z.string(),
});
const MessageContainsTrigger = z.object({
  type: z.literal("messageContains"),
  keywords: z.array(z.string()),
});

export const AutoroleTrigger = z.discriminatedUnion("type", [
  OnJoinTrigger,
  OnReactTrigger,
  OnButtonTrigger,
  MessageContainsTrigger,
]);
export type AutoroleTriggerValue = z.infer<typeof AutoroleTrigger>;

export const AutoroleRule = component({
  collection: "autorole_rules",
  schema: z.object({
    guildId: z.string(),
    name: z.string(),
    enabled: z.boolean().default(true),
    trigger: AutoroleTrigger,
    roleId: z.string(),
    durationMs: z.number().nullable().default(null),
    createdAt: z.coerce.date().default(() => new Date()),
  }),
});

export type AutoroleRuleValue = z.infer<typeof AutoroleRule.schema>;

/** Conventional composite id for an autorole rule. */
export function autoroleRuleId(guildId: string, name: string): string {
  return `${guildId}:${name}`;
}

export const TimedAutoroleGrant = component({
  collection: "timed_autorole_grants",
  schema: z.object({
    guildId: z.string(),
    userId: z.string(),
    roleId: z.string(),
    ruleId: z.string(),
    expiresAt: z.coerce.date(),
  }),
});

export type TimedAutoroleGrantValue = z.infer<typeof TimedAutoroleGrant.schema>;
