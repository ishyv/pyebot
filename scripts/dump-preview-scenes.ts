/**
 * Regenerates webapp/src/lib/discord-preview/scenes.generated.json from the
 * preview-scene registry. Run after changing a UI that has a registered scene:
 *
 *   bun run scenes:dump
 *
 * The webapp reads the generated file statically, so there is no runtime
 * coupling between the webapp build and bot feature code.
 */

import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { serializeAllScenes } from "@/dev/preview-scenes";

const scenes = await serializeAllScenes();
const out = resolve(import.meta.dir, "../webapp/src/lib/discord-preview/scenes.generated.json");
await writeFile(out, `${JSON.stringify(scenes, null, 2)}\n`);
console.log(`wrote ${scenes.length} preview scene(s) → ${out}`);
