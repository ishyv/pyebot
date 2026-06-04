/**
 * Shared option-set factories for moderation commands.
 *
 * Each factory follows the `.build(factory)` convention introduced on both
 * `CommandDsl<S>` (top-level commands) and `CommandOptionDsl<O>` (subcommand
 * builders). Import the appropriate variant:
 *
 *   - `withModTarget`    — for subcommand builders inside `.subcommand()`
 *   - `withModTargetCmd` — for top-level commands that add options directly
 *
 * Usage:
 * ```typescript
 * // Inside a subcommand builder:
 * .subcommand({
 *   name: "add",
 *   description: "Issue a warning",
 *   options: (s) => s.build(withModTarget).string("note", "Extra context"),
 * })
 *
 * // At the top level:
 * command("kick")
 *   .build(withModTargetCmd)
 *   .string("notify", "DM the user", { choices: [...] })
 * ```
 */

import type { CommandDsl, CommandOptionDsl, DslState } from "@/framework";

/** Adds `user` (required) + `reason` (required, ≤512 chars) to a subcommand option builder. */
export const withModTarget = <O extends Record<string, unknown>>(s: CommandOptionDsl<O>) =>
  s
    .user("user", "Target member", { required: true })
    .string("reason", "Reason", { required: true, max: 512 });

/** Adds `user` (required) + `reason` (required, ≤512 chars) to a top-level command builder. */
export const withModTargetCmd = <S extends DslState>(s: CommandDsl<S>) =>
  s
    .user("user", "Target member", { required: true })
    .string("reason", "Reason", { required: true, max: 512 });

/** Adds only `user` (required) — for list/history subcommands that need a target but no reason. */
export const withModUser = <O extends Record<string, unknown>>(s: CommandOptionDsl<O>) =>
  s.user("user", "Target member", { required: true });
