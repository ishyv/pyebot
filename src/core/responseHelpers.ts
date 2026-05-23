import type { InteractionReplyOptions } from "discord.js";
import type { Logger } from "@/core/logger";
import type { Result } from "@/core/result";
import { failureMessage } from "@/ui/v2";

/** Minimal command context needed to report a database Result failure to Discord. */
export interface DbErrorResponseContext {
  readonly respond: {
    fail(payload: InteractionReplyOptions): Promise<unknown>;
  };
  readonly logger?: Pick<Logger, "error">;
}

/**
 * Logs and replies to failed DB-style Result values at command boundaries.
 * Returns true when it handled an error so callers can keep early-return flow.
 */
export async function handleDbError(
  result: Result<unknown, unknown>,
  ctx: DbErrorResponseContext,
  userMessage: string,
  logMessage = userMessage,
): Promise<boolean> {
  if (result.isOk()) return false;

  ctx.logger?.error(logMessage, result.error);
  await ctx.respond.fail(failureMessage(userMessage));
  return true;
}
