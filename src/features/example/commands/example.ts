/**
 * The `command()` DSL in one file. Options refine the handler's `options`
 * type; object subcommands can keep their `run` callback beside the
 * subcommand declaration.
 *
 * Note there is no manual subcommand branch here. That pattern is banned
 * (see AGENTS.md "Subcommand dispatch"). Put inline behavior in the subcommand's
 * `run` callback; keep `.handle("name", fn)` for separated handler functions.
 *
 * Handlers RETURN their reply payload. The framework owns the reply/defer/edit
 * lifecycle and validates the payload — you never call `interaction.reply`
 * here. Prefer `v2Message(...)` (Components V2); a plain `{ content }` object
 * also works for quick text.
 */

import { command } from "@/framework";
import { container, section, v2Message } from "@/ui/v2";
import { routes } from "../routes";

export default command("example")
  .description("Reference command — demonstrates options, subcommands, and Components V2")
  .guildOnly() // narrows ctx.guild / c.guildId to non-null inside handlers
  .defer("ephemeral") // ack early and reply privately; use "public" for visible replies
  .help({ hints: ["/features enable example", "/balance"] })
  .subcommand({
    name: "greet",
    description: "Greet a user with a button",
    options: (s) =>
      s
        // `{ required: true }` makes the value non-optional in `c.options`.
        .string("message", "What the greeting should say", { required: true })
        // Optional option — typed as `User | undefined` in `c.options`.
        .user("user", "Who to greet (defaults to you)"),
    run: async (c) => {
      const target = c.options.user ?? c.user;

      // Typed encode: routes.greet.button(...) prefills the customId from the route
      // schema (see ../routes.ts). The arg is checked at compile time — there is no
      // hand-written `example:greet:${id}` string to drift from the handler.
      const button = routes.greet.button({ target: target.id }, { label: "Wave back" });

      return v2Message(
        container("ok", section(`## Hello, ${target.username}!\n${c.options.message}`, button)),
      );
    },
  })
  .subcommand({
    name: "echo",
    description: "Echo text back",
    options: (s) => s.string("text", "Text to echo", { required: true }),
    run: async (c) => {
      // Quick text reply — no Components V2 needed for a one-liner.
      return { content: c.options.text };
    },
  });
