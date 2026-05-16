import { type ButtonInteraction, MessageFlags, PermissionFlagsBits } from "discord.js";
import type { ModerationAction } from "./actionContract";

export interface PermissionSetLike {
  has(permission: bigint): boolean;
}

interface RequiredPermission {
  readonly permission: bigint;
  readonly label: string;
}

const ACTION_PERMISSIONS: Partial<Record<ModerationAction, RequiredPermission>> = {
  WARN: { permission: PermissionFlagsBits.ModerateMembers, label: "Moderate Members" },
  TIMEOUT: { permission: PermissionFlagsBits.ModerateMembers, label: "Moderate Members" },
  KICK: { permission: PermissionFlagsBits.KickMembers, label: "Kick Members" },
  BAN: { permission: PermissionFlagsBits.BanMembers, label: "Ban Members" },
  UNBAN: { permission: PermissionFlagsBits.BanMembers, label: "Ban Members" },
  RESTRICT: { permission: PermissionFlagsBits.ModerateMembers, label: "Moderate Members" },
  RELEASE: { permission: PermissionFlagsBits.ModerateMembers, label: "Moderate Members" },
  PURGE: { permission: PermissionFlagsBits.ManageMessages, label: "Manage Messages" },
  LOCKDOWN: { permission: PermissionFlagsBits.ManageChannels, label: "Manage Channels" },
  SLOWMODE: { permission: PermissionFlagsBits.ManageChannels, label: "Manage Channels" },
  VERIFY_KICK: { permission: PermissionFlagsBits.KickMembers, label: "Kick Members" },
  CONFIG_CHANGE: { permission: PermissionFlagsBits.ManageGuild, label: "Manage Server" },
  CASE_EDIT: { permission: PermissionFlagsBits.ModerateMembers, label: "Moderate Members" },
  CASE_DELETE: { permission: PermissionFlagsBits.ModerateMembers, label: "Moderate Members" },
};

export function requiredDiscordPermissionForAction(action: ModerationAction): bigint | null {
  return ACTION_PERMISSIONS[action]?.permission ?? null;
}

export function canUseModerationAction(
  permissions: PermissionSetLike | null | undefined,
  action: ModerationAction,
): boolean {
  const required = requiredDiscordPermissionForAction(action);
  if (!required) return true;
  return permissions?.has(required) === true;
}

export function missingModerationPermissionMessage(action: ModerationAction): string {
  const required = ACTION_PERMISSIONS[action];
  if (!required) return "You do not have permission to use this moderation action.";
  return `You need ${required.label} to use this moderation action.`;
}

export async function guardModerationComponentAction(
  interaction: ButtonInteraction,
  action: ModerationAction,
): Promise<boolean> {
  if (canUseModerationAction(interaction.memberPermissions, action)) return true;
  await interaction
    .reply({
      content: missingModerationPermissionMessage(action),
      flags: MessageFlags.Ephemeral,
    })
    .catch(() => {});
  return false;
}
