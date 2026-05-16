/**
 * Bootstrap — assembles the framework from its primitives and produces a
 * ready-to-use dispatcher.
 *
 * Order of operations is deliberate and worth reading top-to-bottom:
 *
 *   1. Load every feature by filesystem scan (loader.ts).
 *   2. Construct the World (which owns the EventBus).
 *   3. Build the command map: every feature's commands plus the
 *      framework's auto-generated `/features`.
 *   4. Register event listeners by reading @On metadata off each
 *      feature's handlers instance.
 *   5. Build the ComponentRouter from @Handle metadata, plus the
 *      framework's own `features:toggle:` route for the panel buttons.
 *   6. Return a single `dispatch(interaction)` function that the
 *      `client.on("interactionCreate", ...)` handler invokes.
 *
 * The returned `BootstrapResult` is the only thing `src/index.ts` needs.
 * Everything above this line is internal.
 */

import type {
  AutocompleteInteraction,
  ButtonInteraction,
  ChannelSelectMenuInteraction,
  ChatInputCommandInteraction,
  Client,
  Interaction,
  MentionableSelectMenuInteraction,
  ModalSubmitInteraction,
  RoleSelectMenuInteraction,
  StringSelectMenuInteraction,
  UserSelectMenuInteraction,
} from "discord.js";
import { createLogger } from "@/core/logger";
import { buildCommandCatalog, installCommandCatalog } from "@/utils/command-registry";
import { getListenMetadata, getOnMetadata } from "./decorators";
import { loadFeatures } from "./loader";
import { isFeatureEnabled, safeReply } from "./middleware";
import { buildFeaturesCommand, buildToggleHandler, TOGGLE_CUSTOM_ID_PREFIX } from "./panel";
import { ComponentRouter } from "./router";
import type { CommandModule, Ctx, FeatureDescriptor, LoadedFeature } from "./types";
import { World } from "./world";

const log = createLogger("framework:bootstrap");

export interface BootstrapResult {
  readonly world: World;
  readonly features: ReadonlyArray<LoadedFeature>;
  readonly commands: ReadonlyArray<CommandModule>;
  dispatch(interaction: Interaction): Promise<void>;
}

/** Map a command name back to the feature it came from (or null for framework commands). */
type CommandOwner = Map<string, FeatureDescriptor | null>;

