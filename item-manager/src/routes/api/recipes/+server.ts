import { json } from '@sveltejs/kit';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACK_PATH = path.resolve(MODULE_DIR, '../../../../../src/content/packs/default.ts');

function extractRecipes(source: string): unknown {
	const startToken = '  recipes: ';
	const start = source.indexOf(startToken);
	if (start === -1) throw new Error('Could not find recipes section');

	const valueStart = start + startToken.length;
	const end = source.indexOf('\n});', valueStart);
	if (end === -1) throw new Error('Could not find end of recipes section');

	const raw = source.slice(valueStart, end).trim();
	const jsonText = raw.endsWith(',') ? raw.slice(0, -1) : raw;
	const recipes = JSON.parse(jsonText) as Record<
		string,
		{
			id: string;
			type?: string;
			craftingMethod?: string;
			itemInputs: Array<{ itemId: string; quantity: number }>;
			itemOutputs: Array<{ itemId: string; quantity: number }>;
		}
	>;

	return Object.values(recipes).map((recipe) => ({
		id: recipe.id,
		method: recipe.craftingMethod ?? recipe.type ?? 'crafting',
		ingredients: recipe.itemInputs.map((input) => input.itemId),
		output: {
			id: recipe.itemOutputs[0]?.itemId ?? '',
			qty: recipe.itemOutputs[0]?.quantity ?? 1
		}
	}));
}

export async function GET() {
	try {
		const content = fs.readFileSync(PACK_PATH, 'utf-8');
		return json(extractRecipes(content));
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return json({ error: message }, { status: 500 });
	}
}
