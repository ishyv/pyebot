import type { Component } from "svelte";
import ai from "./bodies/ai.svelte";
import automod from "./bodies/automod.svelte";
import autoroles from "./bodies/autoroles.svelte";
import basics from "./bodies/basics.svelte";
import channels from "./bodies/channels.svelte";
import counting from "./bodies/counting.svelte";
import economy from "./bodies/economy.svelte";
import embeds from "./bodies/embeds.svelte";
import features from "./bodies/features.svelte";
import moderation from "./bodies/moderation.svelte";
import offers from "./bodies/offers.svelte";
import quickStart from "./bodies/quick-start.svelte";
import roles from "./bodies/roles.svelte";
import rpg from "./bodies/rpg.svelte";
import tickets from "./bodies/tickets.svelte";
import tycoon from "./bodies/tycoon.svelte";
import utility from "./bodies/utility.svelte";

/** Maps topic id -> body component. Must stay in sync with GUIDE_TOPICS (orphan test). */
export const TOPIC_BODIES: Record<string, Component> = {
  ai,
  automod,
  autoroles,
  basics,
  channels,
  counting,
  economy,
  embeds,
  features,
  moderation,
  offers,
  "quick-start": quickStart,
  roles,
  rpg,
  tickets,
  tycoon,
  utility,
};
