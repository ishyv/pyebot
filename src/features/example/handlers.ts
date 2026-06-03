/**
 * Handlers route component interactions (buttons, selects, modals) and react to
 * events. The framework discovers the decorated methods on this default-exported
 * class at boot — you never register them in src/index.ts.
 *
 *   @Handle(prefix)        — component customIds starting with `prefix`
 *   @On(EventClass)        — framework event bus (e.g. MemberJoined)
 *   @Listen("discordEvent") — raw discord.js client events
 *
 * This example ships ONLY a @Handle route, because it is safe: a prefix route
 * fires only when a user clicks a button this feature created, which only
 * exists while the feature is enabled. The @On / @Listen examples below are
 * intentionally left as commented documentation — see the caveat on @Listen.
 */

import type { ButtonInteraction } from "discord.js";
import { MessageFlags } from "discord.js";
import { type Ctx, Handle } from "@/framework";
import { parseCustomId } from "@/ui/customId";

export default class ExampleHandlers {
  @Handle("example:")
  async onButton(interaction: ButtonInteraction, _ctx: Ctx): Promise<void> {
    // Decode the customId into named segments. parseCustomId returns null if
    // the segment count doesn't match the layout, so guard before reading.
    const parts = parseCustomId(interaction.customId, ["feature", "action", "userId"] as const);
    if (!parts || parts.action !== "greet") return; // not ours / stale — ignore

    const wavedBack = parts.userId === interaction.user.id;
    await interaction.reply({
      content: wavedBack ? "👋 You waved back at yourself!" : "👋 Wave received.",
      flags: MessageFlags.Ephemeral,
    });
  }

  // ── Event hooks (documentation only) ──────────────────────────────────────
  //
  // Framework bus event — fires when the framework emits a typed event:
  //
  //   @On(MemberJoined)
  //   async onJoin(event: MemberJoined, ctx: Ctx): Promise<void> { ... }
  //
  // Raw discord.js event. CAUTION: @Listen handlers bypass the feature toggle —
  // they run in every guild even when this feature is disabled. If you add one,
  // self-gate it (check the feature is enabled for the guild) and bail on bot
  // authors. See src/features/counting/handlers.ts for the real pattern:
  //
  //   @Listen("messageCreate")
  //   async onMessage(message: Message, ctx: Ctx): Promise<void> {
  //     if (message.author.bot || !message.guildId) return;
  //     // ...resolve guild config, check resolveFeatureEnabled(...), then act
  //   }
}
