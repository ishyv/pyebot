/**
 * Permission middleware.
 *
 * Purpose: Check Discord permissions before executing commands.
 * Usage (imperative): Call hasPermission() in command handlers for fine-grained checks.
 * Usage (pipeline):   Pass requirePermissions(...perms) in a command's middleware array.
 *
 * Note: Slash commands with setDefaultMemberPermissions() enforce permissions
 * at the Discord API level. These helpers are for runtime checks where finer
 * control is needed (e.g. checking bot permissions before attempting an action).
 */

import type { GuildMember, PermissionResolvable } from "discord.js";
import type { MiddlewareFn } from "@/core/feature";
import { ErrResult, OkResult } from "@/core/result";

/**
 * Returns true if the member has all of the specified permissions.
 */
export function hasPermission(
  member: GuildMember,
  ...permissions: PermissionResolvable[]
): boolean {
  return permissions.every((perm) => member.permissions.has(perm));
}

/**
 * Returns the first missing permission, or null if the member has all of them.
 */
export function missingPermission(
  member: GuildMember,
  ...permissions: PermissionResolvable[]
): PermissionResolvable | null {
  return permissions.find((perm) => !member.permissions.has(perm)) ?? null;
}

/**
 * Middleware factory: checks that the invoking member has all given permissions.
 *
 * Usage in a command middleware list:
 *   middleware: [requirePermissions(PermissionFlagsBits.BanMembers)]
 *
 * This is a runtime check. For UI-level hiding, also set setDefaultMemberPermissions()
 * on the SlashCommandBuilder.
 */
export function requirePermissions(...permissions: PermissionResolvable[]): MiddlewareFn {
  return async (interaction) => {
    const member = interaction.member;
    if (!member || typeof member.permissions === "string") {
      return ErrResult({ content: "Could not verify your permissions." });
    }
    const missing = permissions.find(
      (perm) => !(member.permissions as { has(p: PermissionResolvable): boolean }).has(perm),
    );
    if (missing) {
      return ErrResult({ content: "You don't have permission to use this command." });
    }
    return OkResult(undefined);
  };
}
