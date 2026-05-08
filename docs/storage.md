# Storage

tx-v2 uses a framework storage adapter contract for new starter bots and framework-owned state.

```ts
import { FileStorageAdapter, MemoryStorageAdapter } from "@/framework";

const dev = new MemoryStorageAdapter();
const localFile = new FileStorageAdapter(".tx-data");
```

## Contract

Adapters expose collections with a small document API:

- `get(id)` returns a document or `null`.
- `set(id, document)` replaces a document.
- `patch(id, partial)` shallow-merges fields.
- `delete(id)` removes a document.
- `all()` lists documents in insertion order.

This contract is intentionally smaller than MongoDB. Framework code should not depend on Mongo query operators unless it is explicitly in the Mongo adapter layer.

## Built-In Adapters

- `MemoryStorageAdapter` is for tests and throwaway local bots. It does not persist after process exit.
- `FileStorageAdapter` writes one JSON file per collection and is useful for starter bots that need persistence without MongoDB.
- Existing bundled tx-v2 features still use Mongo repositories during migration.

## Mongo Boundary

The full bundled bot still requires MongoDB because moderation, economy, RPG, tickets, offers, AI memory, autoroles, and admin panels have repository code built around Mongo collections.

Migration rule: new repository work should depend on adapter interfaces first. Reach for raw Mongo only when the feature needs a Mongo-specific capability and document that decision at the module boundary.
