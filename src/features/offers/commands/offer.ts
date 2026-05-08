/**
 * /offer create <title> <description> [requirements] [salary] [contact]
 * /offer withdraw
 * /offer edit <field> <value>
 */

import {
  MessageFlags,
  SlashCommandBuilder,
  EmbedBuilder,
  Colors,
  type ChatInputCommandInteraction,
} from "discord.js";
import { createOffer, withdrawOffer, OfferError } from "@/features/offers/service";
import { assertPanelPermission, openAdminPanel } from "@/features/adminPanels/panels";

export const data = new SlashCommandBuilder()
  .setName("offer")
  .setDescription("Manage job/service offers")
  .addSubcommand((sub) =>
    sub
      .setName("create")
      .setDescription("Submit a new offer for review")
      .addStringOption((o) =>
        o.setName("title").setDescription("Offer title").setRequired(true).setMaxLength(100),
      )
      .addStringOption((o) =>
        o.setName("description").setDescription("Full description").setRequired(true).setMaxLength(1000),
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
  .addSubcommand((sub) =>
    sub
      .setName("withdraw")
      .setDescription("Withdraw your active offer"),
  )
  .addSubcommand((sub) =>
    sub
      .setName("panel")
      .setDescription("Open the offers configuration panel"),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();

  if (sub === "create") await handleCreate(interaction);
  else if (sub === "withdraw") await handleWithdraw(interaction);
  else if (sub === "panel") {
    if (!(await assertPanelPermission(interaction))) return;
    await openAdminPanel(interaction, "offers");
  }
}

async function handleCreate(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guild = interaction.guild;
  if (!guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
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
    await interaction.editReply({ content: msg });
    return;
  }

  const offer = result.unwrap();
  const embed = new EmbedBuilder()
    .setColor(Colors.Yellow)
    .setTitle("Offer Submitted")
    .setDescription(
      `Your offer **${offer.details.title}** has been submitted for review.\nOffer ID: \`${offer._id}\``,
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleWithdraw(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const result = await withdrawOffer(guildId, interaction.user.id);

  if (result.isErr()) {
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(Colors.Red).setTitle("❌ Failed").setDescription(`Could not withdraw offer: ${result.error.message}`)],
    });
    return;
  }

  if (!result.unwrap()) {
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(Colors.Yellow).setTitle("Nothing to Withdraw").setDescription("You don't have an active offer to withdraw.")],
    });
    return;
  }

  await interaction.editReply({
    embeds: [new EmbedBuilder().setColor(Colors.Green).setTitle("✅ Offer Withdrawn").setDescription("Your offer has been removed from review.")],
  });
}
