/**
 * Appeal review and decision handlers.
 *
 * Flow after appeal submission:
 *   appeal:review:{g}:{c}  button  → ephemeral panel (this file)
 *   appeal:approve:{g}:{c} button  → approve modal
 *   appeal:deny:{g}:{c}    button  → deny modal
 *   appeal:info:{g}:{c}    button  → request-info modal
 *
 *   appeal:approve-modal:{g}:{c}  modal submit → write PARDON + archive thread
 *   appeal:deny-modal:{g}:{c}     modal submit → deny + archive thread
 *   appeal:info-modal:{g}:{c}     modal submit → post question in thread
 *
 * All decision paths call syncQueueMessage to remove (or keep) the Section.
 * DM failures to the user are always swallowed — .catch(() => null).
 */
import {
  ActionRowBuilder,
  type ButtonInteraction,
  ButtonStyle,
  MessageFlags,
  type ModalActionRowComponentBuilder,
  ModalBuilder,
  type ModalSubmitInteraction,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
  type ThreadChannel,
} from "discord.js";
import { bus } from "@/core/bus";
import { getAppeal, updateAppeal } from "@/db/repositories/appeals";
import { syncQueueMessage } from "@/features/moderation/appeals";
import { appealRoutes } from "@/features/moderation/routes";
import { getCases, pardon } from "@/features/moderation/service";
import { renderSanctionHistory } from "@/features/moderation/views";
import { container, row, separator, text, v2Message } from "@/ui/v2";

interface AppealArgs {
  readonly guildId: string;
  readonly caseId: number;
}

function hasModPerms(interaction: ButtonInteraction | ModalSubmitInteraction): boolean {
  if (!interaction.memberPermissions) return false;
  return (
    interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild) ||
    interaction.memberPermissions.has(PermissionFlagsBits.ModerateMembers)
  );
}

// ---------------------------------------------------------------------------
// Review button → ephemeral panel
// ---------------------------------------------------------------------------

/**
 * Opens an ephemeral moderator review panel showing the appeal details,
 * the user's sanction history, and Approve / Deny / Request-info buttons.
 */
