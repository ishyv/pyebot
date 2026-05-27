import { command } from "@/framework";
import type { Ctx } from "@/framework/types";
/**
 * /offer create <title> <description> [requirements] [salary] [contact]
 * /offer withdraw
 * /offer edit <field> <value>
 */

import type { ChatInputCommandInteraction } from "discord.js";
import { assertPanelPermission, openAdminPanel } from "@/features/adminPanels/panels";
import { createOffer, type OfferError, withdrawOffer } from "@/features/offers/service";
import { container, text, v2Message } from "@/ui/v2";

const data = command("offer")
  .setDescription("Manage job/service offers")
  .addSubcommand((sub) =>
    sub
      .setName("create")
      .setDescription("Submit a new offer for review")
      .addStringOption((o) =>
        o.setName("title").setDescription("Offer title").setRequired(true).setMaxLength(100),
      )
      .addStringOption((o) =>
        o
          .setName("description")
          .setDescription("Full description")
          .setRequired(true)
          .setMaxLength(1000),
      )
      .addStringOption((o) =>
        o.setName("requirements").setDescription("Requirements (optional)").setMaxLength(500),
      )
      .addStringOption((o) =>
        o.setName("salary").setDescription("Salary or compensation (optional)").setMaxLength(200),
      )
      .addStringOption((o) =>
        o.setName("contact").setDescription("How to contact you (optional)").setMaxLength(200),
      ),
  )
  .addSubcommand((sub) => sub.setName("withdraw").setDescription("Withdraw your active offer"))
  .addSubcommand((sub) =>
    sub.setName("panel").setDescription("Open the offers configuration panel"),
  );

async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  const sub = interaction.options.getSubcommand();

  if (sub === "create") await handleCreate(interaction, ctx);
  else if (sub === "withdraw") await handleWithdraw(interaction, ctx);
  else if (sub === "panel") {
    if (!(await assertPanelPermission(interaction))) return;
    await openAdminPanel(interaction, "offers");
  }
}

async function handleCreate(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  await ctx.respond.defer({ visibility: "ephemeral" });

  const guild = interaction.guild;
  if (!guild) {
    await ctx.respond.send({ content: "This command can only be used in a server." });
    return;
  }

  const details = {
    title: interaction.options.getString("title", true),
    description: interaction.options.getString("description", true),
    requirements: interaction.options.getString("requirements") ?? null,
    salary: interaction.options.getString("salary") ?? null,
    contact: interaction.options.getString("contact") ?? null,
  };

  const result = await createOffer(guild, interaction.user.id, interaction.user.username, details);

  if (result.isErr()) {
    const err = result.error as OfferError;
    const msg =
      err.code === "ACTIVE_OFFER_EXISTS"
        ? "You already have an active offer. Withdraw it first before submitting a new one."
        : err.code === "NO_REVIEW_CHANNEL"
          ? "The offers review channel is not configured. Contact an administrator."
          : `Failed to submit offer: ${err.message}`;
    await ctx.respond.send({ content: msg });
    return;
  }

  const offer = result.unwrap();
  await ctx.respond.send(
    v2Message(
      container(
        "warn",
        text(
          `## Offer Submitted\nYour offer **${offer.details.title}** has been submitted for review.\nOffer ID: \`${offer._id}\``,
        ),
      ),
    ),
  );
}

async function handleWithdraw(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  await ctx.respond.defer({ visibility: "ephemeral" });

  const guildId = interaction.guildId;
  if (!guildId) {
    await ctx.respond.send({ content: "This command can only be used in a server." });
    return;
  }

  const result = await withdrawOffer(guildId, interaction.user.id);

  if (result.isErr()) {
    await ctx.respond.send(
      v2Message(
        container("danger", text(`## Failed\nCould not withdraw offer: ${result.error.message}`)),
      ),
    );
    return;
  }

  if (!result.unwrap()) {
    await ctx.respond.send(
      v2Message(
        container(
          "warn",
          text("## Nothing to Withdraw\nYou don't have an active offer to withdraw."),
        ),
      ),
    );
    return;
  }

  await ctx.respond.send(
    v2Message(
      container("ok", text("## Offer Withdrawn\nYour offer has been removed from review.")),
    ),
  );
}

export default data
  .help({ hints: [] })
  .run(({ interaction, ctx }) =>
    (execute as (...args: never[]) => Promise<void>)(interaction as never, ctx as never),
  );
