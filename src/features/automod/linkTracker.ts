/**
 * Cross-message link spam counter backed by MongoDB update pipelines.
 *
 * AutoMod needs a rolling count per guild+user that survives process restarts
 * and multiple message events. The pipeline prunes old timestamps and appends
 * new ones atomically so concurrent messages do not lose increments.
 *
 * Boundary: this module stores primitive timestamps only. Policy decisions stay
 * in the signal detectors so the persistence shape does not know punishment
 * rules.
 */
import { getDb } from "@/core/db";
import { createLogger } from "@/core/logger";

const log = createLogger("automod:linkTracker");

interface LinkTrackDoc {
  _id: string; // `${guildId}:${userId}`
  timestamps: number[];
  updatedAt: Date;
}

/**
 * Records `count` new link events for the given guild+user key.
 *
 * Filters out timestamps older than `windowMs` and returns the total count in
 * the window, including the new events. Uses an atomic MongoDB update pipeline
 * (requires MongoDB 4.2+) and upserts when the key does not exist.
 */
export async function recordLinks(
  guildId: string,
  userId: string,
  count: number,
  windowMs: number,
): Promise<number> {
  const db = await getDb();
  const key = `${guildId}:${userId}`;
  const now = Date.now();
  const cutoff = now - windowMs;

  // WHY: duplicate timestamp values are intentional. We count links, not
  // messages, so one message with N links must append N entries.
  const newTimestamps = Array.from({ length: count }, () => now);

  const result = await db.collection<LinkTrackDoc>("automod_link_tracking").findOneAndUpdate(
    { _id: key } as never,
    [
      {
        $set: {
          timestamps: {
            $concatArrays: [
              {
                $filter: {
                  input: { $ifNull: ["$timestamps", []] },
                  cond: { $gte: ["$$this", cutoff] },
                },
              },
              newTimestamps,
            ],
          },
          updatedAt: new Date(),
        },
      },
    ],
    { upsert: true, returnDocument: "after" },
  );

  return (result as LinkTrackDoc | null)?.timestamps?.length ?? count;
}

/**
 * Deletes the link tracking document for the given guild+user,
 * equivalent to clearing their in-window link history.
 */
export async function clearLinkRecord(guildId: string, userId: string): Promise<void> {
  try {
    const db = await getDb();
    const key = `${guildId}:${userId}`;
    await db.collection("automod_link_tracking").deleteOne({ _id: key } as never);
  } catch (err) {
    log.error("Failed to clear link record", err);
  }
}
