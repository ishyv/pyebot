/**
 * SanctionIssued — emitted whenever a moderator-driven sanction is
 * applied (ban, kick, timeout, warn, restrict).
 *
 * Used by audit/logging features to send messages to log channels and
 * by analytics to count per-moderator activity.
 */
import type { SanctionType } from "@/features/moderation/sanctions";

export class SanctionIssued {
  constructor(
    public readonly type: SanctionType,
    public readonly targetUserId: string,
    public readonly moderatorId: string,
    public readonly guildId: string,
    public readonly reason: string,
  ) {}
}