export async function handleAppealReview(
  interaction: ButtonInteraction,
  { guildId, caseId }: AppealArgs,
): Promise<void> {
  if (!hasModPerms(interaction)) {
    await interaction.reply({
      content: "You need Moderate Members or Manage Server to review appeals.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const appeal = await getAppeal(guildId, caseId);

  if (!appeal || appeal.status !== "pending") {
    await interaction.reply({
      content: "This appeal has already been resolved.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const casesResult = await getCases(appeal.userId, guildId);
  const history = casesResult.isOk() ? casesResult.unwrap().slice(0, 10) : [];

  const approveBtn = appealRoutes.approve.button(
    { guildId, caseId },
    { label: "Approve", style: ButtonStyle.Success },
  );

  const denyBtn = appealRoutes.deny.button(
    { guildId, caseId },
    { label: "Deny", style: ButtonStyle.Danger },
  );

  const infoBtn = appealRoutes.info.button(
    { guildId, caseId },
    { label: "Request more info", style: ButtonStyle.Secondary },
  );

  const ts = Math.floor(new Date(appeal.submittedAt).getTime() / 1000);
  const detailContainer = container(
    "info",
    text(
      [
        `## Appeal — Case #${caseId}`,
        `**User:** <@${appeal.userId}> · \`${appeal.userTag}\``,
        `**Submitted:** <t:${ts}:F>`,
        "",
        "**Appeal reason:**",
        appeal.reason,
      ].join("\n"),
    ),
  );

  // History container from renderSanctionHistory — take its first component (the ContainerBuilder)
  const historyContainer =
    history.length > 0 ? renderSanctionHistory(appeal.userTag, history).components[0] : null;

  const actionRow = row(approveBtn, denyBtn, infoBtn);

  const replyComponents = historyContainer
    ? [detailContainer, separator("sm"), historyContainer, actionRow]
    : [detailContainer, actionRow];
  await interaction.reply({
    // biome-ignore lint/suspicious/noExplicitAny: V2 component builders are valid at runtime; discord.js types lag.
    components: replyComponents as any,
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
}

// ---------------------------------------------------------------------------
// Approve button → modal
// ---------------------------------------------------------------------------

export async function handleAppealApproveButton(
  interaction: ButtonInteraction,
  { guildId, caseId }: AppealArgs,
): Promise<void> {
  if (!hasModPerms(interaction)) {
    await interaction.reply({ content: "Permission denied.", flags: MessageFlags.Ephemeral });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(appealRoutes["approve-modal"].id({ guildId, caseId }))
    .setTitle(`Approve Appeal — Case #${caseId}`)
    .addComponents(
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("reason")
          .setLabel("Reason for approval")
          .setStyle(TextInputStyle.Paragraph)
          .setMinLength(1)
          .setMaxLength(2000)
          .setRequired(true),
      ),
    );

  await interaction.showModal(modal);
}

// ---------------------------------------------------------------------------
// Approve modal submit
// ---------------------------------------------------------------------------

export async function handleAppealApproveSubmit(
  interaction: ModalSubmitInteraction,
  { guildId, caseId }: AppealArgs,
): Promise<void> {
  const reason = interaction.fields.getTextInputValue("reason");

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const appeal = await getAppeal(guildId, caseId);
  if (!appeal || appeal.status !== "pending") {
    await interaction.editReply({ content: "This appeal has already been resolved." });
    return;
  }

  const guild =
    interaction.guild ?? (await interaction.client.guilds.fetch(guildId).catch(() => null));
  if (!guild) return;

  const now = new Date().toISOString();

  await updateAppeal(guildId, caseId, {
    status: "approved",
    decision: {
      reviewerId: interaction.user.id,
      decidedAt: now,
      reasonCode: "other",
      note: reason,
    },
  });

  // Record PARDON in sanction history and mod log
  await pardon(guild, interaction.user.id, appeal.userId, appeal.userTag, reason);

  // Unban if applicable — best-effort, non-fatal
  await guild.bans.remove(appeal.userId, `Appeal approved: ${reason}`).catch(() => null);

  // DM user — best-effort
  const targetUser = await interaction.client.users.fetch(appeal.userId).catch(() => null);
  if (targetUser) {
    await targetUser
      .send(
        `✅ Your appeal for Case #${caseId} in **${guild.name}** has been **approved**.\n> ${reason}`,
      )
      .catch(() => null);
  }

  // Post resolution in thread
  const thread = (await guild.channels
    .fetch(appeal.threadId)
    .catch(() => null)) as ThreadChannel | null;
  if (thread) {
    const approvedPayload = v2Message(
      container(
        "ok",
        text(`✅ **Appeal approved** by <@${interaction.user.id}>\n**Reason:** ${reason}`),
      ),
    );
    // biome-ignore lint/suspicious/noExplicitAny: V2 payload valid at runtime; discord.js send types lag.
    await thread.send(approvedPayload as any).catch(() => null);
    await thread.setArchived(true).catch(() => null);
  }

  bus.emit({
    type: "appeal:decided",
    guildId,
    userId: appeal.userId,
    caseId,
    reviewerId: interaction.user.id,
    status: "approved",
  });

  await syncQueueMessage(guild, interaction.client);

  await interaction.editReply({ content: `✅ Appeal for Case #${caseId} approved.` });
}

// ---------------------------------------------------------------------------
// Deny button → modal
// ---------------------------------------------------------------------------

export async function handleAppealDenyButton(
  interaction: ButtonInteraction,
  { guildId, caseId }: AppealArgs,
): Promise<void> {
  if (!hasModPerms(interaction)) {
    await interaction.reply({ content: "Permission denied.", flags: MessageFlags.Ephemeral });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(appealRoutes["deny-modal"].id({ guildId, caseId }))
    .setTitle(`Deny Appeal — Case #${caseId}`)
    .addComponents(
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("reason")
          .setLabel("Reason for denial")
          .setStyle(TextInputStyle.Paragraph)
          .setMinLength(1)
          .setMaxLength(2000)
          .setRequired(true),
      ),
    );

  await interaction.showModal(modal);
}

// ---------------------------------------------------------------------------
// Deny modal submit
// ---------------------------------------------------------------------------

export async function handleAppealDenySubmit(
  interaction: ModalSubmitInteraction,
  { guildId, caseId }: AppealArgs,
): Promise<void> {
  const reason = interaction.fields.getTextInputValue("reason");

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const appeal = await getAppeal(guildId, caseId);
  if (!appeal || appeal.status !== "pending") {
    await interaction.editReply({ content: "This appeal has already been resolved." });
    return;
  }

  const guild =
    interaction.guild ?? (await interaction.client.guilds.fetch(guildId).catch(() => null));
  if (!guild) return;

  const now = new Date().toISOString();

  await updateAppeal(guildId, caseId, {
    status: "denied",
    decision: {
      reviewerId: interaction.user.id,
      decidedAt: now,
      reasonCode: "other",
      note: reason,
    },
  });

  // DM user — best-effort
  const targetUser = await interaction.client.users.fetch(appeal.userId).catch(() => null);
  if (targetUser) {
    await targetUser
      .send(
        `❌ Your appeal for Case #${caseId} in **${guild.name}** has been **denied**.\n> ${reason}`,
      )
      .catch(() => null);
  }

  // Post resolution in thread
  const thread = (await guild.channels
    .fetch(appeal.threadId)
    .catch(() => null)) as ThreadChannel | null;
  if (thread) {
    const deniedPayload = v2Message(
      container(
        "danger",
        text(`❌ **Appeal denied** by <@${interaction.user.id}>\n**Reason:** ${reason}`),
      ),
    );
    // biome-ignore lint/suspicious/noExplicitAny: V2 payload valid at runtime; discord.js send types lag.
    await thread.send(deniedPayload as any).catch(() => null);
    await thread.setArchived(true).catch(() => null);
  }

  bus.emit({
    type: "appeal:decided",
    guildId,
    userId: appeal.userId,
    caseId,
    reviewerId: interaction.user.id,
    status: "denied",
  });

  await syncQueueMessage(guild, interaction.client);

  await interaction.editReply({ content: `❌ Appeal for Case #${caseId} denied.` });
}

// ---------------------------------------------------------------------------
// Request more info button → modal
// ---------------------------------------------------------------------------

export async function handleAppealInfoButton(
  interaction: ButtonInteraction,
  { guildId, caseId }: AppealArgs,
): Promise<void> {
  if (!hasModPerms(interaction)) {
    await interaction.reply({ content: "Permission denied.", flags: MessageFlags.Ephemeral });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(appealRoutes["info-modal"].id({ guildId, caseId }))
    .setTitle(`Request Info — Case #${caseId}`)
    .addComponents(
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("question")
          .setLabel("What do you need to know?")
          .setStyle(TextInputStyle.Paragraph)
          .setMinLength(1)
          .setMaxLength(2000)
          .setRequired(true),
      ),
    );

  await interaction.showModal(modal);
}

// ---------------------------------------------------------------------------
// Request more info modal submit
// ---------------------------------------------------------------------------

export async function handleAppealInfoSubmit(
  interaction: ModalSubmitInteraction,
  { guildId, caseId }: AppealArgs,
): Promise<void> {
  const question = interaction.fields.getTextInputValue("question");

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const appeal = await getAppeal(guildId, caseId);
  if (!appeal || appeal.status === "approved" || appeal.status === "denied") {
    await interaction.editReply({ content: "This appeal has already been resolved." });
    return;
  }

  const guild =
    interaction.guild ?? (await interaction.client.guilds.fetch(guildId).catch(() => null));
  if (!guild) return;

  await updateAppeal(guildId, caseId, { status: "info_requested" });

  const thread = (await guild.channels
    .fetch(appeal.threadId)
    .catch(() => null)) as ThreadChannel | null;
  if (thread) {
    const infoPayload = v2Message(
      container(
        "warn",
        text(
          `**<@${interaction.user.id}> requested more information:**\n${question}\n\n-# <@${appeal.userId}> — please check your DMs or respond in this thread.`,
        ),
      ),
    );
    // biome-ignore lint/suspicious/noExplicitAny: V2 payload valid at runtime; discord.js send types lag.
    await thread.send(infoPayload as any).catch(() => null);
  }

  // DM user with the question — best-effort
  const targetUser = await interaction.client.users.fetch(appeal.userId).catch(() => null);
  if (targetUser) {
    await targetUser
      .send(
        `📋 A moderator reviewing your appeal for Case #${caseId} in **${guild.name}** needs more information:\n> ${question}`,
      )
      .catch(() => null);
  }
  // Queue message stays unchanged — appeal remains pending (status: info_requested)

  await interaction.editReply({ content: "📋 Question sent. The appeal remains open." });
}
