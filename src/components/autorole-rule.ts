/**
 * Autorole rules and timed grants.
 *
 * `AutoroleRules` is a per-guild map of rules keyed by name (the old
 * `{guildId}:{name}` document id becomes the map key; `guildId`/`name` stay on
 * each rule so handlers match them directly). `TimedAutoroleGrant` records one
 * expiring grant per document on its own entity kind.
 */

import { z } from "zod";
import { Guild, TimedAutoroleGrant as TimedAutoroleGrantKind } from "@/components/entities";
import { defineComponent } from "@/framework";

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

export const AutoroleRuleSchema = z.object({
  guildId: z.string(),
  name: z.string(),
  enabled: z.boolean().default(true),
  trigger: AutoroleTrigger,
  roleId: z.string(),
  durationMs: z.number().nullable().default(null),
  createdAt: z.coerce.date().default(() => new Date()),
});
export type AutoroleRuleValue = z.infer<typeof AutoroleRuleSchema>;

export const AutoroleRules = defineComponent(
  Guild,
  "autoroleRules",
  z.object({
    /** rule name → rule. */
    rules: z.record(z.string(), AutoroleRuleSchema).default(() => ({})),
  }),
);
export type AutoroleRulesValue = z.infer<typeof AutoroleRules.schema>;

/** Conventional composite id for an autorole rule (used as a grant's `ruleId`). */
export function autoroleRuleId(guildId: string, name: string): string {
  return `${guildId}:${name}`;
}

export const TimedAutoroleGrant = defineComponent(
  TimedAutoroleGrantKind,
  "grant",
  z.object({
    guildId: z.string(),
    userId: z.string(),
    roleId: z.string(),
    ruleId: z.string(),
    expiresAt: z.coerce.date(),
  }),
);

export type TimedAutoroleGrantValue = z.infer<typeof TimedAutoroleGrant.schema>;
