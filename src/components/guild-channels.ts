/**
 * GuildChannels — every "well-known" channel a guild has configured.
 *
 * Two namespaces:
 *   - `core`: predefined channel roles (welcome, logs, reports, etc.)
 *   - `managed`: user-defined channel slots ("send announcements here").
 *
 * Plus a few ticket-system-specific fields that didn't earn their own
 * component because they only matter alongside the channel map.
 */

import { z } from "zod";
import { component } from "@/framework/component";

const CoreChannel = z.object({ channelId: z.string() });
const ManagedChannel = z.object({ id: z.string(), label: z.string(), channelId: z.string() });

export const GuildChannels = component({
  collection: "guild_channels",
  schema: z.object({
    core: z.record(z.string(), CoreChannel.nullable()).default(() => ({
      welcome: null,
      goodbye: null,
      logs: null,
      reports: null,
      suggestions: null,
      tickets: null,
    })),
    managed: z.record(z.string(), ManagedChannel).default(() => ({})),
    ticketMessageId: z.string().nullable().default(null),
    ticketHelperRoles: z.array(z.string()).default(() => []),
    ticketCategoryId: z.string().nullable().default(null),
  }),
});

export type GuildChannelsValue = z.infer<typeof GuildChannels.schema>;
