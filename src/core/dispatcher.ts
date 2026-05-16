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

import { type Interaction, MessageFlags } from "discord.js";
import { createInteractionResponder, type InteractionResponder } from "@/core/interactionResponder";
import { createLogger } from "@/core/logger";
import { runMiddleware } from "@/core/middleware";
import type { FeatureRegistry } from "@/core/registry";
import { getGuild } from "@/db/repositories/guilds";
import { featureGateMw } from "@/middleware/featureGate";
import { guildOnly } from "@/middleware/guildOnly";

const log = createLogger("dispatcher");

export function createDispatcher(registry: FeatureRegistry) {
  return async function dispatch(interaction: Interaction): Promise<void> {
    let responder: InteractionResponder | null = null;
    let errorContext: Record<string, string> = {};
    try {
      // -----------------------------------------------------------------
      // Slash commands
      // -----------------------------------------------------------------
      if (interaction.isChatInputCommand()) {
        responder = createInteractionResponder(interaction);
        const entry = registry.getCommand(interaction.commandName);
        if (!entry) {
          await responder.send({ content: "Unknown command.", flags: MessageFlags.Ephemeral });
          return;
        }

        const { feature, command } = entry;
        errorContext = {
          commandName: interaction.commandName,
          featureId: feature.id,
          guildId: interaction.guildId ?? "",
          userId: interaction.user.id,
        };

        // Fetch guild config once; commands use ctx.guildConfig instead of calling getGuild()
        const guildId = interaction.guildId ?? "";
        const guildResult = await getGuild(guildId);
        const guildConfig = guildResult.isOk() ? guildResult.unwrap() : null;

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
          respond: responder,
        };

        if (command.response?.defer === "immediate") {
          const result = await responder.defer({ visibility: command.response.visibility });
          if (result.isErr()) {
            log.warn("Failed to defer interaction before command execution", {
              ...errorContext,
              kind: result.error.kind,
            });
            return;
          }
        }

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
        interaction.isButton() ||
        interaction.isStringSelectMenu() ||
        interaction.isChannelSelectMenu() ||
        interaction.isMentionableSelectMenu() ||
        interaction.isRoleSelectMenu() ||
        interaction.isUserSelectMenu() ||
        interaction.isModalSubmit()
      ) {
        const customId = interaction.customId;
        const entry = registry.getComponentHandler(customId);
        if (!entry) return; // unknown component — silently ignore

        const { feature, handler } = entry;

        // Feature gate for components
        if (feature.featureGate && interaction.guildId) {
          const guildResult = await getGuild(interaction.guildId);
          const cfg = guildResult.isOk() ? guildResult.unwrap() : null;
          if (cfg) {
            const enabled = (cfg.features as Record<string, boolean>)[feature.featureGate];
            if (enabled === false) {
              try {
                await interaction.reply({
                  content: "This feature is disabled.",
                  flags: MessageFlags.Ephemeral,
                });
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
      log.error("Unhandled interaction error", { ...errorContext, err });
      const replyResult = await (responder ?? createInteractionResponder(interaction)).fail({
        content: "An unexpected error occurred.",
      });
      if (replyResult.isErr()) {
        log.warn("Failed to send interaction error response", {
          ...errorContext,
          kind: replyResult.error.kind,
        });
      }
    }
  };
}
