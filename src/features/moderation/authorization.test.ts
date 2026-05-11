import { describe, expect, it } from "bun:test";
import { PermissionFlagsBits } from "discord.js";
import {
  canUseModerationAction,
  missingModerationPermissionMessage,
  requiredDiscordPermissionForAction,
} from "./authorization";

describe("moderation authorization", () => {
  it("maps destructive moderation actions to Discord permissions", () => {
    expect(requiredDiscordPermissionForAction("BAN")).toBe(PermissionFlagsBits.BanMembers);
    expect(requiredDiscordPermissionForAction("UNBAN")).toBe(PermissionFlagsBits.BanMembers);
    expect(requiredDiscordPermissionForAction("TIMEOUT")).toBe(PermissionFlagsBits.ModerateMembers);
    expect(requiredDiscordPermissionForAction("LOCKDOWN")).toBe(PermissionFlagsBits.ManageChannels);
  });

  it("allows actions only when member permissions contain the required Discord permission", () => {
    const permissions = {
      has: (permission: bigint) => permission === PermissionFlagsBits.BanMembers,
    };

    expect(canUseModerationAction(permissions, "BAN")).toBe(true);
    expect(canUseModerationAction(permissions, "TIMEOUT")).toBe(false);
  });

  it("renders a clear denial message", () => {
    expect(missingModerationPermissionMessage("LOCKDOWN")).toContain("Manage Channels");
  });
});
