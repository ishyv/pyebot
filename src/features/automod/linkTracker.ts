import { getDb } from "@/core/db";
import { createLogger } from "@/core/logger";

const log = createLogger("automod:linkTracker");

interface LinkTrackDoc {
  _id: string; // `${guildId}:${userId}`
  timestamps: number[];
  updatedAt: Date;
}

/**
 * Records `count` new link events for the given guild+user key,
 * filters out timestamps older than `windowMs`, and returns
 * the total count of timestamps in the window (including new ones).
 *
 * Uses an atomic MongoDB update pipeline (requires MongoDB 4.2+).
 * Upserts — creates the document if it doesn't exist.
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

  // Build an array of `count` new timestamp values
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
