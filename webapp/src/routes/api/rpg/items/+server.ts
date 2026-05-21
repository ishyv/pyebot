import { json } from "@sveltejs/kit";
import { getBridge, type RpgContentSnapshot } from "$lib/server/bridge";
import { requireRpgEditor } from "$lib/server/rpg-access";
import { type ItemDef, parseItemDef } from "$lib/server/rpg-registry";
import type { RequestHandler } from "./$types";

type RpgSnapshot = RpgContentSnapshot & { items: Record<string, ItemDef> };

async function loadSnapshot(): Promise<RpgSnapshot> {
  const result = await getBridge().getRpgContent();
  if (result.isErr()) throw result.error;
  return result.unwrap() as RpgSnapshot;
}

async function saveSnapshot(snapshot: RpgSnapshot): Promise<RpgSnapshot> {
  const result = await getBridge().saveRpgContent(snapshot);
  if (result.isErr()) throw result.error;
  return result.unwrap() as RpgSnapshot;
}

/** GET /api/rpg/items — returns items from the active Mongo-backed RPG snapshot. */
export const GET: RequestHandler = async ({ locals }) => {
  requireRpgEditor(locals.session);
  try {
    const snapshot = await loadSnapshot();
    const items = Object.values(snapshot.items);
    return json({ items, count: items.length });
  } catch (err) {
    return json({ error: String(err) }, { status: 500 });
  }
};

/** PUT /api/rpg/items — replaces all items in the active RPG snapshot. */
export const PUT: RequestHandler = async ({ request, locals }) => {
  requireRpgEditor(locals.session);
  try {
    const body = await request.json();
    if (!Array.isArray(body.items)) {
      return json({ error: "items must be an array" }, { status: 400 });
    }
    let items: ItemDef[];
    try {
      items = body.items.map((item: unknown) => parseItemDef(item));
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
    }

    const snapshot = await loadSnapshot();
    const next = await saveSnapshot({
      ...snapshot,
      items: Object.fromEntries(items.map((item) => [item.id, item])),
    });
    return json({ success: true, count: Object.keys(next.items).length });
  } catch (err) {
    return json({ error: String(err) }, { status: 500 });
  }
};

/** POST /api/rpg/items — add one item to the active RPG snapshot. */
export const POST: RequestHandler = async ({ request, locals }) => {
  requireRpgEditor(locals.session);
  try {
    let newItem: ItemDef;
    try {
      newItem = parseItemDef(await request.json());
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
    }

    const snapshot = await loadSnapshot();
    const items = Object.values(snapshot.items);

    // Check for duplicate ID
    if (items.some((i) => i.id === newItem.id)) {
      return json({ error: `Item with id "${newItem.id}" already exists` }, { status: 409 });
    }

    const next = await saveSnapshot({
      ...snapshot,
      items: { ...snapshot.items, [newItem.id]: newItem },
    });

    return json(
      { success: true, item: newItem, count: Object.keys(next.items).length },
      { status: 201 },
    );
  } catch (err) {
    return json({ error: String(err) }, { status: 500 });
  }
};
