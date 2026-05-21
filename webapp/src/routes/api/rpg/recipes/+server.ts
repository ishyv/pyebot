import { json } from "@sveltejs/kit";
import { getBridge } from "$lib/server/bridge";
import { requireRpgEditor } from "$lib/server/rpg-access";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals }) => {
  requireRpgEditor(locals.session);
  try {
    const result = await getBridge().getRpgContent();
    if (result.isErr()) throw result.error;
    const snapshot = result.unwrap() as {
      craftingRecipes?: Record<string, { requires: Record<string, number> }>;
      processingRecipes?: Record<
        string,
        { output: string; materialsPerBatch: number; outputPerBatch: number }
      >;
    };
    const crafting = Object.entries(snapshot.craftingRecipes ?? {}).map(([id, recipe]) => ({
      id,
      method: "crafting",
      ingredients: Object.keys(recipe.requires),
      output: { id, qty: 1 },
    }));
    const processing = Object.entries(snapshot.processingRecipes ?? {}).map(([id, recipe]) => ({
      id,
      method: "processing",
      ingredients: [id],
      output: { id: recipe.output, qty: recipe.outputPerBatch },
    }));
    return json([...crafting, ...processing]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: message }, { status: 500 });
  }
};
