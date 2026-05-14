/** Generates a unique correlation ID (timestamp + random suffix). */
export function buildCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Joins parts with `:` to form a composite document ID. */
export function buildCompositeId(...parts: string[]): string {
  return parts.join(":");
}

/** Quest progress document ID: `userId:questId` */
export function buildProgressId(userId: string, questId: string): string {
  return buildCompositeId(userId, questId);
}

/** Achievement document ID: `userId:achievementId` */
export function buildAchievementId(userId: string, achievementId: string): string {
  return buildCompositeId(userId, achievementId);
}

/** Market listing ID: `listing:<correlationId>` */
export function buildListingId(): string {
  return `listing:${buildCorrelationId()}`;
}

/** Generates a short 5-character uppercase alphanumeric case ID (e.g. "A3F9K"). */
export function generateCaseId(): string {
  return Math.random().toString(36).slice(2).padStart(5, "0").slice(0, 5).toUpperCase();
}
