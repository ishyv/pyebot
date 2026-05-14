/**
 * CurrencyAwarded — emitted when a user gains currency for any reason
 * (daily, work, fight reward, quest completion, etc.).
 *
 * Listeners are typically achievement progression, audit logging, and
 * leaderboard cache invalidation.
 */
export class CurrencyAwarded {
  constructor(
    public readonly userId: string,
    public readonly currencyId: string,
    public readonly amount: number,
    public readonly reason: string,
  ) {}
}
