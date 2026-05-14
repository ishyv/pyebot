/**
 * ItemGathered — emitted when a user successfully completes a gathering
 * action (mine, cut down, etc.) and items land in their inventory.
 *
 * Used by quests ("gather 10 iron ore") and achievements.
 */
export class ItemGathered {
  constructor(
    public readonly userId: string,
    public readonly itemId: string,
    public readonly quantity: number,
    public readonly source: string, // e.g. "gather:mine:tier-1"
  ) {}
}
