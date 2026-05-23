/**
 * Generic MongoDB data layer with Zod schema validation.
 * Every document read is validated against the schema. Missing documents can be
 * created from defaults; malformed existing documents are returned as errors so
 * bad persisted state is not silently normalized.
 * All methods return Result<T> rather than throwing.
 *
 * Used by all feature repositories. Construct one instance per collection:
 *   `const users = new MongoStore("users", UserSchema);`
 */

import type { Collection, Document, Filter, FindOptions, UpdateFilter } from "mongodb";
import type { ZodSchema } from "zod";
import { getDb } from "@/core/db";
import { createLogger } from "@/core/logger";
import { ErrResult, OkResult, type Result } from "@/core/result";
import { buildSafeUpsertUpdate } from "./helpers";

const log = createLogger("db:store");

function documentId(doc: unknown): string {
  if (!doc || typeof doc !== "object" || !("_id" in doc)) return "unknown";
  const id = (doc as { _id?: unknown })._id;
  return typeof id === "string" ? id : "unknown";
}

/**
 * Parse a batch of raw documents, keeping the valid ones and skipping
 * (with a warning) any that fail schema validation.
 *
 * This is the batch-read counterpart to MongoStore's strict single-document
 * `parse()`. Single reads (get/ensure/patch) intentionally surface malformed
 * config as an error; batch list reads (leaderboards, market browse) must NOT
 * let one corrupt row drop every valid row, so they isolate failures here.
 */
export function parseDocuments<T extends { _id: string }>(
  schema: ZodSchema<T>,
  docs: unknown[],
  collectionName: string,
): T[] {
  const parsedDocs: T[] = [];
  for (const doc of docs) {
    const parsed = schema.safeParse(doc);
    if (parsed.success) {
      parsedDocs.push(parsed.data);
      continue;
    }

    log.warn(`Skipping invalid ${collectionName} document`, {
      id: documentId(doc),
      error: parsed.error,
    });
  }
  return parsedDocs;
}

export class MongoStore<T extends Document & { _id: string }> {
  constructor(
    private readonly collectionName: string,
    private readonly schema: ZodSchema<T>,
  ) {}

  public async collection(): Promise<Collection<T>> {
    return (await getDb()).collection<T>(this.collectionName);
  }

