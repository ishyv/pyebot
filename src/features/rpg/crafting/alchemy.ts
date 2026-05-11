/**
 * Active runtime for Crucible alchemy.
 *
 * Owns live Crucible behavior: ingredient checks, AI-backed discovery naming,
 * discovery persistence, and inventory mutation for 3-item alchemy crafts.
 */
import { OkResult, ErrResult, type Result } from "@/core/result";
import { getContentRegistry } from "@/content/registry";
import type { Trait } from "@/content/schemas";
import { getUser, updateUserPaths } from "@/db/repositories/users";
import { getDiscoveredRecipe, saveDiscoveredRecipe } from "@/db/repositories/rpg-discovery";
import { generateResilientText } from "@/features/ai/service";

export interface ItemData {
  id: string;
  name: string;
  trait1: Trait;
  trait2: Trait;
}

function getAlchemyItem(itemId: string): ItemData | null {
  const item = getContentRegistry()?.getItem(itemId);
  if (!item) return null;

  return {
    id: item.id,
    name: item.name,
    trait1: item.trait1,
    trait2: item.trait2,
  };
}

export interface CrucibleResult {
  outputId: string;
  outputName: string;
  isNewDiscovery: boolean;
}

export class AlchemyError extends Error {
  constructor(public readonly code: "MISSING_ITEMS" | "UNKNOWN_ITEM" | "AI_ERROR", message: string) {
    super(message);
    this.name = "AlchemyError";
  }
}

export async function generateAIName(ingredients: ItemData[]): Promise<string> {
    const systemPrompt = "You are a grim, arcane alchemist in a Dark Victorian / Lovecraftian universe (similar to Elden Ring or Bloodborne).";
    const userPrompt = `I am mixing these 3 ingredients in a crucible:
1. ${ingredients[0].name} (Traits: ${ingredients[0].trait1}, ${ingredients[0].trait2})
2. ${ingredients[1].name} (Traits: ${ingredients[1].trait1}, ${ingredients[1].trait2})
3. ${ingredients[2].name} (Traits: ${ingredients[2].trait1}, ${ingredients[2].trait2})

Synthesize a single resulting item based on these traits.
Provide ONLY the name of the new item. It MUST be a complete noun phrase consisting of 2 to 4 words. Do not provide a single adjective.
Examples: "Abyssal Ingot", "Eldritch Salve", "Serrated Biomass", "Vial of Mute Tears".`;

    try {
      const response = await generateResilientText(systemPrompt, userPrompt, "low");
      const text = response.text || "Cursed Sludge";
      return text.replace(/["*]/g, ''); // sanitize basic markdown just in case
    } catch (err) {
      console.error("Resilient AI Generation failed", err);
      return "Volatile Ash";
    }
}

export async function resolveCrucible(userId: string, item1: ItemData, item2: ItemData, item3: ItemData): Promise<CrucibleResult> {
  const sortedIds = [item1.id, item2.id, item3.id].sort();
  const hash = sortedIds.join("_");

  // Check cache
  const existingRes = await getDiscoveredRecipe(hash);
  if (existingRes.isOk() && existingRes.unwrap()) {
    return {
      outputId: hash,
      outputName: existingRes.unwrap()!.name,
      isNewDiscovery: false
    };
  }

  // Generate new
  let name = "Volatile Ash";
  try {
     name = await generateAIName([item1, item2, item3]);
  } catch(e) {
     console.error("AI Generation failed, falling back to Ash:", e);
  }

  await saveDiscoveredRecipe({
    _id: hash,
    name,
    ingredients: [item1.id, item2.id, item3.id],
    discoveredByUserId: userId,
    discoveredAt: new Date()
  });

  return {
    outputId: hash,
    outputName: name,
    isNewDiscovery: true
  };
}

export async function craftInCrucible(
  userId: string,
  itemId1: string,
  itemId2: string,
  itemId3: string
): Promise<Result<{ outputName: string, outputId: string, isNewDiscovery: boolean }, AlchemyError>> {
  const userRes = await getUser(userId);
  if (userRes.isErr() || !userRes.unwrap()) return ErrResult(new AlchemyError("MISSING_ITEMS", "User not found"));
  const user = userRes.unwrap()!;
  
  const inventory = user.inventory as Record<string, number> || {};
  
  const req: Record<string, number> = {};
  req[itemId1] = (req[itemId1] || 0) + 1;
  req[itemId2] = (req[itemId2] || 0) + 1;
  req[itemId3] = (req[itemId3] || 0) + 1;

  for (const [id, qty] of Object.entries(req)) {
    if ((inventory[id] || 0) < qty) {
      return ErrResult(new AlchemyError("MISSING_ITEMS", `You don't have enough ${id} to perform this synthesis.`));
    }
  }

  const i1 = getAlchemyItem(itemId1);
  const i2 = getAlchemyItem(itemId2);
  const i3 = getAlchemyItem(itemId3);

  if (!i1 || !i2 || !i3) {
    return ErrResult(new AlchemyError("UNKNOWN_ITEM", "One of these items cannot be placed in the crucible."));
  }

  const result = await resolveCrucible(userId, i1, i2, i3);

  const paths: Record<string, number> = {};
  for (const [id, qty] of Object.entries(req)) {
    paths[`inventory.${id}`] = inventory[id] - qty;
  }
  
  const outCurrent = inventory[result.outputId] || 0;
  paths[`inventory.${result.outputId}`] = outCurrent + 1;

  await updateUserPaths(userId, paths);

  return OkResult(result);
}
