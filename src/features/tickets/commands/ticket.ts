/**
 * /ticket open [type] — Opens a ticket channel in the configured category.
 * /ticket close      — Closes the current ticket channel.
 */

import { ChannelType, PermissionFlagsBits } from "discord.js";
import { getGuild, updateGuildPaths } from "@/db/repositories/guilds";
import { assertPanelPermission, openAdminPanel } from "@/features/adminPanels/panels";
import { routes } from "@/features/tickets/routes";
import {
  closeTicket,
  makeTicketChannelName,
  openTicket,
  TICKET_CATEGORIES,
  type TicketError,
} from "@/features/tickets/service";
import { renderTicketWelcome } from "@/features/tickets/views";
import { command, type RunContext } from "@/framework";
import { container, text, v2Message } from "@/ui/v2";

const data = command("ticket")
  .description("Ticket system")
  .subcommand({
    name: "open",
    description: "Open a support ticket",
    options: (s) =>
      s.string("type", "Ticket category", {
        required: true,
        choices: TICKET_CATEGORIES.map((c) => ({ name: `${c.emoji} ${c.label}`, value: c.id })),
      }),
  })
  .subcommand({ name: "close", description: "Close the current ticket channel" })
  .subcommand({
    name: "setup",
    description: "Setup the ticket system (Admin only)",
    options: (s) =>
      s.channel("category", "The category channel for tickets", {
        required: true,
        channelTypes: [ChannelType.GuildCategory],
      }),
  })
  .subcommand({
    name: "panel",
    description: "Open the tickets configuration panel",
    run: async (c) => {
      if (!(await assertPanelPermission(c.interaction))) return undefined;
      await openAdminPanel(c.interaction, "tickets");
    },
  })
  .guildOnly();

type TicketCtx = RunContext<typeof data>;

async function handleOpen(c: Extract<TicketCtx, { subcommand: "open" }>) {
  await c.ctx.respond.defer({ visibility: "ephemeral" });

  const guild = c.guild;
  const typeId = c.options.type;
  const category = TICKET_CATEGORIES.find((cat) => cat.id === typeId);
  if (!category) {
    return { content: "Invalid ticket type." };
  }

  const guildResult = await getGuild(guild.id);
  if (guildResult.isErr()) {
    return { content: "Failed to load guild configuration." };
  }

  const guildDoc = guildResult.unwrap();
  const categoryId = guildDoc?.channels?.ticketCategoryId ?? null;
  if (!categoryId) {
    return {
      content: "No ticket category is configured. Please ask an administrator to set it up.",
    };
  }

  const channelName = makeTicketChannelName(c.user.username);

  const result = await openTicket(c.ctx, guild, c.userId, { categoryId, channelName });

  if (result.isErr()) {
    const err = result.error as TicketError;
    const msg =
      err.code === "LIMIT_REACHED"
        ? "You already have an open ticket. Please close it before opening a new one."
        : "Failed to open ticket. Please try again later.";
    return { content: msg };
  }

  const { channelId } = result.unwrap();

  // Post welcome + inline close button to the new ticket channel.
  // V2 Section puts the Close button beside the heading rather than below it.
  try {
    const ticketChannel =
      guild.channels.cache.get(channelId) ?? (await guild.channels.fetch(channelId));

    if (ticketChannel?.isTextBased() && ticketChannel.type === ChannelType.GuildText) {
      await ticketChannel.send(
        renderTicketWelcome({
          categoryEmoji: category.emoji,
          categoryLabel: category.label,
          userId: c.userId,
          closeCustomId: routes.close.id({ channel: channelId }),
        }),
      );
    }
  } catch {
    // Non-fatal — channel created but couldn't send welcome message
  }

  return { content: `✅ Ticket opened! <#${channelId}>` };
}

async function handleClose(c: Extract<TicketCtx, { subcommand: "close" }>) {
  await c.ctx.respond.defer({ visibility: "ephemeral" });

  const guild = c.guild;
  const channel = c.interaction.channel;
  if (!channel) {
    return { content: "This command can only be used in a server." };
  }

  // Only allow closing from the ticket channel itself, or by staff with ManageChannels
  const member = c.member;
  const isStaff =
    typeof member.permissions !== "string" &&
    member.permissions.has(PermissionFlagsBits.ManageChannels);

  const channelName = ("name" in channel ? channel.name : null) ?? "";
  const isTicketChannel = channelName.startsWith("ticket-");

  if (!isTicketChannel) {
    return { content: "This command must be used inside a ticket channel." };
  }

  if (!isStaff) {
    return {
      content:
        "Only staff can close tickets from this command. Use the Close Ticket button instead.",
    };
  }

  await c.ctx.respond.send(
    v2Message(
      container(
        "warn",
        text(
          "**🔒 Closing Ticket**\nThis ticket is being closed. The channel will be deleted shortly.",
        ),
      ),
    ),
  );

  await closeTicket(c.ctx, guild, channel.id);
  return undefined;
}

async function handleSetup(c: Extract<TicketCtx, { subcommand: "setup" }>) {
  await c.ctx.respond.defer({ visibility: "ephemeral" });

  const member = c.member;
  const isAdmin =
    typeof member.permissions !== "string" &&
    member.permissions.has(PermissionFlagsBits.Administrator);

  if (!isAdmin) {
    return { content: "Only administrators can setup the ticket system." };
  }

  const category = c.options.category;

  const updateResult = await updateGuildPaths(
    c.guild.id,
    { "channels.ticketCategoryId": category.id },
    { upsert: true },
  );

  if (updateResult.isErr()) {
    return { content: `Failed to save configuration: ${updateResult.error.message}` };
  }

  return v2Message(
    container(
      "ok",
      text(
        `**✅ Ticket System Configured**\nTickets will now be created in the <#${category.id}> category.\n-# Use /ticket open to test the system.`,
      ),
    ),
  );
}

export default data
  .help({ hints: [] })
  .handle("open", handleOpen)
  .handle("close", handleClose)
  .handle("setup", handleSetup);
