# Storage

tx-v2 keeps a small storage adapter contract for starter bots and framework-owned utilities.
The bundled full bot runtime uses Mongo-backed `World` components and feature repositories.

These adapters are deliberately **not** part of the public `@/framework` barrel — exposing them
there would advertise a second persistence path alongside `World`. Import them directly from the
module instead:

```ts
import { FileStorageAdapter, MemoryStorageAdapter } from "@/framework/storage";

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
- The bundled tx-v2 feature set still uses Mongo repositories where those features need Mongo-specific behavior.

## Mongo Boundary

The full bundled bot still requires MongoDB because moderation, economy, RPG, tickets, offers, AI memory, autoroles, and admin panels have repository code built around Mongo collections.

Rule: do not assume these adapters back the bundled full bot. If starter-bot runtime storage becomes a real product surface, wire it deliberately through `World` instead of adding a second hidden persistence path.
