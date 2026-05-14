/**
 * CurrencySpent — counterpart to CurrencyAwarded. Emitted when a user
 * loses currency (transfer, market purchase, fee). Negative amounts in
 * adjustment APIs always fire this event; positive ones fire
 * CurrencyAwarded.
 */
export class CurrencySpent {
  constructor(
    public readonly userId: string,
    public readonly currencyId: string,
    public readonly amount: number,
    public readonly reason: string,
  ) {}
}
