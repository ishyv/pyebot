/**
 * Entity-kind registry for the entity-component model.
 *
 * An entity kind is the single place a collection name is named: one kind = one
 * MongoDB collection holding one document per entity, with each attached
 * component stored as a namespaced field on that document. Feature code never
 * spells a collection again — it references the kind.
 *
 * Entity ids are Discord snowflakes, so a `User`/`Guild`/`Channel` document is
 * keyed directly by the snowflake. Declare a new kind here when a distinct
 * class of entity needs its own document (e.g. a synthetic market-listing id);
 * declare a new *component* (see `defineComponent`) when you just want another
 * field on an existing kind.
 *
 * See `docs/entity-components.md` for the full model and worked examples.
 */

import { entity } from "@/framework";

/** A Discord user, keyed by user-id snowflake. */
export const User = entity("users");

/**
 * A Discord guild, keyed by guild-id snowflake.
 *
 * The `guilds` collection is co-owned by the config system (`guildStore` /
 * `GuildSchema`), which stores admin-tunable settings as fields on this same
 * document. That coexistence is safe — `GuildSchema` is `.passthrough()` and all
 * config writes are path-based `$set` (no whole-document replace) — so entity
 * *state* fields can live here alongside config fields. Guild **config** never
 * moves to entity components; see `docs/entity-vs-config-storage.md`.
 */
export const Guild = entity("guilds");

/**
 * An open support ticket, keyed by its Discord channel-id snowflake.
 *
 * A ticket is 1:1 with the text channel created for it, so the channel id is
 * its natural entity id. Closing a ticket removes the entity; long-lived audit
 * history, if ever needed, belongs in a separate log rather than this kind.
 */
export const Ticket = entity("tickets");
