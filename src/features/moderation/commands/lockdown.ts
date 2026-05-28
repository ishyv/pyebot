import type { NewsChannel } from "discord.js";
import { ChannelType, type Guild, PermissionFlagsBits, type TextChannel } from "discord.js";
import { command } from "@/framework";
import { container, text, v2Message } from "@/ui/v2";

export default command("lockdown")
  .description("Lock or unlock channels to prevent members from sending messages")
  .defaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .guildOnly()
  .defer("ephemeral")
  .subcommand("on", "Lock all text channels (removes @everyone Send Messages)", (s) =>
    s.string("reason", "Reason for lockdown"),
  )
  .subcommand("off", "Unlock all text channels (restores @everyone Send Messages)")
  .subcommand("channel", "Lock or unlock a specific channel", (s) =>
    s
      .channel("channel", "Channel to lock/unlock", {
        required: true,
        channelTypes: [ChannelType.GuildText, ChannelType.GuildAnnouncement],
      })
      .string("action", "Lock or unlock", {
        required: true,
        choices: [
          { name: "Lock", value: "lock" },
          { name: "Unlock", value: "unlock" },
        ],
      })
      .string("reason", "Reason"),
  )
  .help({ hints: ["/mod help"] })
  .handle("on", async (c) => {
    const reason = c.options.reason ?? "Server lockdown";
    return setEveryoneSendMessages(c.guild, c.interaction.user.tag, false, reason);
  })
  .handle("off", (c) =>
    setEveryoneSendMessages(c.guild, c.interaction.user.tag, null, "Lockdown lifted"),
  )
  .handle("channel", async (c) => {
    const channel = c.options.channel as TextChannel | NewsChannel;
    const { action } = c.options;
    const reason = c.options.reason ?? (action === "lock" ? "Channel locked" : "Channel unlocked");
    const deny = action === "lock" ? false : null;

    try {
      await channel.permissionOverwrites.edit(
        c.guild.roles.everyone,
        { SendMessages: deny },
        { reason: `${reason} — by ${c.interaction.user.tag}` },
      );
    } catch {
      return { content: "Failed to update channel permissions." };
    }

    const isLocking = action === "lock";
    return v2Message(
      container(
        isLocking ? "danger" : "ok",
        text(
          `**${isLocking ? "🔒 Channel Locked" : "🔓 Channel Unlocked"}** — <#${channel.id}>\n**Reason:** ${reason}`,
        ),
      ),
    );
  });

async function setEveryoneSendMessages(
  guild: Guild,
  userTag: string,
  value: boolean | null,
  reason: string,
) {
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
          { reason: `${reason} — by ${userTag}` },
        );
        updated++;
      } catch {
        failed++;
      }
    }),
  );

  const isLocking = value === false;
  const failedNote = failed > 0 ? `\n**Failed:** ${failed}` : "";
  return v2Message(
    container(
      isLocking ? "danger" : "ok",
      text(
        `**${isLocking ? "🔒 Server Locked Down" : "🔓 Lockdown Lifted"}**\n` +
          `**Channels updated:** ${updated}${failedNote}\n**Reason:** ${reason}`,
      ),
    ),
  );
}
