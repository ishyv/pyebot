import {
  MessageFlags,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  Colors,
  ChannelType,
  type ChatInputCommandInteraction,
  type TextChannel,
  type NewsChannel,
} from "discord.js";

export const data = new SlashCommandBuilder()
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
    sub.setName("off").setDescription("Unlock all text channels (restores @everyone Send Messages)"),
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

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "Server only.", flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const sub = interaction.options.getSubcommand();

  if (sub === "on") {
    const reason = interaction.options.getString("reason") ?? "Server lockdown";
    await setEveryoneSendMessages(interaction, false, reason);
    return;
  }

  if (sub === "off") {
    await setEveryoneSendMessages(interaction, null, "Lockdown lifted");
    return;
  }

  if (sub === "channel") {
    const channel = interaction.options.getChannel("channel", true) as TextChannel | NewsChannel;
    const action = interaction.options.getString("action", true);
    const reason = interaction.options.getString("reason") ?? (action === "lock" ? "Channel locked" : "Channel unlocked");
    const deny = action === "lock" ? false : null;

    try {
      await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
        SendMessages: deny,
      }, { reason: `${reason} — by ${interaction.user.tag}` });
    } catch {
      await interaction.editReply({ content: "Failed to update channel permissions." });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(action === "lock" ? Colors.Red : Colors.Green)
      .setTitle(action === "lock" ? "Channel Locked" : "Channel Unlocked")
      .setDescription(`<#${channel.id}> is now ${action === "lock" ? "🔒 locked" : "🔓 unlocked"}.`)
      .addFields({ name: "Reason", value: reason })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}

async function setEveryoneSendMessages(
  interaction: ChatInputCommandInteraction,
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
  const embed = new EmbedBuilder()
    .setColor(isLocking ? Colors.Red : Colors.Green)
    .setTitle(isLocking ? "🔒 Server Locked Down" : "🔓 Lockdown Lifted")
    .addFields(
      { name: "Channels Updated", value: `${updated}`, inline: true },
      { name: "Failed", value: `${failed}`, inline: true },
      { name: "Reason", value: reason },
    )
    .setFooter({ text: `By ${interaction.user.tag}` })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
