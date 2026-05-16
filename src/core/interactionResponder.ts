import { type BaseInteraction, type InteractionReplyOptions, MessageFlags } from "discord.js";
import { ErrResult, OkResult, type Result } from "@/core/result";

export type InteractionVisibility = "public" | "ephemeral";

export type InteractionResponseErrorKind =
  | "expired_interaction"
  | "already_acknowledged"
  | "missing_access"
  | "invalid_payload"
  | "discord_api_error"
  | "unsupported_interaction";

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

export function createInteractionResponder(interaction: BaseInteraction): InteractionResponder {
  const replyable = interaction as ReplyableInteraction & InteractionResponseMethods;
  return {
    async defer(options = {}) {
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
      return this.send({ flags: MessageFlags.Ephemeral, ...payload });
    },
  };
}

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

  if (Array.isArray(payload.components) && payload.components.length > 5) {
    return ErrResult(
      new InteractionResponseError(
        "invalid_payload",
        "Interaction response must contain 5 component rows or fewer.",
      ),
    );
  }

  return OkResult(undefined);
}

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