  private mapError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
  }

  private getDefault(id: string): T {
    const raw: Record<string, unknown> = { _id: id };
    // Detect guildId-keyed schemas (guild config) and pre-populate it so the parsed default
    // uses the correct key. Works for ZodObject; silently skips for wrapped schemas.
    try {
      const schemaAny = this.schema as any;
      const shape = schemaAny.shape ?? schemaAny._def?.shape;
      if (shape && typeof shape === "object" && "guildId" in shape) {
        raw.guildId = id;
      }
    } catch {
      /* continue */
    }
    const parsed = this.schema.safeParse(raw);
    if (parsed.success) return parsed.data;
    console.error(`[MongoStore:${this.collectionName}] failed to build default`, {
      id,
      error: parsed.error,
    });
    return raw as unknown as T;
  }

  private parse(doc: unknown): T {
    const parsed = this.schema.safeParse(doc);
    if (parsed.success) return parsed.data;
    const id = (doc as any)?._id ?? "unknown";
    console.error(`[MongoStore:${this.collectionName}] invalid document`, {
      id,
      error: parsed.error,
    });
    throw new Error(`Invalid ${this.collectionName} document ${id}`);
  }

  async get(id: string): Promise<Result<T | null>> {
    try {
      const col = await this.collection();
      const doc = await col.findOne({ _id: id } as Filter<T>);
      return OkResult(doc ? this.parse(doc) : null);
    } catch (error) {
      return ErrResult(this.mapError(error));
    }
  }

  async ensure(id: string, initial?: Partial<T>): Promise<Result<T>> {
    try {
      const col = await this.collection();
      const defaults = { ...this.getDefault(id), ...initial };
      const update = buildSafeUpsertUpdate<T>(
        { $setOnInsert: defaults as any },
        defaults as any,
        new Date(),
        { setUpdatedAt: false },
      );
      const res = await col.findOneAndUpdate({ _id: id } as Filter<T>, update as UpdateFilter<T>, {
        upsert: true,
        returnDocument: "after",
      });
      if (!res) return ErrResult(new Error(`Failed to ensure ${this.collectionName}:${id}`));
      return OkResult(this.parse(res));
    } catch (error) {
      return ErrResult(this.mapError(error));
    }
  }

  async patch(id: string, patch: Partial<T>): Promise<Result<T>> {
    try {
      const col = await this.collection();
      const defaults = this.getDefault(id);
      const update = buildSafeUpsertUpdate<T>({ $set: patch as any }, defaults, new Date());
      const res = await col.findOneAndUpdate({ _id: id } as Filter<T>, update as UpdateFilter<T>, {
        upsert: true,
        returnDocument: "after",
      });
      if (!res) return ErrResult(new Error(`Failed to patch ${this.collectionName}:${id}`));
      return OkResult(this.parse(res));
    } catch (error) {
      return ErrResult(this.mapError(error));
    }
  }

  async set(id: string, data: T): Promise<Result<T>> {
    try {
      const col = await this.collection();
      await col.replaceOne({ _id: id } as Filter<T>, data, { upsert: true });
      // Returns the parsed in-memory data rather than re-fetching from DB.
      // Unlike ensure/patch/replaceIfMatch, this does not provide a read-your-own-write guarantee.
      // Callers that need the committed state should call get() after set().
      return OkResult(this.parse(data));
    } catch (error) {
      return ErrResult(this.mapError(error));
    }
  }

  async replaceIfMatch(
    id: string,
    expected: Partial<T>,
    next: Partial<T>,
  ): Promise<Result<T | null>> {
    try {
      const col = await this.collection();
      const res = await col.findOneAndUpdate(
        { _id: id, ...expected } as Filter<T>,
        { $set: { ...next, updatedAt: new Date() } as any },
        { returnDocument: "after" },
      );
      return OkResult(res ? this.parse(res) : null);
    } catch (error) {
      return ErrResult(this.mapError(error));
    }
  }

  async delete(id: string): Promise<Result<boolean>> {
    try {
      const col = await this.collection();
      const res = await col.deleteOne({ _id: id } as Filter<T>);
      return OkResult((res.deletedCount ?? 0) > 0);
    } catch (error) {
      return ErrResult(this.mapError(error));
    }
  }

  async updatePaths(
    id: string,
    paths: Record<string, unknown>,
    options: { upsert?: boolean; pipeline?: Document[]; unset?: string[] } = {},
  ): Promise<Result<void>> {
    try {
      const col = await this.collection();
      if (options.pipeline) {
        await col.updateOne({ _id: id } as Filter<T>, options.pipeline as any, {
          upsert: options.upsert,
        });
      } else {
        const update: Document = {};
        if (Object.keys(paths).length > 0) {
          update.$set = { ...paths, updatedAt: new Date() };
        } else {
          update.$set = { updatedAt: new Date() };
        }
        if (options.unset?.length) {
          update.$unset = Object.fromEntries(options.unset.map((path) => [path, ""]));
        }
        await col.updateOne({ _id: id } as Filter<T>, update as UpdateFilter<T>, {
          upsert: options.upsert,
        });
      }
      return OkResult(undefined);
    } catch (error) {
      return ErrResult(this.mapError(error));
    }
  }

  async find(filter: Filter<T>, options?: FindOptions<T>): Promise<Result<T[]>> {
    try {
      const col = await this.collection();
      const docs = await col.find(filter, options).toArray();
      return OkResult(parseDocuments(this.schema, docs as unknown[], this.collectionName));
    } catch (error) {
      return ErrResult(this.mapError(error));
    }
  }
}
