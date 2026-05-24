import type { GuideBadge } from "@/webapp/bridge-types";

export type GuideCapabilityId =
  | "protection"
  | "server_ops"
  | "engagement"
  | "publishing"
  | "ai_tools"
  | "other";

export interface GuideCapabilityMetadata {
  readonly id: GuideCapabilityId;
  readonly label: string;
  readonly description: string;
}

export interface GuideDashboardMetadata {
  readonly label: string;
  readonly path: string;
  readonly description: string;
  readonly badges?: readonly GuideBadge[];
}

export interface GuideFeatureMetadata {
  readonly capabilityId: GuideCapabilityId;
  readonly dashboardPages?: readonly GuideDashboardMetadata[];
}

/** Capability labels used to group runtime-derived bot surfaces in the guide graph. */
export const GUIDE_CAPABILITIES = {
  protection: {
    id: "protection",
    label: "protection",
    description: "Moderation, automod, cases, appeals, and abuse controls.",
  },
  server_ops: {
    id: "server_ops",
    label: "server ops",
    description: "Server setup, tickets, roles, channels, and operational workflows.",
  },
  engagement: {
    id: "engagement",
    label: "engagement",
    description: "Games, economy loops, RPG progression, and activity systems.",
  },
  publishing: {
    id: "publishing",
    label: "publishing",
    description: "Embeds, offers, prompts, and content sent into server channels.",
  },
  ai_tools: {
    id: "ai_tools",
    label: "ai/tools",
    description: "AI and utility commands that help members or administrators.",
  },
  other: {
    id: "other",
    label: "other",
    description: "Loaded features without curated guide grouping yet.",
  },
} as const satisfies Record<GuideCapabilityId, GuideCapabilityMetadata>;

/**
 * Human-facing guide metadata. Runtime surfaces still come from the loader,
 * decorators, and command builders; this map only supplies grouping and links.
 */
export const GUIDE_FEATURE_METADATA: Readonly<Record<string, GuideFeatureMetadata>> = {
  adminPanels: {
    capabilityId: "server_ops",
    dashboardPages: [
      {
        label: "feature toggles",
        path: "/features",
        description: "Enable or disable loaded bot features for this server.",
      },
      {
        label: "channels",
        path: "/channels",
        description: "Choose where bot logs, reports, and managed messages go.",
      },
      {
        label: "roles",
        path: "/roles",
        description: "Manage role policies and Discord role bindings.",
      },
    ],
  },
  ai: {
    capabilityId: "ai_tools",
  },
  automod: {
    capabilityId: "protection",
    dashboardPages: [
      {
        label: "automod",
        path: "/automod",
        description: "Configure spam detectors, image detection, and policy settings.",
      },
    ],
  },
  autoroles: {
    capabilityId: "server_ops",
  },
  counting: {
    capabilityId: "engagement",
  },
  economy: {
    capabilityId: "engagement",
    dashboardPages: [
      {
        label: "economy",
        path: "/economy",
        description: "Tune daily rewards, work payouts, and tax settings.",
      },
    ],
  },
  embeds: {
    capabilityId: "publishing",
    dashboardPages: [
      {
        label: "embeds",
        path: "/embeds",
        description: "Build, preview, send, schedule, and sticky custom embeds.",
      },
    ],
  },
  moderation: {
    capabilityId: "protection",
    dashboardPages: [
      {
        label: "moderation",
        path: "/moderation",
        description: "Review cases, appeals, moderation channels, and live actions.",
      },
    ],
  },
  offers: {
    capabilityId: "publishing",
  },
  rpg: {
    capabilityId: "engagement",
  },
  tickets: {
    capabilityId: "server_ops",
  },
  utility: {
    capabilityId: "ai_tools",
  },
} as const satisfies Record<string, GuideFeatureMetadata>;
