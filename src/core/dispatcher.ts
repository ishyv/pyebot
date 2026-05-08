/**
 * Interaction dispatcher.
 *
 * Single interactionCreate handler that routes to the correct command or component.
 * Registered once in bootstrap — no event listeners in individual feature files.
 *
 * Command flow:
 *   1. Look up command in registry
 *   2. Build CommandContext (guild config fetched once, shared with all middleware + execute)
 *   3. Run middleware pipeline [guildOnly, featureGate, ...command.middleware]
 *   4. Call execute(interaction, ctx)
 *
 * Component flow:
 *   1. Linear scan of registered ComponentHandlers
 *   2. Check feature gate (if featureGate is set)
 *   3. Call handle(interaction)
 *
 * Both paths share the same top-level error handler (best-effort reply).
 */

import { MessageFlags, type Interaction } from "discord.js";
import type { FeatureRegistry } from "@/core/registry";
import { runMiddleware } from "@/core/middleware";
import { guildOnly } from "@/middleware/guildOnly";
import { featureGateMw } from "@/middleware/featureGate";
import { getGuild } from "@/db/repositories/guilds";
import { createLogger } from "@/core/logger";

const log = createLogger("dispatcher");

export function createDispatcher(registry: FeatureRegistry) {
  return async function dispatch(interaction: Interaction): Promise<void> {
    try {
      // -----------------------------------------------------------------
      // Slash commands
      // -----------------------------------------------------------------
      if (interaction.isChatInputCommand()) {
        const entry = registry.getCommand(interaction.commandName);
        if (!entry) {
          await interaction.reply({ content: "Unknown command.", flags: MessageFlags.Ephemeral });
          return;
        }

        const { feature, command } = entry;

        // Fetch guild config once; commands use ctx.guildConfig instead of calling getGuild()
        const guildId = interaction.guildId ?? "";
        const guildResult = await getGuild(guildId);
        const guildConfig = guildResult.isOk() && guildResult.unwrap()
          ? guildResult.unwrap()!
          : null;

        // If we can't fetch guild config, guildOnly will short-circuit anyway for guild commands
        // Pass a fallback schema default for DM commands (rare)
        const { GuildSchema } = await import("@/db/schemas/guild");
        const resolvedConfig = guildConfig ?? GuildSchema.parse({ _id: guildId });

        const ctx = {
          guildId,
          userId: interaction.user.id,
          commandName: interaction.commandName,
          featureId: feature.id,
          guildConfig: resolvedConfig,
        };

        const pipeline = [
          guildOnly(),
          ...(feature.featureGate ? [featureGateMw(feature.featureGate)] : []),
          ...(command.middleware ?? []),
        ];

        const passed = await runMiddleware(pipeline, interaction, ctx);
        if (!passed) return;

        await command.execute(interaction, ctx);
        return;
      }

      // -----------------------------------------------------------------
      // Component interactions (buttons, select menus, modals)
      // -----------------------------------------------------------------
      if (
        interaction.isButton()
        || interaction.isStringSelectMenu()
        || interaction.isChannelSelectMenu()
        || interaction.isMentionableSelectMenu()
        || interaction.isRoleSelectMenu()
        || interaction.isUserSelectMenu()
        || interaction.isModalSubmit()
      ) {
        const customId = interaction.customId;
        const entry = registry.getComponentHandler(customId);
        if (!entry) return; // unknown component — silently ignore

        const { feature, handler } = entry;

        // Feature gate for components
        if (feature.featureGate && interaction.guildId) {
          const guildResult = await getGuild(interaction.guildId);
          if (guildResult.isOk() && guildResult.unwrap()) {
            const cfg = guildResult.unwrap()!;
            const enabled = (cfg.features as Record<string, boolean>)[feature.featureGate];
            if (enabled === false) {
              try {
                await interaction.reply({ content: "This feature is disabled.", flags: MessageFlags.Ephemeral });
              } catch {
                // ignore
              }
              return;
            }
          }
        }

        await handler.handle(interaction);
        return;
      }
    } catch (err) {
      log.error("Unhandled interaction error", err);
      try {
        const i = interaction as { replied?: boolean; deferred?: boolean; reply?: (o: object) => Promise<void>; followUp?: (o: object) => Promise<void> };
        const msg = { content: "An unexpected error occurred.", flags: MessageFlags.Ephemeral };
        if (i.replied || i.deferred) {
          await i.followUp?.(msg);
        } else {
          await i.reply?.(msg);
        }
      } catch {
        // best-effort — ignore if we can't reply
      }
    }
  };
}
