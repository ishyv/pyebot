/**
 * Interaction response lifecycle adapter.
 *
 * Discord interactions can be acknowledged exactly once, then either edited or
 * followed up depending on whether the first response was a defer or a reply.
 * This module centralizes that state-machine so command handlers can return a
 * payload and receive `Result` errors instead of scattering `reply` /
 * `editReply` / `followUp` branching across feature code.
 *
 * Invariants:
 * - `send()` validates payload shape before crossing the Discord API boundary.
 * - `fail()` always forces an ephemeral response without dropping existing
 *   payload flags.
 * - Discord API failures are classified, not thrown, so command code can decide
 *   whether to surface or ignore them.
 *
 * Gotcha: this is intentionally a small runtime adapter over discord.js. It
 * does not hide all interaction methods, and it cannot rescue a handler that
 * manually acknowledges the same interaction through raw discord.js calls.
 */
import {
  type BaseInteraction,
  type InteractionReplyOptions,
  MessageFlags,
  MessageFlagsBitField,
} from "discord.js";
import { ErrResult, OkResult, type Result } from "@/core/result";

export type InteractionVisibility = "public" | "ephemeral";

export type InteractionResponseErrorKind =
  | "expired_interaction"
  | "already_acknowledged"
  | "missing_access"
  | "invalid_payload"
  | "discord_api_error"
  | "unsupported_interaction";

/** Classified failure returned by responder methods instead of thrown. */
export class InteractionResponseError extends Error {
  constructor(
    public readonly kind: InteractionResponseErrorKind,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "InteractionResponseError";
  }
}

/**
 * Minimal response surface used by `Ctx.respond`.
 *
 * Side effects: each method may call Discord's interaction API. All methods
 * return `Result` so feature code can short-circuit without relying on thrown
 * discord.js exceptions.
 */
export interface InteractionResponder {
  defer(options?: {
    visibility?: InteractionVisibility;
  }): Promise<Result<void, InteractionResponseError>>;
  send(payload: InteractionReplyOptions): Promise<Result<void, InteractionResponseError>>;
  fail(payload: InteractionReplyOptions): Promise<Result<void, InteractionResponseError>>;
}

type ReplyableInteraction = BaseInteraction & {
  replied?: boolean;
  deferred?: boolean;
};

type InteractionResponseMethods = {
  reply?: (payload: InteractionReplyOptions) => Promise<unknown>;
  deferReply?: (payload?: InteractionReplyOptions) => Promise<unknown>;
  editReply?: (payload: InteractionReplyOptions) => Promise<unknown>;
  followUp?: (payload: InteractionReplyOptions) => Promise<unknown>;
};

/**
 * Create a responder bound to one Discord interaction.
 *
 * The returned object reads `interaction.replied` / `interaction.deferred` at
 * call time. That matters because a handler may defer, then later send, and the
 * second call must edit the original response rather than attempting a second
 * first acknowledgement.
 */
export function createInteractionResponder(interaction: BaseInteraction): InteractionResponder {
  const replyable = interaction as ReplyableInteraction & InteractionResponseMethods;
  return {
    async defer(options = {}) {
      // WHY: Discord treats defer/reply as the one allowed initial ACK. A
      // repeated defer should be idempotent for framework callers, not a 40060.
      if (replyable.replied || replyable.deferred) return OkResult(undefined);
      if (!replyable.deferReply) {
        return ErrResult(
          new InteractionResponseError(
            "unsupported_interaction",
            "Interaction does not support deferred replies.",
          ),
        );
      }

      const payload = visibilityPayload(options.visibility ?? "public");
      return callDiscord(
        () => replyable.deferReply?.(payload),
        "Failed to defer interaction response.",
      );
    },

    async send(payload) {
      const validation = validateInteractionPayload(payload);
      if (validation.isErr()) return ErrResult(validation.error);

      if (replyable.deferred) {
        if (!replyable.editReply) {
          return ErrResult(
            new InteractionResponseError(
              "unsupported_interaction",
              "Deferred interaction does not support editReply.",
            ),
          );
        }
        return callDiscord(
          () => replyable.editReply?.(payload),
          "Failed to edit deferred interaction response.",
        );
      }

      // WHY: once a normal reply exists, additional user-visible messages must
      // be follow-ups. Reusing reply would fail as "already acknowledged".
      if (replyable.replied) {
        if (!replyable.followUp) {
          return ErrResult(
            new InteractionResponseError(
              "unsupported_interaction",
              "Replied interaction does not support followUp.",
            ),
          );
        }
        return callDiscord(
          () => replyable.followUp?.(payload),
          "Failed to send interaction follow-up.",
        );
      }

      if (!replyable.reply) {
        return ErrResult(
          new InteractionResponseError(
            "unsupported_interaction",
            "Interaction does not support replies.",
          ),
        );
      }
      return callDiscord(() => replyable.reply?.(payload), "Failed to reply to interaction.");
    },

    async fail(payload) {
      return this.send({ ...payload, flags: withEphemeralFlag(payload.flags) });
    },
  };
}

