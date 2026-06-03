/**
 * The `command()` DSL in one file. Options refine the handler's `options`
 * type; each subcommand is dispatched by name with `.handle()`, which gives
 * `c.options` typed to *that* subcommand only.
 *
 * Note there is no `if (c.subcommand === "greet")` branching — that pattern is
 * banned (see AGENTS.md "Subcommand dispatch"). `.handle("name", ...)` is the
 * one supported way to route, and it keeps the option types honest.
 *
 * Handlers RETURN their reply payload. The framework owns the reply/defer/edit
 * lifecycle and validates the payload — you never call `interaction.reply`
 * here. Prefer `v2Message(...)` (Components V2); a plain `{ content }` object
 * also works for quick text.
 */

import { ButtonBuilder, ButtonStyle } from "discord.js";
import { command } from "@/framework";
import { container, section, v2Message } from "@/ui/v2";

export default command("example")
  .description("Reference command — demonstrates options, subcommands, and Components V2")
  .guildOnly() // narrows ctx.guild / c.guildId to non-null inside handlers
  .defer("ephemeral") // ack early and reply privately; use "public" for visible replies
  .help({ hints: ["/features enable example", "/balance"] })
  .subcommand("greet", "Greet a user with a button", (s) =>
    s
      // `{ required: true }` makes the value non-optional in `c.options`.
      .string("message", "What the greeting should say", { required: true })
      // Optional option — typed as `User | undefined` in `c.options`.
      .user("user", "Who to greet (defaults to you)"),
  )
  .subcommand("echo", "Echo text back", (s) => s.string("text", "Text to echo", { required: true }))
  .handle("greet", async (c) => {
    const target = c.options.user ?? c.user;

    // customId convention is `feature:action:arg…` (see src/ui/customId.ts).
    // The "example:" prefix is what handlers.ts routes on. Encoding is a plain
    // template string at the call site that owns it.
    const button = new ButtonBuilder()
      .setCustomId(`example:greet:${target.id}`)
      .setLabel("Wave back")
      .setStyle(ButtonStyle.Primary);

    return v2Message(
      container("ok", section(`## Hello, ${target.username}!\n${c.options.message}`, button)),
    );
  })
  .handle("echo", async (c) => {
    // Quick text reply — no Components V2 needed for a one-liner.
    return { content: c.options.text };
  });
