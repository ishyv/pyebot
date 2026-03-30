/**
 * Permission middleware.
 *
 * Purpose: Check Discord permissions before executing commands.
 * Usage: Call hasPermission() in command handlers that require elevated access.
 *
 * Note: Slash commands with setDefaultMemberPermissions() enforce permissions
 * at the Discord API level. These helpers are for runtime checks where finer
 * control is needed (e.g. checking bot permissions before attempting an action).
 */

import type { GuildMember, PermissionResolvable } from "discord.js";

/**
 * Returns true if the member has all of the specified permissions.
 */
export function hasPermission(member: GuildMember, ...permissions: PermissionResolvable[]): boolean {
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