export async function bootstrapFramework(client: Client): Promise<BootstrapResult> {
  const features = await loadFeatures();
  const world = await World.create(client);
  const router = new ComponentRouter();

  const descriptors = features.map((f) => f.descriptor);

  // ─── Build command map ───────────────────────────────────────────────
  const commandMap = new Map<string, CommandModule>();
  const commandOwner: CommandOwner = new Map();

  for (const feat of features) {
    for (const cmd of feat.commands) {
      if (commandMap.has(cmd.data.name)) {
        throw new Error(
          `Duplicate command name "${cmd.data.name}" found while loading feature "${feat.descriptor.id}".`,
        );
      }
      commandMap.set(cmd.data.name, cmd);
      commandOwner.set(cmd.data.name, feat.descriptor);
    }
  }

  // Framework's own /features command — owned by null (no toggle applies).
  const featuresCommand = buildFeaturesCommand(descriptors);
  commandMap.set(featuresCommand.data.name, featuresCommand);
  commandOwner.set(featuresCommand.data.name, null);

  installCommandCatalog(buildCommandCatalog(features));

  // ─── Wire event listeners from @On metadata ──────────────────────────
  for (const feat of features) {
    if (!feat.handlers) continue;
    const entries = getOnMetadata(feat.handlers);
    for (const entry of entries) {
      const method = (feat.handlers as Record<string, unknown>)[entry.methodKey];
      if (typeof method !== "function") continue;
      const bound = (method as (...a: unknown[]) => unknown).bind(feat.handlers);
      world.bus.on(entry.event, bound as unknown as (e: unknown, c: Ctx) => Promise<void>);
    }
  }

  // ─── Wire raw Discord events from @Listen metadata ───────────────────
  for (const feat of features) {
    if (!feat.handlers) continue;
    const listens = getListenMetadata(feat.handlers);
    for (const entry of listens) {
      const method = (feat.handlers as Record<string, unknown>)[entry.methodKey];
      if (typeof method !== "function") continue;
      const bound = (method as (...a: unknown[]) => unknown).bind(feat.handlers);
      client.on(entry.event, async (...args: unknown[]) => {
        try {
          const ctx = world.forInteraction(null, feat.descriptor.id);
          await (bound as (...a: unknown[]) => unknown)(...args, ctx);
        } catch (err) {
          log.error(`@Listen("${entry.event}") on ${feat.descriptor.id} threw`, err);
        }
      });
    }
  }

  // ─── Wire component routes from @Handle metadata + framework's own ───
  for (const feat of features) router.registerFeature(feat);
  router.add(TOGGLE_CUSTOM_ID_PREFIX, "framework", async (interaction, ctx) => {
    await buildToggleHandler(descriptors)(interaction as ButtonInteraction, ctx);
  });

  // ─── Build the per-interaction dispatcher ────────────────────────────
  async function dispatch(interaction: Interaction): Promise<void> {
    try {
      if (interaction.isChatInputCommand()) {
        await handleChatInputCommand(interaction);
      } else if (interaction.isAutocomplete()) {
        await handleAutocomplete(interaction);
      } else if (
        interaction.isButton() ||
        interaction.isStringSelectMenu() ||
        interaction.isChannelSelectMenu() ||
        interaction.isMentionableSelectMenu() ||
        interaction.isRoleSelectMenu() ||
        interaction.isUserSelectMenu()
      ) {
        await handleComponent(interaction);
      } else if (interaction.isModalSubmit()) {
        await handleModalSubmit(interaction);
      }
    } catch (err) {
      log.error("Unhandled interaction error", err);
      await safeReply(interaction, "An unexpected error occurred.");
    }
  }

  async function handleChatInputCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const cmd = commandMap.get(interaction.commandName);
    if (!cmd) {
      await interaction.reply({ content: "Unknown command.", ephemeral: true });
      return;
    }
    const owner = commandOwner.get(interaction.commandName) ?? null;
    const featureId = owner?.id ?? "framework";
    const ctx = world.forInteraction(interaction, featureId);

    if (owner) {
      const enabled = await isFeatureEnabled(ctx, interaction.guildId, owner);
      if (!enabled) {
        await interaction.reply({
          content: `The **${owner.name}** feature is disabled on this server. An admin can enable it with \`/features enable ${owner.id}\`.`,
          ephemeral: true,
        });
        return;
      }
    }

    await cmd.execute(interaction, ctx);
  }

  async function handleAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const cmd = commandMap.get(interaction.commandName);
    if (!cmd?.autocomplete) return;
    const owner = commandOwner.get(interaction.commandName) ?? null;
    const featureId = owner?.id ?? "framework";
    const ctx = world.forInteraction(interaction, featureId);
    await cmd.autocomplete(interaction, ctx);
  }

  async function handleComponent(
    interaction:
      | ButtonInteraction
      | StringSelectMenuInteraction
      | ChannelSelectMenuInteraction
      | MentionableSelectMenuInteraction
      | RoleSelectMenuInteraction
      | UserSelectMenuInteraction,
  ): Promise<void> {
    const route = router.resolve(interaction.customId);
    if (!route) return; // stale buttons silently ignored
    const ctx = world.forInteraction(interaction, route.featureId);
    await route.handler(interaction, ctx);
  }

  async function handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
    const route = router.resolve(interaction.customId);
    if (!route) return; // unknown modal — silently ignore
    const ctx = world.forInteraction(interaction, route.featureId);
    await route.handler(interaction, ctx);
  }

  return {
    world,
    features,
    commands: Array.from(commandMap.values()),
    dispatch,
  };
}