/**
 * Validate Discord response limits that this codebase can check locally.
 *
 * Returns `Err(invalid_payload)` before the network call when the payload would
 * violate known Discord limits. It deliberately does not validate every possible
 * Discord schema rule; discord.js and the API remain the final authority.
 */
export function validateInteractionPayload(
  payload: InteractionReplyOptions,
): Result<void, InteractionResponseError> {
  if (typeof payload.content === "string" && payload.content.length > 2_000) {
    return ErrResult(
      new InteractionResponseError(
        "invalid_payload",
        "Interaction response content must be 2000 characters or fewer.",
      ),
    );
  }

  if (Array.isArray(payload.embeds) && payload.embeds.length > 10) {
    return ErrResult(
      new InteractionResponseError(
        "invalid_payload",
        "Interaction response must contain 10 embeds or fewer.",
      ),
    );
  }

  // Components V2 messages allow up to 10 top-level components (containers,
  // sections, rows, …); legacy messages allow at most 5 action rows. Apply the
  // right ceiling so a valid V2 payload isn't rejected as if it were legacy.
  if (Array.isArray(payload.components)) {
    const v2 = hasComponentsV2(payload.flags);
    const max = v2 ? 10 : 5;
    if (payload.components.length > max) {
      return ErrResult(
        new InteractionResponseError(
          "invalid_payload",
          v2
            ? "Components V2 response must contain 10 top-level components or fewer."
            : "Interaction response must contain 5 component rows or fewer.",
        ),
      );
    }
  }

  return OkResult(undefined);
}

function hasComponentsV2(flags: InteractionReplyOptions["flags"]): boolean {
  if (flags === undefined) return false;
  return (MessageFlagsBitField.resolve(flags as never) & MessageFlags.IsComponentsV2) !== 0;
}

/**
 * Convert common Discord API error codes into stable application categories.
 *
 * Unknown codes are grouped as `discord_api_error` so callers are not coupled to
 * discord.js error object shapes.
 */
export function classifyDiscordInteractionError(error: unknown): InteractionResponseErrorKind {
  const code = errorCode(error);
  if (code === 10062) return "expired_interaction";
  if (code === 40060) return "already_acknowledged";
  if (code === 50001 || code === 50013) return "missing_access";
  if (code === 50035) return "invalid_payload";
  return "discord_api_error";
}

function visibilityPayload(visibility: InteractionVisibility): InteractionReplyOptions {
  return visibility === "ephemeral" ? { flags: MessageFlags.Ephemeral } : {};
}

function withEphemeralFlag(flags: InteractionReplyOptions["flags"]): number {
  if (flags === undefined) return MessageFlags.Ephemeral;
  return MessageFlagsBitField.resolve(flags as never) | MessageFlags.Ephemeral;
}

async function callDiscord(
  fn: () => Promise<unknown> | undefined,
  message: string,
): Promise<Result<void, InteractionResponseError>> {
  try {
    await fn();
    return OkResult(undefined);
  } catch (error) {
    return ErrResult(
      new InteractionResponseError(classifyDiscordInteractionError(error), message, error),
    );
  }
}

function errorCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const direct = (error as { code?: unknown }).code;
  if (typeof direct === "number") return direct;
  const raw = (error as { rawError?: { code?: unknown } }).rawError?.code;
  return typeof raw === "number" ? raw : undefined;
}
