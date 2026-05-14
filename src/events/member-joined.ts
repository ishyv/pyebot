/**
 * MemberJoined — emitted when a member joins a guild. Mirrors Discord's
 * `guildMemberAdd` but delivered through the framework's event bus so
 * features can react without each one registering its own Discord
 * listener.
 *
 * The autoroles feature is the canonical consumer (apply onJoin rules).
 * Onboarding flows for RPG/economy may also listen here.
 */
export class MemberJoined {
  constructor(
    public readonly userId: string,
    public readonly guildId: string,
  ) {}
}
