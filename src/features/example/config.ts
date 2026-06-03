/**
 * Feature config is the bridge from feature-owned settings to the admin
 * dashboard / `/features` surfaces. Declaring a field here makes it editable
 * without writing any UI. The descriptor in index.ts stays loader-only; this
 * map is the explicit, separate channel for settings.
 *
 * Wiring step: a config object does nothing until it is registered in
 * `src/features/config.ts` under the matching feature id. See that file.
 */

import { ChannelType } from "discord.js";
import { channelConfigField, defineFeatureConfig } from "@/core/featureConfig";

export const exampleFeatureConfig = defineFeatureConfig({
  fields: {
    // One optional channel field. `path` is the dot-path where the value is
    // persisted on the guild config document. Other field kinds exist
    // (`stringConfigField`, `selectConfigField`, …) in `@/core/featureConfig`.
    channel: channelConfigField({
      key: "channel",
      label: "Example channel",
      description: "Optional channel the example feature could post to.",
      path: "example.channelId",
      required: false,
      channelTypes: [ChannelType.GuildText],
    }),
  },
});
