import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readItems, writeItems, type ItemDef } from '$lib/server/registry-io';

/** GET /api/items — returns all items from the registry file. */
export const GET: RequestHandler = async () => {
	try {
		const items = readItems();
		return json({ items, count: items.length });
	} catch (err) {
		return json({ error: String(err) }, { status: 500 });
	}
};

/** PUT /api/items — replaces the entire registry with the provided items array. */
export const PUT: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const items: ItemDef[] = body.items;

		if (!Array.isArray(items)) {
			return json({ error: 'items must be an array' }, { status: 400 });
		}

		writeItems(items);
		return json({ success: true, count: items.length });
	} catch (err) {
		return json({ error: String(err) }, { status: 500 });
	}
};

/** POST /api/items — add a single new item. */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const newItem: ItemDef = await request.json();

		if (!newItem.id || !newItem.name) {
			return json({ error: 'id and name are required' }, { status: 400 });
		}

		const items = readItems();

		// Check for duplicate ID
		if (items.some((i) => i.id === newItem.id)) {
			return json({ error: `Item with id "${newItem.id}" already exists` }, { status: 409 });
		}

		items.push(newItem);
		writeItems(items);

		return json({ success: true, item: newItem, count: items.length }, { status: 201 });
	} catch (err) {
		return json({ error: String(err) }, { status: 500 });
	}
};
