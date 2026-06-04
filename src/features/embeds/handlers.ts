/**
 * Embed feature runtime — a flat registration list.
 *
 * Component/modal behavior lives in `interactions.ts`; sticky + scheduled
 * delivery lives in `runtime.ts`. This module wires routes and raw events to
 * those units and owns the per-process runtime state (sticky cache, scheduled
 * sweep timer) that the handler class used to hold as instance fields.
 */
import { createLogger } from "@/core/logger";
import { defineHandlers, listen, routeHandlers } from "@/framework";
import { SCHEDULE_SWEEP_INTERVAL_MS } from "./config";
import {
  handleDirectAction,
  makeEmbedDeps,
  openEditWizard,
  runSessionAction,
} from "./interactions";
import { embedRoutes } from "./routes";
import { createScheduledEmbedRuntime, createStickyEmbedRuntime } from "./runtime";

const log = createLogger("embeds:handler");

const stickyRuntime = createStickyEmbedRuntime();
const scheduledRuntime = createScheduledEmbedRuntime();
const deps = makeEmbedDeps((guildId, channelId) => stickyRuntime.invalidate(guildId, channelId));
let sweepTimer: ReturnType<typeof setInterval> | null = null;

export default defineHandlers([
  ...routeHandlers(embedRoutes, {
    // Session buttons that open a modal.
    "open-basic": (i, { session }) => runSessionAction(i, session, { kind: "open-basic" }, deps),
    "open-media": (i, { session }) => runSessionAction(i, session, { kind: "open-media" }, deps),
    "open-author": (i, { session }) => runSessionAction(i, session, { kind: "open-author" }, deps),
    "open-footer": (i, { session }) => runSessionAction(i, session, { kind: "open-footer" }, deps),
    "open-field-add": (i, { session }) =>
      runSessionAction(i, session, { kind: "open-field-add" }, deps),
    "open-script": (i, { session }) => runSessionAction(i, session, { kind: "open-script" }, deps),
    // Session toggle / edit buttons.
    "toggle-sticky": (i, { session }) =>
      runSessionAction(i, session, { kind: "toggle-sticky" }, deps),
    "toggle-script": (i, { session }) =>
      runSessionAction(i, session, { kind: "toggle-script" }, deps),
    "remove-last-field": (i, { session }) =>
      runSessionAction(i, session, { kind: "remove-last-field" }, deps),
    preview: (i, { session }) => runSessionAction(i, session, { kind: "preview" }, deps),
    save: (i, { session }) => runSessionAction(i, session, { kind: "save" }, deps),
    cancel: (i, { session }) => runSessionAction(i, session, { kind: "cancel" }, deps),
    // Session modal submits.
    "submit-basic": (i, { session }) =>
      runSessionAction(i, session, { kind: "submit-basic" }, deps),
    "submit-media": (i, { session }) =>
      runSessionAction(i, session, { kind: "submit-media" }, deps),
    "submit-author": (i, { session }) =>
      runSessionAction(i, session, { kind: "submit-author" }, deps),
    "submit-footer": (i, { session }) =>
      runSessionAction(i, session, { kind: "submit-footer" }, deps),
    "submit-field-add": (i, { session }) =>
      runSessionAction(i, session, { kind: "submit-field-add" }, deps),
    "submit-script": (i, { session }) =>
      runSessionAction(i, session, { kind: "submit-script" }, deps),
    // Session selects (chosen value is in interaction.values).
    "select-channel": (i, { session }) =>
      runSessionAction(i, session, { kind: "select-channel" }, deps),
    "select-schedule": (i, { session }) =>
      runSessionAction(i, session, { kind: "select-schedule" }, deps),
    // Scopeless actions from the /embed list + delete-confirm panels.
    delete: (i, { name }) => handleDirectAction(i, { kind: "delete", name }, deps),
    close: (i) => handleDirectAction(i, { kind: "cancel" }, deps),
    edit: (i, { name }) => openEditWizard(i, name, deps),
  }),

  listen("messageCreate", async (message) => {
    await stickyRuntime.handleMessage(message);
  }),

  listen("clientReady", (client) => {
    if (sweepTimer) return;
    sweepTimer = setInterval(
      () =>
        void scheduledRuntime
          .runSweep(client)
          .catch((error) => log.error("Scheduled embed sweep failed", error)),
      SCHEDULE_SWEEP_INTERVAL_MS,
    );
  }),
]);
