/** Formats a number with locale-aware thousands separators, with optional prefix symbol. */
export function formatAmount(amount: number, symbol?: string): string {
  const formatted = amount.toLocaleString("en-US");
  return symbol ? `${symbol} ${formatted}` : formatted;
}

/** Formats a currency amount using a symbol lookup map. Falls back to currencyId as label. */
export function formatCurrencyAmount(
  amount: number,
  currencyId: string,
  symbols: Record<string, string> = {},
): string {
  const symbol = symbols[currencyId] ?? currencyId;
  return `${formatAmount(amount)} ${symbol}`;
}

/** Clamps a number between min and max (inclusive). */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Applies a tax rate to an amount, returning both the net and the floored fee. */
export function applyTaxRate(amount: number, taxRate: number): { net: number; fee: number } {
  const fee = Math.floor(amount * taxRate);
  return { net: amount - fee, fee };
}

/** Returns true if the amount is a valid positive integer. */
export function isValidAmount(amount: number): boolean {
  return Number.isInteger(amount) && amount > 0;
}
