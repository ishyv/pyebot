/**
 * Middleware pipeline runner.
 *
 * Executes an ordered array of MiddlewareFn against an interaction + context.
 * If any returns Err, the pipeline stops, sends the reply, and returns false.
 * If all pass, returns true and the caller proceeds to execute().
 *
 * Pipeline order (enforced by the dispatcher):
 *   [guildOnly] → [featureGate] → [...command.middleware] → execute()
 *
 * Returning a boolean lets the dispatcher decide whether to call execute()
 * without needing to inspect a Result — cleaner call site.
 */

import type { ChatInputCommandInteraction } from "discord.js";
import type { MiddlewareFn, CommandContext } from "@/core/feature";

export async function runMiddleware(
  fns: readonly MiddlewareFn[],
  interaction: ChatInputCommandInteraction,
  ctx: CommandContext,
): Promise<boolean> {
  for (const fn of fns) {
    const result = await fn(interaction, ctx);
    if (result.isErr()) {
      const { content, ephemeral = true } = result.error;
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content, ephemeral });
        } else {
          await interaction.reply({ content, ephemeral });
        }
      } catch {
        // best-effort — ignore if we can't reply
      }
      return false;
    }
  }
  return true;
}
