/**
 * Environment validation and Discord permission helpers.
 *
 * The dashboard only needs OAuth credentials — guild data comes from the bot
 * bridge, not a Discord REST token. Required env is checked once at startup
 * via `requireEnv`; downstream callers can assume the values are present.
 */

import dotenv from "dotenv";

dotenv.config();

export type DashboardSession = {
  id: string;
  userId: string;
  username: string;
  avatarUrl: string | null;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: string;
  scope: string;
  expiresAt: string;
};

export type DiscordUserGuild = {
  id: string;
  name: string;
  icon: string | null;
  permissions: string;
  owner: boolean;
};

export type DashboardEnv = {
  MONGO_URI: string;
  DB_NAME: string;
  DISCORD_CLIENT_ID: string;
  DISCORD_CLIENT_SECRET: string;
  SESSION_SECRET: string;
};

const ADMINISTRATOR = 0x8n;
const MANAGE_GUILD = 0x20n;

const REQUIRED_KEYS = [
  "MONGO_URI",
  "DB_NAME",
  "DISCORD_CLIENT_ID",
  "DISCORD_CLIENT_SECRET",
  "SESSION_SECRET",
] as const;

const DISCORD_SNOWFLAKE = /^\d{17,20}$/;
const DISCORD_TOKEN_SHAPED = /^[^.]+\.[^.]+\.[^.]+$/;

export function hasGuildManagementPermission(guild: {
  permissions?: string | bigint;
  owner?: boolean;
}): boolean {
  if (guild.owner === true) return true;
  const { permissions } = guild;
  if (permissions === undefined || permissions === null) return false;
  try {
    const bits = BigInt(permissions);
    return (bits & ADMINISTRATOR) === ADMINISTRATOR || (bits & MANAGE_GUILD) === MANAGE_GUILD;
  } catch {
    return false;
  }
}

export function requireEnv(
  source: Partial<Record<keyof DashboardEnv, string | undefined>> = process.env,
): DashboardEnv {
  const missing = REQUIRED_KEYS.filter((key) => !source[key]);
  if (missing.length > 0) {
    throw new Error(`Missing dashboard environment: ${missing.join(", ")}`);
  }
  if (!DISCORD_SNOWFLAKE.test(source.DISCORD_CLIENT_ID as string)) {
    throw new Error(
      "DISCORD_CLIENT_ID must be the numeric Discord application client id, not the bot token",
    );
  }
  if (DISCORD_TOKEN_SHAPED.test(source.DISCORD_CLIENT_SECRET as string)) {
    throw new Error("DISCORD_CLIENT_SECRET must be the OAuth client secret, not the bot token");
  }
  return Object.fromEntries(
    REQUIRED_KEYS.map((key) => [key, source[key] as string]),
  ) as DashboardEnv;
}
