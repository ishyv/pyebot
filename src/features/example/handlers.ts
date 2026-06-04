/**
 * Handlers are a flat list of registrations — no class, no decorators. The
 * framework discovers this default-exported list at boot and wires each entry.
 *
 *   routeHandlers(routes, { name: (i, args, ctx) => ... })  — component routes
 *   on(EventClass, (event, ctx) => ...)                     — framework bus events
 *   listen("messageCreate", (message, ctx) => ...)          — raw discord.js events
 *
 * For component routes, `args` is decoded and typed from the route's schema (see
 * ./routes.ts) — a garbled or stale customId is skipped before the handler runs,
 * so there is no parsing or guarding to write here.
 */

import { MessageFlags } from "discord.js";
import { defineHandlers, routeHandlers } from "@/framework";
import { routes } from "./routes";

export default defineHandlers([
  ...routeHandlers(routes, {
    // `interaction` is a ButtonInteraction (the route's default kind) and
    // `args.target` is the snowflake encoded by routes.greet.button(...).
    greet: async (interaction, args) => {
      const wavedBack = args.target === interaction.user.id;
      await interaction.reply({
        content: wavedBack ? "👋 You waved back at yourself!" : "👋 Wave received.",
        flags: MessageFlags.Ephemeral,
      });
    },
  }),

  // Events fold into the same list. Examples (left commented — the example
  // feature has no real event behavior to ship):
  //
  //   on(MemberJoined, async (event, ctx) => { /* framework bus */ }),
  //
  //   listen("messageCreate", async (message, ctx) => {
  //     // Raw discord.js events bypass the feature toggle — self-gate them.
  //     // See src/features/counting/handlers.ts for the real pattern.
  //   }),
]);
