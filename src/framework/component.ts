/**
 * `component()` — declares a Component, the typed descriptor pairing a
 * MongoDB collection with a Zod schema.
 *
 * A Component is NOT a class, NOT a runtime object holding state. It is a
 * static descriptor that the World uses at runtime to translate
 * `ctx.get(id, EconomyAccount)` into the correct MongoDB read.
 *
 * Why a descriptor instead of per-collection repository classes?
 *
 *   1. Adding a new data type is a 5-line declaration, not a class with
 *      boilerplate methods around findOne/updateOne.
 *   2. All caching, transactions, and document-validation logic live in the
 *      World — one place, not duplicated per repository.
 *   3. TypeScript infers `T` directly from the Zod schema via `z.infer`, so
 *      consumers get full type safety without writing generics manually:
 *        `await ctx.get(userId, EconomyAccount)` is `Promise<{...} | null>`.
 *
 * Behind the scenes: `component()` is an identity function. It returns the
 * input object literally unchanged. The only reason it exists is so we have
 * a single, named entry point for component definitions — every component
 * file looks the same, and the function's signature is what fixes the
 * `Component<T>` brand for type inference.
 *
 * Convention: one component per file, exported via the file's name in
 * PascalCase. Example:
 *
 *   // src/components/economy-account.ts
 *   export const EconomyAccount = component({
 *     collection: "economy_accounts",
 *     schema: z.object({
 *       balance: z.number().default(0),
 *       status: z.enum(["ok", "suspended"]).default("ok"),
 *     }),
 *   });
 */

import type { ZodType } from "zod";
import type { Component } from "./types";

/**
 * Declare a Component. See file header for the why.
 *
 * Type parameter `T` is inferred from the Zod schema you pass in — you do
 * not write it manually.
 */
export function component<T>(def: { collection: string; schema: ZodType<T> }): Component<T> {
  return def;
}
