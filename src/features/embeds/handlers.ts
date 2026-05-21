import { type Client, Events, type Message } from "discord.js";
import { createLogger } from "@/core/logger";
import { Handle, Listen } from "@/framework";
import type { BoundComponentHandler, Ctx } from "@/framework/types";
import { SCHEDULE_SWEEP_INTERVAL_MS } from "./config";
import { handleEmbedInteraction } from "./interactions";
import { createScheduledEmbedRuntime, createStickyEmbedRuntime } from "./runtime";

const log = createLogger("embeds:handler");

/**
 * Thin Discord event adapter for the embed feature.
 *
 * Runtime behavior lives in `runtime.ts`; component/modal behavior lives in
 * `interactions.ts`. This class only wires framework decorators to those units.
 */
export default class EmbedHandlers {
  private readonly stickyRuntime = createStickyEmbedRuntime();
  private readonly scheduledRuntime = createScheduledEmbedRuntime();
  private sweepTimer: ReturnType<typeof setInterval> | null = null;

  @Listen(Events.ClientReady)
  onReady(client: Client, _ctx: Ctx): void {
    if (this.sweepTimer) return;
    this.sweepTimer = setInterval(
      () =>
        void this.scheduledRuntime
          .runSweep(client)
          .catch((error) => log.error("Scheduled embed sweep failed", error)),
      SCHEDULE_SWEEP_INTERVAL_MS,
    );
  }

  @Listen("messageCreate")
  async onMessage(message: Message, _ctx: Ctx): Promise<void> {
    await this.stickyRuntime.handleMessage(message);
  }

  @Handle("emb:")
  async onEmbedInteraction(
    interaction: Parameters<BoundComponentHandler>[0],
    _ctx: Ctx,
  ): Promise<void> {
    await handleEmbedInteraction(interaction, {
      invalidateSticky: (guildId, channelId) => this.stickyRuntime.invalidate(guildId, channelId),
    });
  }
}
