import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type StoragePatch<T extends object> = Partial<T>;

export interface StorageCollection<TDocument extends object> {
  get(id: string): Promise<TDocument | null>;
  set(id: string, document: TDocument): Promise<void>;
  patch(id: string, patch: StoragePatch<TDocument>): Promise<void>;
  delete(id: string): Promise<void>;
  all(): Promise<TDocument[]>;
}

export interface StorageAdapter {
  connect?(): Promise<void>;
  disconnect?(): Promise<void>;
  collection<TDocument extends object>(name: string): StorageCollection<TDocument>;
}

export class MemoryStorageAdapter implements StorageAdapter {
  private readonly collections = new Map<string, MemoryStorageCollection<object>>();

  collection<TDocument extends object>(name: string): StorageCollection<TDocument> {
    let collection = this.collections.get(name);
    if (!collection) {
      collection = new MemoryStorageCollection<object>();
      this.collections.set(name, collection);
    }
    return collection as MemoryStorageCollection<TDocument>;
  }

  snapshot(): Array<[string, Array<[string, object]>]> {
    return [...this.collections.entries()].map(([name, collection]) => [
      name,
      collection.entries(),
    ]);
  }
}

export class FileStorageAdapter implements StorageAdapter {
  private readonly memory = new MemoryStorageAdapter();

  constructor(private readonly directory: string) {}

  async connect(): Promise<void> {
    mkdirSync(this.directory, { recursive: true });
    for (const name of listJsonFiles(this.directory)) {
      const collection = this.memory.collection<Record<string, unknown>>(name);
      const path = this.pathFor(name);
      const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, Record<string, unknown>>;
      for (const [id, document] of Object.entries(raw)) {
        await collection.set(id, document);
      }
    }
  }

  async disconnect(): Promise<void> {
    mkdirSync(this.directory, { recursive: true });
    for (const [name, entries] of this.snapshot()) {
      writeFileSync(
        this.pathFor(name),
        `${JSON.stringify(Object.fromEntries(entries), null, 2)}\n`,
      );
    }
  }

  collection<TDocument extends object>(name: string): StorageCollection<TDocument> {
    const inner = this.memory.collection<TDocument>(name);
    return {
      get: (id) => inner.get(id),
      set: async (id, document) => {
        await inner.set(id, document);
        await this.flush();
      },
      patch: async (id, patch) => {
        await inner.patch(id, patch);
        await this.flush();
      },
      delete: async (id) => {
        await inner.delete(id);
        await this.flush();
      },
      all: () => inner.all(),
    };
  }

  private async flush(): Promise<void> {
    await this.disconnect();
  }

  private pathFor(name: string): string {
    return join(this.directory, `${safeCollectionName(name)}.json`);
  }

  private snapshot(): Array<[string, Array<[string, object]>]> {
    return this.memory.snapshot();
  }
}

class MemoryStorageCollection<TDocument extends object> implements StorageCollection<TDocument> {
  private readonly documents = new Map<string, TDocument>();

  async get(id: string): Promise<TDocument | null> {
    return clone(this.documents.get(id) ?? null);
  }

  async set(id: string, document: TDocument): Promise<void> {
    this.documents.set(id, clone(document));
  }

  async patch(id: string, patch: StoragePatch<TDocument>): Promise<void> {
    const current = this.documents.get(id);
    if (!current) {
      this.documents.set(id, clone(patch as TDocument));
      return;
    }
    this.documents.set(id, clone({ ...current, ...patch }));
  }

  async delete(id: string): Promise<void> {
    this.documents.delete(id);
  }

  async all(): Promise<TDocument[]> {
    return [...this.documents.values()].map((document) => clone(document));
  }

  entries(): Array<[string, TDocument]> {
    return [...this.documents.entries()].map(([id, document]) => [id, clone(document)]);
  }
}

function clone<T>(value: T): T {
  return value === null || value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

function listJsonFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) => entry.slice(0, -".json".length));
}

function safeCollectionName(name: string): string {
  if (!/^[a-zA-Z0-9_.-]+$/.test(name)) {
    throw new Error(`Invalid storage collection name "${name}".`);
  }
  return name;
}
