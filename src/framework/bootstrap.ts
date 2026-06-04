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
import { MessageFlags } from "discord.js";
import { setFeatureCatalog } from "@/core/featureCatalog";
import { createLogger } from "@/core/logger";
import { FEATURE_CONFIGS } from "@/features/config";
import { loadFeatures } from "./loader";
import { isAdmin, isFeatureEnabled, safeReply } from "./middleware";
import { buildFeaturesCommand, buildToggleRegistrations } from "./panel";
import { ComponentRouter } from "./router";
import type { CommandModule, FeatureDescriptor, LoadedFeature } from "./types";
import { World } from "./world";

const log = createLogger("framework:bootstrap");

export interface BootstrapResult {
  readonly world: World;
  readonly features: ReadonlyArray<LoadedFeature>;
  readonly commands: ReadonlyArray<CommandModule>;
  dispatch(interaction: Interaction): Promise<void>;
}

type BootstrapDependencies = {
  loadFeatures(): Promise<LoadedFeature[]>;
  createWorld(client: Client): Promise<World>;
};

const defaultBootstrapDependencies: BootstrapDependencies = {
  loadFeatures,
  createWorld: (client) => World.create(client),
};

/** Map a command name back to the feature it came from (or null for framework commands). */
type CommandOwner = Map<string, FeatureDescriptor | null>;

/**
 * Assemble the framework dispatcher with production dependencies by default.
 * Tests may pass explicit dependencies to avoid process-wide module mocks.
 */
export async function bootstrapFramework(
  client: Client,
  dependencies: BootstrapDependencies = defaultBootstrapDependencies,
): Promise<BootstrapResult> {
  const features = await dependencies.loadFeatures();
  setFeatureCatalog(features, FEATURE_CONFIGS);
  const world = await dependencies.createWorld(client);
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

  // ─── Wire every trigger from the normalized registration list ────────
  // The loader produced these from either the legacy decorated class or the new
  // defineHandlers([...]) array, so this single pass covers both authoring styles.
  for (const feat of features) {
    const featureId = feat.descriptor.id;
    for (const reg of feat.registrations) {
      switch (reg.kind) {
        case "component":
          router.add(reg.prefix, featureId, reg.run);
          break;
        case "event":
          world.bus.on(reg.ctor, reg.run);
          break;
        case "listen":
          client.on(reg.event, async (...args: unknown[]) => {
            try {
              const ctx = world.forInteraction(null, featureId);
              await reg.run(...args, ctx);
            } catch (err) {
              log.error(`listen("${reg.event}") on ${featureId} threw`, err);
            }
          });
          break;
      }
    }
  }

  // Framework's own component route for the /features panel toggle buttons,
  // built through the same route core as feature handlers.
  for (const reg of buildToggleRegistrations(descriptors)) {
    if (reg.kind === "component") router.add(reg.prefix, "framework", reg.run);
  }

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
      await interaction.reply({ content: "Unknown command.", flags: MessageFlags.Ephemeral });
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
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }

    if (cmd.requiresAdmin && !isAdmin(interaction)) {
      await interaction.reply({
        content: "You need Manage Server permission to use this command.",
        flags: MessageFlags.Ephemeral,
      });
      return;
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
