/**
 * GuildAutomod — link-spam, domain-whitelist, and shortener-resolution
 * configuration for the automod feature.
 *
 * Stored separately from other guild config because automod is the only
 * subsystem that reads it on every single message — keeping it small and
 * focused saves bandwidth on a hot path.
 */

import { z } from "zod";
import { component } from "@/framework/component";

const LinkSpam = z.object({
  enabled: z.boolean().default(false),
  maxLinks: z.number().int().default(4),
  windowSeconds: z.number().int().default(10),
  timeoutSeconds: z.number().int().default(300),
  action: z.enum(["timeout", "mute", "delete", "report"]).default("timeout"),
  reportChannelId: z.string().nullable().default(null),
});

const DomainWhitelist = z.object({
  enabled: z.boolean().default(false),
  domains: z.array(z.string()).default(() => []),
});

const Shorteners = z.object({
  enabled: z.boolean().default(false),
  resolveFinalUrl: z.boolean().default(false),
  allowedShorteners: z.array(z.string()).default(() => [
    "bit.ly", "t.co", "tinyurl.com", "cutt.ly", "is.gd", "rebrand.ly", "goo.gl",
  ]),
});

export const GuildAutomod = component({
  collection: "guild_automod",
  schema: z.object({
    linkSpam: LinkSpam.default(() => ({
      enabled: false, maxLinks: 4, windowSeconds: 10, timeoutSeconds: 300,
      action: "timeout" as const, reportChannelId: null,
    })),
    domainWhitelist: DomainWhitelist.default(() => ({ enabled: false, domains: [] })),
    shorteners: Shorteners.default(() => ({
      enabled: false, resolveFinalUrl: false,
      allowedShorteners: ["bit.ly", "t.co", "tinyurl.com", "cutt.ly", "is.gd", "rebrand.ly", "goo.gl"],
    })),
  }),
});

export type GuildAutomodValue = z.infer<typeof GuildAutomod.schema>;
