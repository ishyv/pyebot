/**
 * Sync `assets/glyphs/` to Discord application-owned emojis and rewrite the
 * runtime values in `src/ui/glyphs.ts`.
 *
 * Workflow:
 *   1. List the bot application's existing emojis via the Discord REST API.
 *   2. For each entry in `GLYPHS`, derive the expected emoji name
 *      (`<category>_<key>`, lowercased).
 *   3. If no application emoji with that name exists and a matching file is in
 *      `assets/glyphs/`, upload it. Files ending in `.gif` upload as animated.
 *   4. Rewrite `src/ui/glyphs.ts` in place so each value becomes its
 *      `<:name:id>` / `<a:name:id>` string. Glyphs without an emoji yet keep
 *      their unicode fallback.
 *
 * Required env (read from `.env` or process env):
 *   TOKEN     — bot token
 *   CLIENT_ID — application id (falls back to a stored client id if absent)
 *
 * This script is idempotent: re-running with no asset changes is a no-op.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnvFile } from "@/framework/doctor";
import { GLYPHS } from "@/ui/glyphs";

const cwd = process.cwd();
const env = { ...process.env, ...loadEnvFile(cwd) };
const TOKEN = env.TOKEN;
const CLIENT_ID = env.CLIENT_ID;

if (!TOKEN) {
  console.error("[glyphs-sync] TOKEN is required.");
  process.exit(1);
}
if (!CLIENT_ID) {
  console.error("[glyphs-sync] CLIENT_ID is required.");
  process.exit(1);
}

const API = "https://discord.com/api/v10";
const AUTH = { Authorization: `Bot ${TOKEN}` };

interface AppEmoji {
  id: string;
  name: string;
  animated: boolean;
}

const listResp = await fetch(`${API}/applications/${CLIENT_ID}/emojis`, { headers: AUTH });
if (!listResp.ok) {
  console.error("[glyphs-sync] Failed to list emojis:", listResp.status, await listResp.text());
  process.exit(1);
}
const existing = (await listResp.json()) as { items: AppEmoji[] };
const byName = new Map(existing.items.map((e) => [e.name, e]));

const assetsDir = join(cwd, "assets", "glyphs");
const assetByName = new Map<string, string>();
if (existsSync(assetsDir)) {
  for (const file of readdirSync(assetsDir)) {
    const dot = file.lastIndexOf(".");
    if (dot < 0) continue;
    const base = file.slice(0, dot).toLowerCase();
    assetByName.set(base, join(assetsDir, file));
  }
}

const resolved = new Map<string, string>();

for (const category of Object.keys(GLYPHS) as Array<keyof typeof GLYPHS>) {
  const entries = GLYPHS[category] as Record<string, string>;
  for (const key of Object.keys(entries)) {
    const name = `${category}_${key}`.toLowerCase();
    const fallback = entries[key] ?? "";

    let emoji = byName.get(name);
    if (!emoji) {
      const file = assetByName.get(name);
      if (!file) {
        console.log(`[glyphs-sync] skip ${name}: no asset and no existing emoji.`);
        resolved.set(`${category}.${key}`, fallback);
        continue;
      }
      const ext = file.slice(file.lastIndexOf(".") + 1).toLowerCase();
      const mime =
        ext === "gif" ? "image/gif" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
      const bytes = readFileSync(file);
      const b64 = bytes.toString("base64");
      const dataUrl = `data:${mime};base64,${b64}`;
      const uploadResp = await fetch(`${API}/applications/${CLIENT_ID}/emojis`, {
        method: "POST",
        headers: { ...AUTH, "Content-Type": "application/json" },
        body: JSON.stringify({ name, image: dataUrl }),
      });
      if (!uploadResp.ok) {
        console.error(
          `[glyphs-sync] upload ${name} failed:`,
          uploadResp.status,
          await uploadResp.text(),
        );
        resolved.set(`${category}.${key}`, fallback);
        continue;
      }
      emoji = (await uploadResp.json()) as AppEmoji;
      console.log(`[glyphs-sync] uploaded ${name} (${emoji.id}, animated=${emoji.animated}).`);
    }
    resolved.set(`${category}.${key}`, formatEmoji(emoji));
  }
}

const glyphsFilePath = join(cwd, "src", "ui", "glyphs.ts");
const original = readFileSync(glyphsFilePath, "utf8");
const rewritten = rewriteGlyphsLiteral(original, resolved);
if (rewritten !== original) {
  writeFileSync(glyphsFilePath, rewritten, "utf8");
  console.log("[glyphs-sync] wrote updated src/ui/glyphs.ts.");
} else {
  console.log("[glyphs-sync] no changes to src/ui/glyphs.ts.");
}

function formatEmoji(e: AppEmoji): string {
  return e.animated ? `<a:${e.name}:${e.id}>` : `<:${e.name}:${e.id}>`;
}

/**
 * Rewrites the GLYPHS object body in `source` so each `<category>.<key>` value
 * is replaced by `resolved.get("category.key")`. Preserves everything outside
 * the `export const GLYPHS = { ... } as const satisfies …` body.
 *
 * Approach: find the matching brace range, emit a fresh object literal with the
 * same key order as the imported `GLYPHS` (which is the source-of-truth order
 * because the import returns the literal at module load time).
 */
function rewriteGlyphsLiteral(source: string, resolved: Map<string, string>): string {
  const start = source.indexOf("export const GLYPHS =");
  if (start < 0) throw new Error("[glyphs-sync] could not find GLYPHS export.");
  const openBrace = source.indexOf("{", start);
  if (openBrace < 0) throw new Error("[glyphs-sync] could not find GLYPHS opening brace.");

  let depth = 0;
  let closeBrace = -1;
  for (let i = openBrace; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        closeBrace = i;
        break;
      }
    }
  }
  if (closeBrace < 0) throw new Error("[glyphs-sync] unbalanced GLYPHS braces.");

  const before = source.slice(0, openBrace);
  const after = source.slice(closeBrace + 1);

  const lines: string[] = ["{"];
  for (const category of Object.keys(GLYPHS) as Array<keyof typeof GLYPHS>) {
    lines.push(`  ${category}: {`);
    const entries = GLYPHS[category] as Record<string, string>;
    for (const key of Object.keys(entries)) {
      const value = resolved.get(`${category}.${key}`) ?? entries[key] ?? "";
      lines.push(`    ${key}: ${JSON.stringify(value)},`);
    }
    lines.push("  },");
  }
  lines.push("}");

  return `${before}${lines.join("\n")}${after}`;
}
