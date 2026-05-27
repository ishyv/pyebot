import {
  type ChatInputCommandInteraction,
  type InteractionReplyOptions,
  MessageFlags,
} from "discord.js";
import type { CommandContext } from "@/core/feature";
import { command } from "@/framework";
import { container, separator, text, v2Message } from "@/ui/v2";

const data = command("mod")
  .setDescription("Moderation help and workflow guidance")
  .setDMPermission(false)
  .addSubcommand((sub) =>
    sub
      .setName("help")
      .setDescription("Show moderation setup, daily-use, automod, and safety guidance"),
  );

/**
 * Renders the moderation help card as a V2 message.
 *
 * Exported so test fixtures and admin panels can render it without executing
 * the command handler.
 */
export function renderModHelp() {
  return v2Message(
    container(
      "info",
      text("## Moderation Help"),
      separator("sm"),
      text(
        [
          "**First setup**",
          "`/modset panel` — configure logs, appeals, quarantine, verification, and escalation.",
          "`/automod panel` — configure spam, raid, slowmode, whitelist, and regex protections.",
          "`/roles dashboard` — review managed role policy and action limits.",
        ].join("\n"),
      ),
      separator("sm"),
      text(
        [
          "**Daily moderation**",
          "`/warn`, `/mute`, `/kick`, `/ban` — core sanctions.",
          "`/quarantine add` — restrict a user without removing them from the server.",
          "`/case view` and `/cases` — inspect moderation history.",
        ].join("\n"),
      ),
      separator("sm"),
      text(
        [
          "**Automod**",
          "`/automod status` — review enabled protections and report channels.",
          "Automod alerts should be treated as evidence review, not blind punishment.",
        ].join("\n"),
      ),
      separator("sm"),
      text(
        [
          "**Safety**",
          "Use reasons that another moderator can understand later.",
          "Prefer quarantine or timeout when evidence is incomplete.",
          "Destructive actions should have cases, evidence, and a review path.",
        ].join("\n"),
      ),
    ),
  );
}

async function execute(
  _interaction: ChatInputCommandInteraction,
  ctx?: CommandContext,
): Promise<void> {
  const { components } = renderModHelp();
  // Both IsComponentsV2 and Ephemeral are required: V2 flag to opt into the
  // component layout, Ephemeral so the help card is only visible to the requester.
  const payload: InteractionReplyOptions = {
    components,
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  };
  if (ctx) {
    await ctx.respond.send(payload);
    return;
  }
}

export default data
  .help({ hints: ["/modset status", "/modconfig modlog"] })
  .run(({ interaction, ctx }) =>
    (execute as (...args: never[]) => Promise<void>)(interaction as never, ctx as never),
  );
