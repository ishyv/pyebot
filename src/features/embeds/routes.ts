/**
 * Component routes for the `/embed` wizard.
 *
 * The old scheme put the wizard session id in the *route* position
 * (`emb:{sessionId}:{action}`) and hand-parsed it with parseEmbedCustomId. Routes
 * resolve on a static `ns:route`, so the id moves to an argument and the action
 * becomes the route name: `emb:{action}:{sessionId}`. Route names match the
 * EmbedWizardAction `kind` values so the handler can pass `{ kind }` straight
 * through to the existing session dispatcher.
 *
 * The wizard is an in-memory, TTL'd, ephemeral panel, so these ids never need to
 * stay byte-compatible across a deploy. Embed names (delete/edit) use `rest`
 * because a user-chosen name may contain colons.
 */

import { defineRoutes, rest, route, str } from "@/framework";

const session = { session: str } as const;

export const embedRoutes = defineRoutes("emb", {
  // Session buttons that open a modal.
  "open-basic": session,
  "open-media": session,
  "open-author": session,
  "open-footer": session,
  "open-field-add": session,
  "open-script": session,
  // Session toggle / edit buttons.
  "toggle-sticky": session,
  "toggle-script": session,
  "remove-last-field": session,
  preview: session,
  save: session,
  cancel: session,
  // Session modal submits.
  "submit-basic": route(session, "modal"),
  "submit-media": route(session, "modal"),
  "submit-author": route(session, "modal"),
  "submit-footer": route(session, "modal"),
  "submit-field-add": route(session, "modal"),
  "submit-script": route(session, "modal"),
  // Session selects (the chosen value is in interaction.values).
  "select-channel": route(session, "channel-select"),
  "select-schedule": route(session, "select"),
  // Scopeless actions from the /embed list + delete-confirm panels.
  delete: { name: rest },
  close: {},
  edit: { name: rest },
});
