import {
  ChannelType,
  type ChatInputCommandInteraction,
  MessageFlags,
  type NewsChannel,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type TextChannel,
} from "discord.js";
import { defineCommand } from "@/framework";
import type { Ctx } from "@/framework/types";
import { container, text, v2Message } from "@/ui/v2";

const data = new SlashCommandBuilder()
  .setName("lockdown")
  .setDescription("Lock or unlock channels to prevent members from sending messages")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .setDMPermission(false)
  .addSubcommand((sub) =>
    sub
      .setName("on")
      .setDescription("Lock all text channels (removes @everyone Send Messages)")
      .addStringOption((o) => o.setName("reason").setDescription("Reason for lockdown")),
  )
  .addSubcommand((sub) =>
    sub
      .setName("off")
      .setDescription("Unlock all text channels (restores @everyone Send Messages)"),
  )
  .addSubcommand((sub) =>
    sub
      .setName("channel")
      .setDescription("Lock or unlock a specific channel")
      .addChannelOption((o) =>
        o
          .setName("channel")
          .setDescription("Channel to lock/unlock")
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
          .setRequired(true),
      )
      .addStringOption((o) =>
        o
          .setName("action")
          .setDescription("Lock or unlock")
          .setRequired(true)
          .addChoices({ name: "Lock", value: "lock" }, { name: "Unlock", value: "unlock" }),
      )
      .addStringOption((o) => o.setName("reason").setDescription("Reason")),
  );

async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  if (!interaction.guild) {
    await ctx.respond.send({ content: "Server only.", flags: MessageFlags.Ephemeral });
    return;
  }

  await ctx.respond.defer({ visibility: "ephemeral" });
  const sub = interaction.options.getSubcommand();

  if (sub === "on") {
    const reason = interaction.options.getString("reason") ?? "Server lockdown";
    await setEveryoneSendMessages(interaction, ctx, false, reason);
    return;
  }

  if (sub === "off") {
    await setEveryoneSendMessages(interaction, ctx, null, "Lockdown lifted");
    return;
  }

  if (sub === "channel") {
    const channel = interaction.options.getChannel("channel", true) as TextChannel | NewsChannel;
    const action = interaction.options.getString("action", true);
    const reason =
      interaction.options.getString("reason") ??
      (action === "lock" ? "Channel locked" : "Channel unlocked");
    const deny = action === "lock" ? false : null;

    try {
      await channel.permissionOverwrites.edit(
        interaction.guild.roles.everyone,
        {
          SendMessages: deny,
        },
        { reason: `${reason} — by ${interaction.user.tag}` },
      );
    } catch {
      await ctx.respond.send({ content: "Failed to update channel permissions." });
      return;
    }

    const isLocking = action === "lock";
    await ctx.respond.send(
      v2Message(
        container(
          isLocking ? "danger" : "ok",
          text(
            `**${isLocking ? "🔒 Channel Locked" : "🔓 Channel Unlocked"}** — <#${channel.id}>\n**Reason:** ${reason}`,
          ),
        ),
      ),
    );
  }
}

async function setEveryoneSendMessages(
  interaction: ChatInputCommandInteraction,
  ctx: Ctx,
  value: boolean | null,
  reason: string,
): Promise<void> {
  const guild = interaction.guild!;
  const textChannels = guild.channels.cache.filter(
    (c) => c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement,
  );

  let updated = 0;
  let failed = 0;

  await Promise.all(
    [...textChannels.values()].map(async (c) => {
      try {
        await (c as TextChannel).permissionOverwrites.edit(
          guild.roles.everyone,
          { SendMessages: value },
          { reason: `${reason} — by ${interaction.user.tag}` },
        );
        updated++;
      } catch {
        failed++;
      }
    }),
  );

  const isLocking = value === false;
  const failedNote = failed > 0 ? `\n**Failed:** ${failed}` : "";
  await ctx.respond.send(
    v2Message(
      container(
        isLocking ? "danger" : "ok",
        text(
          `**${isLocking ? "🔒 Server Locked Down" : "🔓 Lockdown Lifted"}**\n` +
            `**Channels updated:** ${updated}${failedNote}\n**Reason:** ${reason}`,
        ),
      ),
    ),
  );
}

export default defineCommand({
  data,
  help: { hints: ["/mod help"] },
  execute,
});
