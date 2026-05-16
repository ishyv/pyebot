/**
 * Verification gate.
 *
 * On guildMemberAdd, if verification is enabled:
 *   - "account_age" mode: kick members whose accounts are younger than minAccountAgeDays.
 *   - "button" mode: post a verify prompt in the configured channel;
 *     on button click, grant the configured role.
 *
 * Configuration: guild.moderation.verification
 */

import {
  ButtonBuilder,
  ButtonStyle,
  type Client,
  type GuildMember,
  type TextChannel,
} from "discord.js";
import { createLogger } from "@/core/logger";
import { getGuild } from "@/db/repositories/guilds";
import { container, row, text, v2Message } from "@/ui/v2";

const log = createLogger("moderation:verification");

export function registerVerification(client: Client): void {
  client.on("guildMemberAdd", async (member) => {
    try {
      await onMemberJoin(member);
    } catch (err) {
      log.error("Verification gate error", err);
    }
  });
}

async function onMemberJoin(member: GuildMember): Promise<void> {
  const guildResult = await getGuild(member.guild.id);
  if (guildResult.isErr() || !guildResult.unwrap()) return;

  const config = guildResult.unwrap()!.moderation.verification;
  if (!config.enabled) return;

  const accountAgeDays = (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);

  // Account age gate — kick regardless of mode
  if (config.minAccountAgeDays > 0 && accountAgeDays < config.minAccountAgeDays) {
    log.info(
      `Kicking ${member.user.tag}: account age ${Math.floor(accountAgeDays)}d < ${config.minAccountAgeDays}d`,
    );
    try {
      await member
        .send(
          `You were removed from **${member.guild.name}** because your account is too new. ` +
            `Please wait until your account is at least ${config.minAccountAgeDays} days old.`,
        )
        .catch(() => {});
      await member.kick(
        `Account age check: ${Math.floor(accountAgeDays)}d < ${config.minAccountAgeDays}d`,
      );
    } catch (err) {
      log.error("Failed to kick new account", err);
    }
    return;
  }

  if (config.mode === "button" && config.channelId) {
    await postVerifyPrompt(member, config.channelId);
  }
}

async function postVerifyPrompt(member: GuildMember, channelId: string): Promise<void> {
  try {
    const channel = await member.guild.channels.fetch(channelId);
    if (!channel?.isTextBased() || !("send" in channel)) return;

    const verifyRow = row(
      new ButtonBuilder()
        .setCustomId(`mod:verify:${member.id}`)
        .setLabel("✓ Verify")
        .setStyle(ButtonStyle.Success),
    );

    // biome-ignore lint/suspicious/noExplicitAny: V2 ContainerBuilder is valid at runtime but not in discord.js MessageCreateOptions types.
    await (channel as TextChannel).send(
      v2Message(
        container(
          "info",
          text(
            `## Welcome! Please verify to access the server.\n<@${member.id}>, click the button below to confirm you're human and gain access.`,
          ),
          verifyRow,
        ),
      ) as any,
    );
  } catch (err) {
    log.error("Failed to post verify prompt", err);
  }
}
