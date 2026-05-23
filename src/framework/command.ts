import type { AutocompleteInteraction, ChatInputCommandInteraction } from "discord.js";
import type { CommandHelp, CommandModule, Ctx } from "./types";

type CommandDefinition = {
  readonly data: CommandModule["data"];
  readonly help: CommandHelp;
  readonly requiresAdmin?: boolean;
  // biome-ignore lint/suspicious/noExplicitAny: some migrated commands still use the responder-based context.
  execute(interaction: ChatInputCommandInteraction, ctx: any): Promise<void>;
  autocomplete?(interaction: AutocompleteInteraction, ctx: Ctx): Promise<void>;
};

/**
 * Defines a slash command module with colocated help metadata.
 *
 * The helper intentionally returns the input unchanged; its job is to make the
 * command file's default export type-checked without adding runtime ceremony.
 */
export function defineCommand<T extends CommandDefinition>(command: T): T {
  return command;
}
