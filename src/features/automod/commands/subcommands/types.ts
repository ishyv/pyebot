import type { InteractionResponder } from "@/core/interactionResponder";

/** Minimal context automod subcommands need from the framework command runtime. */
export interface AutomodSubcommandContext {
  readonly guildId: string;
  readonly respond: InteractionResponder;
}
