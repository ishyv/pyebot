/**
 * Runtime item validation for `/api/rpg/**`.
 *
 * The dashboard edits the bot-owned Mongo snapshot through the live bridge.
 * Source-pack parsing/writing is deliberately not part of the webapp runtime.
 */
import { type ItemDef, ItemDefSchema } from "../../../../src/content/schemas";

export type { ItemDef } from "../../../../src/content/schemas";

/**
 * Parses an item payload received over the dashboard HTTP boundary before it is
 * merged into the active RPG snapshot.
 */
export function parseItemDef(input: unknown): ItemDef {
  return ItemDefSchema.parse(input);
}
