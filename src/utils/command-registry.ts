import { ApplicationCommandOptionType } from "discord.js";
import type { CommandHelp, FeatureDescriptor, LoadedFeature } from "@/framework";

export interface CommandArgMeta {
  readonly name: string;
  readonly description: string;
  readonly required?: boolean;
}

export interface CommandMeta {
  readonly featureId: string;
  readonly featureName: string;
  readonly name: string;
  readonly description: string;
  readonly hints: readonly string[];
  readonly requires?: string;
  readonly args: readonly CommandArgMeta[];
}

export interface FeatureCommandGroup {
  readonly feature: FeatureDescriptor;
  readonly commands: readonly CommandMeta[];
}

export interface CommandCatalog {
  readonly features: readonly FeatureCommandGroup[];
  readonly commandsByName: ReadonlyMap<string, CommandMeta>;
}

type SlashCommandJson = {
  readonly name?: unknown;
  readonly description?: unknown;
  readonly options?: readonly SlashCommandOptionJson[];
};

type SlashCommandOptionJson = {
  readonly type?: unknown;
  readonly name?: unknown;
  readonly description?: unknown;
  readonly required?: unknown;
  readonly options?: readonly SlashCommandOptionJson[];
};

let installedCatalog: CommandCatalog = {
  features: [],
  commandsByName: new Map(),
};

/**
 * Builds the help catalog from the same loaded features used by dispatch.
 *
 * Command names, descriptions, and argument descriptions come from Discord's
 * slash-command JSON. `help` only carries curated guidance that Discord does
 * not know about, which keeps `/help` from becoming a second command registry.
 */
export function buildCommandCatalog(features: ReadonlyArray<LoadedFeature>): CommandCatalog {
  const allCommandNames = new Set<string>();
  for (const feature of features) {
    for (const command of feature.commands) allCommandNames.add(command.data.name);
  }

  const commandsByName = new Map<string, CommandMeta>();
  const groups: FeatureCommandGroup[] = [];

  for (const feature of features) {
    const commands: CommandMeta[] = [];

    for (const command of feature.commands) {
      const help = command.help;
      if (help === false) continue;
      if (!isCommandHelpObject(help)) {
        throw new Error(
          `Command "${command.data.name}" must declare help metadata or help: false.`,
        );
      }

      validateHints(command.data.name, help.hints ?? [], allCommandNames);
      const json = command.data.toJSON() as SlashCommandJson;
      const name = stringValue(json.name) ?? command.data.name;
      const description = stringValue(json.description) ?? "";
      const meta: CommandMeta = {
        featureId: feature.descriptor.id,
        featureName: feature.descriptor.name,
        name,
        description,
        hints: help.hints ?? [],
        requires: help.requires,
        args: collectArgs(json.options ?? []),
      };
      commands.push(meta);
      commandsByName.set(name, meta);
    }

    if (commands.length > 0) {
      groups.push({ feature: feature.descriptor, commands });
    }
  }

  return { features: groups, commandsByName };
}

/** Installs the boot-built catalog used by `/help` and footer hint helpers. */
export function installCommandCatalog(catalog: CommandCatalog): void {
  installedCatalog = catalog;
}

/** Returns all feature groups with at least one command visible in `/help`. */
export function getCommandFeatures(): readonly FeatureCommandGroup[] {
  return installedCatalog.features;
}

/** Returns a formatted footer hint string, e.g. "💡 /inventory • /process • /craft". */
export function getHints(commandName: string): string {
  const meta = installedCatalog.commandsByName.get(commandName);
  if (!meta || meta.hints.length === 0) return "";
  return "💡 " + meta.hints.join(" • ");
}

/** Returns the full metadata for a command, or null if not registered. */
export function getCommandMeta(commandName: string): CommandMeta | null {
  return installedCatalog.commandsByName.get(commandName) ?? null;
}

/** Returns all visible command metadata owned by a feature. */
export function getCommandsForFeature(
  featureId: string,
): Array<{ name: string; meta: CommandMeta }> {
  const group = installedCatalog.features.find((entry) => entry.feature.id === featureId);
  return group?.commands.map((meta) => ({ name: meta.name, meta })) ?? [];
}

function isCommandHelpObject(help: CommandHelp | undefined): help is Exclude<CommandHelp, false> {
  return typeof help === "object" && help !== null;
}

function validateHints(
  commandName: string,
  hints: readonly string[],
  allCommandNames: ReadonlySet<string>,
): void {
  for (const hint of hints) {
    const hintedCommand = slashCommandName(hint);
    if (hintedCommand && !allCommandNames.has(hintedCommand)) {
      throw new Error(`Command "${commandName}" has unknown command hint "${hint}".`);
    }
  }
}

function slashCommandName(hint: string): string | null {
  const match = /^\/([a-z0-9_-]+)/i.exec(hint.trim());
  return match?.[1] ?? null;
}

function collectArgs(options: readonly SlashCommandOptionJson[]): CommandArgMeta[] {
  const args: CommandArgMeta[] = [];
  for (const option of options) {
    const name = stringValue(option.name);
    const description = stringValue(option.description);
    if (!name || !description) continue;

    if (option.type === ApplicationCommandOptionType.Subcommand) {
      args.push({ name, description });
      args.push(...collectNestedArgs(name, option.options ?? []));
      continue;
    }

    if (option.type === ApplicationCommandOptionType.SubcommandGroup) {
      args.push({ name, description });
      for (const subcommand of option.options ?? []) {
        const subName = stringValue(subcommand.name);
        if (!subName) continue;
        const prefix = `${name} ${subName}`;
        const subDescription = stringValue(subcommand.description);
        if (subDescription) args.push({ name: prefix, description: subDescription });
        args.push(...collectNestedArgs(prefix, subcommand.options ?? []));
      }
      continue;
    }

    args.push({
      name,
      description,
      required: option.required === true,
    });
  }
  return args;
}

function collectNestedArgs(
  prefix: string,
  options: readonly SlashCommandOptionJson[],
): CommandArgMeta[] {
  return options.flatMap((option) => {
    const name = stringValue(option.name);
    const description = stringValue(option.description);
    if (!name || !description) return [];
    return [
      {
        name: `${prefix} ${name}`,
        description,
        required: option.required === true,
      },
    ];
  });
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
