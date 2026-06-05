import type { InteractionResponder } from "@/core/interactionResponder";
import type { EntityContext } from "@/framework/entity-context";

/** Minimal context automod subcommands need from the framework command runtime. */
export interface AutomodSubcommandContext {
  readonly guildId: string;
  readonly respond: InteractionResponder;
  /** Entity access for subcommands that read/write stored state (banned images). */
  readonly entities: EntityContext;
}
