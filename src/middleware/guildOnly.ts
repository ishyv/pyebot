/**
 * guildOnly middleware factory.
 *
 * Short-circuits any command used outside a guild (DMs, group DMs).
 * Replaces the `if (!interaction.guild)` guard repeated in every command.
 */

import type { MiddlewareFn } from "@/core/feature";
import { ErrResult, OkResult } from "@/core/result";

export function guildOnly(): MiddlewareFn {
  return async (interaction) => {
    if (!interaction.guild) {
      return ErrResult({ content: "This command can only be used in a server." });
    }
    return OkResult(undefined);
  };
}
