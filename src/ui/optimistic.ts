/**
 * Optimistic UI helper for component interactions.
 *
 * Why this exists:
 * - Long-running interaction work (DB writes, Discord REST calls) leaves the
 *   user staring at unchanged components, wondering whether their click did
 *   anything. The convention this file encodes is: edit the message with a
 *   "pending" view first, run the work, then edit again with the result.
 * - The single helper hides the two-edit dance plus the failure path (where
 *   the work threw and we need to restore a visible error state).
 *
 * Boundary:
 * - This helper assumes the interaction has not yet been replied to (it calls
 *   `interaction.update`). For interactions already deferred or replied,
 *   callers should hand-roll `editReply` calls in the same shape.
 */

import type { MessageComponentInteraction } from "discord.js";
import type { V2Payload } from "./views";

/**
 * Edits the interaction's message to `pending`, runs `work`, then edits again
 * to the resolved payload (`work`'s return value). If `work` throws, the
 * message is edited to `onFail` and the error re-thrown so the caller's
 * upstream error handling still runs.
 *
 * Invariants:
 * - Exactly one `interaction.update` call is made before `work` runs; one
 *   `interaction.message.edit` call afterwards. We use `message.edit` for the
 *   second edit so the helper works even if `work` took longer than the
 *   3-second interaction acknowledgement window.
 * - `work` must not call `interaction.reply/update/editReply` itself, or the
 *   second edit will conflict. Pure domain work only.
 */
export async function optimisticUpdate(
  interaction: MessageComponentInteraction,
  pending: V2Payload,
  work: () => Promise<V2Payload>,
  onFail?: V2Payload,
): Promise<void> {
  await interaction.update(pending);
  try {
    const resolved = await work();
    await interaction.message.edit(resolved);
  } catch (err) {
    if (onFail) await interaction.message.edit(onFail).catch(() => undefined);
    throw err;
  }
}
