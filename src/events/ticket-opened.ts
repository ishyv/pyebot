/**
 * TicketOpened — emitted right after a ticket channel is created and
 * persisted. Used by audit logging and category-specific welcome
 * messages.
 */
export class TicketOpened {
  constructor(
    public readonly channelId: string,
    public readonly ownerId: string,
    public readonly guildId: string,
    public readonly category: string,
  ) {}
}

export class TicketClosed {
  constructor(
    public readonly channelId: string,
    public readonly ownerId: string,
    public readonly guildId: string,
  ) {}
}
