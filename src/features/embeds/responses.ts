import type {
  ButtonInteraction,
  ChatInputCommandInteraction,
  ContainerBuilder,
  EmbedBuilder,
  InteractionReplyOptions,
  MessageEditOptions,
  ModalSubmitInteraction,
} from "discord.js";
import { MessageFlags } from "discord.js";
import { container, text } from "@/ui/v2";

type ReplyableInteraction = Pick<
  ChatInputCommandInteraction,
  "reply" | "editReply" | "followUp" | "replied" | "deferred"
>;

type UpdatableInteraction = Pick<ButtonInteraction, "update">;

type ModalPanelInteraction = Pick<
  ModalSubmitInteraction,
  "deferUpdate" | "editReply" | "replied" | "deferred"
>;

type DeferredInteraction = Pick<ChatInputCommandInteraction, "deferReply" | "editReply">;

function v2PanelPayload(panel: ContainerBuilder): InteractionReplyOptions & MessageEditOptions {
  return {
    // biome-ignore lint/suspicious/noExplicitAny: V2 ContainerBuilder is valid at runtime before discord.js types catch up.
    components: [panel] as any,
    flags: MessageFlags.IsComponentsV2,
  };
}

/** Replies with plain ephemeral text for command failures before a V2 panel exists. */
export async function replyEphemeralText(
  interaction: ReplyableInteraction,
  content: string,
): Promise<void> {
  const payload: InteractionReplyOptions = { content, flags: MessageFlags.Ephemeral };
  if (interaction.deferred) {
    await interaction.editReply({ content });
    return;
  }
  if (interaction.replied) {
    await interaction.followUp(payload);
    return;
  }
  await interaction.reply(payload);
}

/** Defers a command/component response for work that may run scripts or send Discord messages. */
export async function deferEphemeral(interaction: DeferredInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
}

/** Completes a previously deferred ephemeral text response. */
export async function editDeferredText(
  interaction: Pick<ChatInputCommandInteraction, "editReply">,
  content: string,
): Promise<void> {
  await interaction.editReply({ content });
}

/** Completes a previously deferred preview response with a classic Discord embed. */
export async function editDeferredEmbed(
  interaction: Pick<ChatInputCommandInteraction, "editReply">,
  embed: EmbedBuilder,
): Promise<void> {
  await interaction.editReply({ embeds: [embed] });
}

/** Sends the initial wizard/list panel as a V2 ephemeral interaction response. */
export async function replyEphemeralPanel(
  interaction: ReplyableInteraction,
  panel: ContainerBuilder,
): Promise<void> {
  await interaction.reply({
    ...v2PanelPayload(panel),
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
}

/** Updates an existing component V2 panel without illegal legacy content fields. */
export async function updatePanel(
  interaction: UpdatableInteraction,
  panel: ContainerBuilder,
): Promise<void> {
  await interaction.update(v2PanelPayload(panel));
}

/** Replaces an open V2 panel with a terminal status message that is still V2-only. */
export async function replacePanelWithStatus(
  interaction: UpdatableInteraction,
  message: string,
  accent: "info" | "ok" | "warn" | "danger" = "info",
): Promise<void> {
  await updatePanel(interaction, container(accent, text(message)));
}

/** Modal submits cannot update directly; acknowledge first, then edit via interaction webhook. */
export async function modalUpdatePanel(
  interaction: ModalPanelInteraction,
  panel: ContainerBuilder,
): Promise<void> {
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferUpdate();
  }
  await interaction.editReply(v2PanelPayload(panel));
}
