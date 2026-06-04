/**
 * Component routes for scripts — replaces the single @Handle("scr:") handler
 * whose body was a 12-branch `startsWith` chain over the editor modal, the input
 * collector (entity selects + text modal + Run), and the confirm/cancel/delete
 * buttons.
 *
 * Script names match /^[a-z0-9][a-z0-9_-]{0,63}$/ and input field names are
 * identifier-like — neither contains a colon — so `str` is exact for both. The
 * shared `scr:sel:` entity-select id is split per entity kind (role / member /
 * channel) so each route narrows to the correct select interaction with no cast;
 * `entitySelectRow` already branches on the field type to pick the menu builder.
 *
 * The editor confirm panel persists nowhere durable and the collector is an
 * in-memory session, so these ids need not stay byte-compatible across a deploy.
 */

import { defineRoutes, route, str } from "@/framework";

export const scriptRoutes = defineRoutes("scr", {
  // Editor modal (source / description / capabilities) and the input text modal.
  modal: route({ name: str }, "modal"),
  inp: route({ name: str }, "modal"),
  // Entity-input selects — one route per entity kind so `i` narrows correctly.
  "sel-role": route({ name: str, input: str }, "role-select"),
  "sel-member": route({ name: str, input: str }, "user-select"),
  "sel-channel": route({ name: str, input: str }, "channel-select"),
  // Collector + confirm buttons.
  cancel: {},
  txt: { name: str },
  go: { name: str },
  back: { name: str },
  apply: { name: str },
  run: { name: str },
  delete: { name: str },
});
