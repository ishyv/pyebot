/**
 * Counting game state machine.
 *
 * One configured channel per guild accepts the next expected integer value.
 * The same user cannot count twice in a row, wrong answers reset the sequence,
 * and reactions are only user feedback. State writes are serialized per
 * guild/channel because Discord can deliver message events close enough
 * together to race the expected value.
 */

import { createLogger, type Logger } from "@/core/logger";
import {
  type CountingStateRecord,
  type CountingStateRepository,
  createDefaultCountingState,
} from "@/db/repositories/counting";
import { evaluateIntegerExpression } from "./expression";

const log = createLogger("counting");
const CHECK_REACTION = "✅";
const FAIL_REACTION = "❌";

export interface CountingMessageInput {
  readonly guildId: string | null;
  readonly channelId: string;
  readonly authorId: string;
  readonly authorIsBot: boolean;
  readonly content: string;
  react(emoji: string): Promise<unknown>;
}

export interface CountingGameDependencies {
  readonly configuredChannelId: string | null;
  readonly stateRepository: CountingStateRepository;
  readonly logger?: Logger;
}

export type CountingMessageOutcome = "ignored" | "accepted" | "reset";

class KeyedAsyncQueue {
  private readonly tails = new Map<string, Promise<void>>();

  async run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    let releaseCurrent!: () => void;
    const current = new Promise<void>((resolve) => {
      releaseCurrent = resolve;
    });
    const next = previous.catch(() => undefined).then(() => current);
    this.tails.set(key, next);

    try {
      await previous.catch(() => undefined);
      return await task();
    } finally {
      releaseCurrent();
      if (this.tails.get(key) === next) this.tails.delete(key);
    }
  }
}

// Shared process-local queue for counting channels. This protects the read,
// validate, write sequence; it is not durable cross-process locking.
const countingLocks = new KeyedAsyncQueue();

export async function processCountingMessage(
  message: CountingMessageInput,
  deps: CountingGameDependencies,
): Promise<CountingMessageOutcome> {
  if (message.authorIsBot || message.guildId === null) return "ignored";
  if (deps.configuredChannelId === null || message.channelId !== deps.configuredChannelId)
    return "ignored";

  return countingLocks.run(`${message.guildId}:${message.channelId}`, async () => {
    const stateResult = await deps.stateRepository.getState(message.guildId!, message.channelId);
    const state =
      stateResult.isOk() && stateResult.unwrap()
        ? stateResult.unwrap()!
        : createDefaultCountingState(message.guildId!, message.channelId);

    if (state.lastUserId === message.authorId) {
      await resetCount(message, deps, state, "same-user-repeat");
      return "reset";
    }

    const expression = evaluateIntegerExpression(message.content);
    if (expression.isErr() || expression.unwrap() !== state.expectedValue) {
      await resetCount(message, deps, state, "wrong-count");
      return "reset";
    }

    await persistState(deps, {
      ...state,
      expectedValue: state.expectedValue + 1,
      lastUserId: message.authorId,
      updatedAt: new Date(),
    });
    await safeReact(message, CHECK_REACTION, deps.logger ?? log);
    return "accepted";
  });
}

async function resetCount(
  message: CountingMessageInput,
  deps: CountingGameDependencies,
  state: CountingStateRecord,
  reason: string,
): Promise<void> {
  await persistState(deps, {
    ...state,
    expectedValue: 0,
    lastUserId: null,
    updatedAt: new Date(),
  });
  (deps.logger ?? log).info("Counting game reset.", {
    guildId: message.guildId,
    channelId: message.channelId,
    reason,
  });
  await safeReact(message, FAIL_REACTION, deps.logger ?? log);
}

async function persistState(
  deps: CountingGameDependencies,
  state: CountingStateRecord,
): Promise<void> {
  const result = await deps.stateRepository.setState(state);
  if (result.isErr()) {
    throw result.error;
  }
}

async function safeReact(
  message: CountingMessageInput,
  emoji: string,
  logger: Logger,
): Promise<void> {
  try {
    await message.react(emoji);
  } catch (error) {
    // Reactions are feedback only. Missing permissions should not corrupt counting state or kill the gateway handler.
    logger.warn("Unable to react to counting message.", { emoji, error });
  }
}
