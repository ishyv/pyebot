/**
 * ItemCrafted — emitted when a crafting recipe produces an item.
 * Used by quests and achievements.
 */
export class ItemCrafted {
  constructor(
    public readonly userId: string,
    public readonly itemId: string,
    public readonly quantity: number,
    public readonly recipeId: string,
  ) {}
}
