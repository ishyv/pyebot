/**
 * SanctionIssued — emitted whenever a moderator-driven sanction is
 * applied (ban, kick, timeout, warn, restrict).
 *
 * Used by audit/logging features to send messages to log channels and
 * by analytics to count per-moderator activity.
 */
import type { SanctionTypeValue } from "@/components/user-sanctions";

export class SanctionIssued {
  constructor(
    public readonly type: SanctionTypeValue,
    public readonly targetUserId: string,
    public readonly moderatorId: string,
    public readonly guildId: string,
    public readonly reason: string,
  ) {}
}
