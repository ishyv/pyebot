import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readItems, writeItems } from '$lib/server/registry-io';

/** DELETE /api/items/[id] — remove an item by ID. */
export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const items = readItems();
		const index = items.findIndex((i) => i.id === params.id);

		if (index === -1) {
			return json({ error: `Item "${params.id}" not found` }, { status: 404 });
		}

		items.splice(index, 1);
		writeItems(items);

		return json({ success: true, count: items.length });
	} catch (err) {
		return json({ error: String(err) }, { status: 500 });
	}
};

/** PUT /api/items/[id] — update a single item by ID. */
export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		const updatedItem = await request.json();
		const items = readItems();
		const index = items.findIndex((i) => i.id === params.id);

		if (index === -1) {
			return json({ error: `Item "${params.id}" not found` }, { status: 404 });
		}

		items[index] = { ...items[index], ...updatedItem, id: params.id };
		writeItems(items);

		return json({ success: true, item: items[index] });
	} catch (err) {
		return json({ error: String(err) }, { status: 500 });
	}
};
