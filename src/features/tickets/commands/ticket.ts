/**
 * /ticket open [type] — Opens a ticket channel in the configured category.
 * /ticket close      — Closes the current ticket channel.
 */

import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  PermissionFlagsBits,
  ChannelType,
  type ChatInputCommandInteraction,
} from "discord.js";
import {
  TICKET_CATEGORIES,
  openTicket,
  closeTicket,
  makeTicketChannelName,
  TicketError,
} from "@/features/tickets/service";
import { getGuild } from "@/db/repositories/guilds";

export const TICKET_CLOSE_BUTTON_PREFIX = "tickets:close:";

export const data = new SlashCommandBuilder()
  .setName("ticket")
  .setDescription("Ticket system")
  .addSubcommand((sub) =>
    sub
      .setName("open")
      .setDescription("Open a support ticket")
      .addStringOption((opt) =>
        opt
          .setName("type")
          .setDescription("Ticket category")
          .setRequired(true)
          .addChoices(
            ...TICKET_CATEGORIES.map((c) => ({ name: `${c.emoji} ${c.label}`, value: c.id })),
          ),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("close")
      .setDescription("Close the current ticket channel"),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();

  if (sub === "open") {
    await handleOpen(interaction);
  } else if (sub === "close") {
    await handleClose(interaction);
  }
}

async function handleOpen(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild;
  if (!guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const typeId = interaction.options.getString("type", true);
  const category = TICKET_CATEGORIES.find((c) => c.id === typeId);
  if (!category) {
    await interaction.editReply({ content: "Invalid ticket type." });
    return;
  }

  const guildResult = await getGuild(guild.id);
  if (guildResult.isErr()) {
    await interaction.editReply({ content: "Failed to load guild configuration." });
    return;
  }

  const guildDoc = guildResult.unwrap();
  const categoryId = guildDoc?.channels?.ticketCategoryId ?? null;
  if (!categoryId) {
    await interaction.editReply({
      content: "No ticket category is configured. Please ask an administrator to set it up.",
    });
    return;
  }

  const channelName = makeTicketChannelName(interaction.user.username);

  const result = await openTicket(guild, interaction.user.id, {
    categoryId,
    channelName,
  });

  if (result.isErr()) {
    const err = result.error as TicketError;
    const msg =
      err.code === "LIMIT_REACHED"
        ? "You already have an open ticket. Please close it before opening a new one."
        : "Failed to open ticket. Please try again later.";
    await interaction.editReply({ content: msg });
    return;
  }

  const { channelId } = result.unwrap();

  // Post welcome + close button in the new ticket channel
  const welcomeEmbed = new EmbedBuilder()
    .setColor(Colors.Blue)
    .setTitle(`Ticket — ${category.emoji} ${category.label}`)
    .setDescription(
      `Welcome <@${interaction.user.id}>!\n\nPlease describe your request and wait for a staff member.`,
    )
    .setFooter({ text: `Opened by ${interaction.user.username}` })
    .setTimestamp();

  const closeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${TICKET_CLOSE_BUTTON_PREFIX}${channelId}`)
      .setLabel("Close Ticket")
      .setStyle(ButtonStyle.Danger),
  );

  try {
    const ticketChannel = guild.channels.cache.get(channelId)
      ?? await guild.channels.fetch(channelId);

    if (ticketChannel?.isTextBased() && ticketChannel.type === ChannelType.GuildText) {
      await ticketChannel.send({ embeds: [welcomeEmbed], components: [closeRow] });
    }
  } catch {
    // Non-fatal — channel created but couldn't send welcome message
  }

  await interaction.editReply({ content: `✅ Ticket opened! <#${channelId}>` });
}

async function handleClose(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild;
  const channel = interaction.channel;
  if (!guild || !channel) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  // Only allow closing from the ticket channel itself, or by staff with ManageChannels
  const member = interaction.member;
  const isStaff =
    member &&
    typeof member.permissions !== "string" &&
    member.permissions.has(PermissionFlagsBits.ManageChannels);

  const channelName = ("name" in channel ? channel.name : null) ?? "";
  const isTicketChannel = channelName.startsWith("ticket-");

  if (!isTicketChannel) {
    await interaction.editReply({ content: "This command must be used inside a ticket channel." });
    return;
  }

  if (!isStaff) {
    // Allow if user is the ticket opener — session lookup
    // Best-effort: if we can't confirm ownership, block non-staff
    await interaction.editReply({ content: "Only staff can close tickets from this command. Use the Close Ticket button instead." });
    return;
  }

  await interaction.editReply({ content: "Closing ticket..." });

  await closeTicket(guild, channel.id);
}
