/**
 * Appeal submission flow.
 *
 * Step 1: User clicks "Appeal Ban" button in their DM.
 *         CustomId: `mod:appeal:{guildId}:{caseId}`
 *         → Check appeals are enabled and no prior appeal exists, then show modal.
 *
 * Step 2: User submits the modal.
 *         CustomId: `mod:appeal-submit:{guildId}:{caseId}`
 *         → Create appeal record, open private thread, sync queue message,
 *           confirm to user.
 *
 * Both handlers are best-effort — DM failures are silently swallowed, and a
 * missing appeals channel means appeals are disabled for that guild.
 */
import {
  ActionRowBuilder,
  type ButtonInteraction,
  ChannelType,
  MessageFlags,
  type ModalActionRowComponentBuilder,
  ModalBuilder,
  type ModalSubmitInteraction,
  type TextChannel,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { createAppeal, getAppeal } from "@/db/repositories/appeals";
import { getGuild } from "@/db/repositories/guilds";
import { syncQueueMessage } from "@/features/moderation/appeals";
import { modRoutes } from "@/features/moderation/routes";
import { container, text, v2Message } from "@/ui/v2";

interface AppealArgs {
  readonly guildId: string;
  readonly caseId: number;
}

/**
 * Handles the "Appeal Ban" button click in the user's DM. Shows the appeal
 * reason modal if appeals are enabled and no prior appeal exists for this case.
 */
export async function handleAppealButton(
  interaction: ButtonInteraction,
  { guildId, caseId }: AppealArgs,
): Promise<void> {
  const guildResult = await getGuild(guildId);
  const guildData = guildResult.isOk() ? guildResult.unwrap() : null;

  if (!guildData?.moderation.appealsChannelId) {
    await interaction.reply({
      content: "This server has not enabled appeals.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const existing = await getAppeal(guildId, caseId);
  if (existing) {
    await interaction.reply({
      content: "You have already submitted an appeal for this case.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(modRoutes["appeal-submit"].id({ guildId, caseId }))
    .setTitle(`Appeal Ban — Case #${caseId}`)
    .addComponents(
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("reason")
          .setLabel("Why should this decision be reconsidered?")
          .setStyle(TextInputStyle.Paragraph)
          .setMinLength(1)
          .setMaxLength(2000)
          .setRequired(true),
      ),
    );

  await interaction.showModal(modal);
}

/**
 * Handles modal submit for the appeal reason. Creates the appeal record,
 * opens a private thread, and syncs the guild queue message.
 */
export async function handleAppealSubmit(
  interaction: ModalSubmitInteraction,
  { guildId, caseId }: AppealArgs,
): Promise<void> {
  const reason = interaction.fields.getTextInputValue("reason");

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guildResult = await getGuild(guildId);
  const guildData = guildResult.isOk() ? guildResult.unwrap() : null;
  const appealsChannelId = guildData?.moderation.appealsChannelId;

  if (!appealsChannelId) {
    await interaction.editReply({ content: "Appeals are not enabled for this server." });
    return;
  }

  // Fetch guild from client (we're in a DM context, so guild is not on interaction)
  const guild = await interaction.client.guilds.fetch(guildId).catch(() => null);
  if (!guild) {
    await interaction.editReply({ content: "Could not reach that server. Please try again." });
    return;
  }

  const appealsChannel = await guild.channels.fetch(appealsChannelId).catch(() => null);
  if (!appealsChannel?.isTextBased() || !("threads" in appealsChannel)) {
    await interaction.editReply({ content: "The appeals channel is misconfigured." });
    return;
  }

  // Create private thread for moderator discussion.
  // Guarded above: "threads" in appealsChannel ensures this is a TextChannel.
  const thread = await (appealsChannel as TextChannel).threads
    .create({
      name: `Appeal — @${interaction.user.username} · Case #${caseId}`,
      autoArchiveDuration: 10080, // 7 days
      type: ChannelType.PrivateThread,
      reason: `Appeal for ban case #${caseId}`,
    })
    .catch(() => null);

  if (!thread) {
    await interaction.editReply({
      content: "Could not create the appeal thread. Please contact a moderator.",
    });
    return;
  }

  const now = new Date().toISOString();

  const createResult = await createAppeal({
    guildId,
    caseId,
    userId: interaction.user.id,
    userTag: interaction.user.username,
    submittedAt: now,
    reason,
    threadId: thread.id,
    status: "pending",
  });

  if (createResult.isErr()) {
    await interaction.editReply({ content: "Failed to save your appeal. Please try again." });
    return;
  }

  // Post context card in thread
  const contextCard = v2Message(
    container(
      "info",
      text(
        [
          `## Appeal — Case #${caseId}`,
          `**User:** <@${interaction.user.id}> (\`${interaction.user.username}\`)`,
          `**Submitted:** <t:${Math.floor(Date.now() / 1000)}:F>`,
          "",
          "**Appeal reason:**",
          reason,
        ].join("\n"),
      ),
    ),
  );
  // biome-ignore lint/suspicious/noExplicitAny: V2 payload valid at runtime; discord.js send types lag.
  await thread.send(contextCard as any);

  await syncQueueMessage(guild, interaction.client);

  await interaction.editReply({
    content:
      "✅ Your appeal has been submitted. You will receive a DM when a moderator makes a decision.",
  });
}
