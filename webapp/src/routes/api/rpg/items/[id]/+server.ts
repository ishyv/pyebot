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

/** DELETE /api/rpg/items/[id] — remove an item from the active RPG snapshot. */
export const DELETE: RequestHandler = async ({ params, locals }) => {
  requireRpgEditor(locals.session);
  try {
    const snapshot = await loadSnapshot();
    if (!snapshot.items[params.id]) {
      return json({ error: `Item "${params.id}" not found` }, { status: 404 });
    }

    const items = { ...snapshot.items };
    delete items[params.id];
    const next = await saveSnapshot({ ...snapshot, items });

    return json({ success: true, count: Object.keys(next.items).length });
  } catch (err) {
    return json({ error: String(err) }, { status: 500 });
  }
};

/** PUT /api/rpg/items/[id] — update one item in the active RPG snapshot. */
export const PUT: RequestHandler = async ({ params, request, locals }) => {
  requireRpgEditor(locals.session);
  try {
    const updatedItem = await request.json();
    const snapshot = await loadSnapshot();
    const current = snapshot.items[params.id];
    if (!current) {
      return json({ error: `Item "${params.id}" not found` }, { status: 404 });
    }

    let item: ItemDef;
    try {
      item = parseItemDef({ ...current, ...updatedItem, id: params.id });
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
    }
    await saveSnapshot({ ...snapshot, items: { ...snapshot.items, [params.id]: item } });

    return json({ success: true, item });
  } catch (err) {
    return json({ error: String(err) }, { status: 500 });
  }
};
