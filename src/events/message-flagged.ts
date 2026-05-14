/**
 * MessageFlagged — emitted by automod when a message hits any rule
 * (link spam, disallowed domain, etc.). The originating feature has
 * already applied the action (timeout/delete/etc.); listeners typically
 * log to a moderator channel.
 */
export class MessageFlagged {
  constructor(
    public readonly userId: string,
    public readonly guildId: string,
    public readonly channelId: string,
    public readonly rule: string, // e.g. "linkSpam", "domainWhitelist"
    public readonly action: string, // e.g. "timeout", "deleted"
  ) {}
}
