import { type Client, PermissionFlagsBits } from "discord.js";
import { createLogger } from "@/core/logger";
import { ErrResult, OkResult } from "@/core/result";
import {
  deleteEmbedConfig,
  embedConfigId,
  getEmbedConfig,
  listEmbedConfigs,
  patchEmbedConfig,
  saveEmbedConfig,
} from "@/db/repositories/embeds";
import { EmbedDraftInputSchema } from "@/db/schemas/embed-config";
import type { EmbedConfigDraft } from "@/features/embeds/model";
import { configFromDraft, parseEmbedName } from "@/features/embeds/model";
import { sendEmbed as sendEmbedToChannel } from "@/features/embeds/service";
import type { BotBridge, EmbedConfigDTO, EmbedDraftDTO, EmbedSummary } from "../bridge-types";
import { type BridgeEmit, requireGuildPermission } from "./shared";

const log = createLogger("webapp:bridge");

/** Creates embed CRUD/send bridge methods backed by embed config repositories. */
export function createEmbedBridge(
  client: Client,
  emit: BridgeEmit,
): Pick<BotBridge, "listEmbeds" | "getEmbed" | "saveEmbed" | "deleteEmbed" | "sendEmbed"> {
  return {
    async listEmbeds(guildId) {
      const res = await listEmbedConfigs(guildId);
      if (res.isErr()) return ErrResult(res.error);
      const summaries: EmbedSummary[] = res.unwrap().map((cfg) => ({
        name: cfg.name,
        channelId: cfg.channelId,
        stickyEnabled: cfg.stickyEnabled,
        scheduleEnabled: cfg.scheduleEnabled,
        scheduleIntervalHours: cfg.scheduleIntervalHours,
        updatedAt: cfg.updatedAt,
      }));
      summaries.sort((a, b) => a.name.localeCompare(b.name));
      return OkResult(summaries);
    },

    async getEmbed(guildId, name) {
      const parsedName = parseEmbedName(name);
      if (!parsedName) return ErrResult(new Error("Invalid embed name."));
      const res = await getEmbedConfig(guildId, parsedName);
      if (res.isErr()) return ErrResult(res.error);
      return OkResult(res.unwrap() as EmbedConfigDTO | null);
    },

    async saveEmbed(guildId, name, draft: EmbedDraftDTO, actorId) {
      const parsedName = parseEmbedName(name);
      if (!parsedName) return ErrResult(new Error("Invalid embed name."));
      const permission = await requireGuildPermission(
        client,
        guildId,
        actorId,
        PermissionFlagsBits.ManageMessages,
      );
      if (permission.isErr()) return ErrResult(permission.error);

      const content = EmbedDraftInputSchema.safeParse({
        embedTitle: draft.embedTitle,
        embedDescription: draft.embedDescription,
        embedColor: draft.embedColor,
        embedUrl: draft.embedUrl,
        embedThumbnail: draft.embedThumbnail,
        embedImage: draft.embedImage,
        embedAuthorName: draft.embedAuthorName,
        embedAuthorIconUrl: draft.embedAuthorIconUrl,
        embedAuthorUrl: draft.embedAuthorUrl,
        embedFooterText: draft.embedFooterText,
        embedFooterIconUrl: draft.embedFooterIconUrl,
        embedFields: draft.embedFields,
      });
      if (!content.success) {
        return ErrResult(new Error(content.error.issues[0]?.message ?? "Invalid embed."));
      }

      const scheduleEnabled = draft.scheduleEnabled && draft.scheduleIntervalHours !== null;
      const fullDraft: EmbedConfigDraft = {
        ...content.data,
        script: draft.script,
        scriptEnabled: draft.scriptEnabled,
        channelId: draft.channelId,
        scheduleEnabled,
        scheduleIntervalHours: scheduleEnabled ? draft.scheduleIntervalHours : null,
        stickyEnabled: draft.stickyEnabled,
      };

      const previousRes = await getEmbedConfig(guildId, parsedName);
      if (previousRes.isErr()) return ErrResult(previousRes.error);

      const config = configFromDraft(
        {
          guildId,
          ownerId: actorId ?? permission.unwrap().member.id,
          embedName: parsedName,
          draft: fullDraft,
        },
        previousRes.unwrap(),
      );
      const saved = await saveEmbedConfig(config);
      if (saved.isErr()) return ErrResult(saved.error);
      emit({
        type: "config_changed",
        guildId,
        actorId: actorId ?? undefined,
        detail: `Saved embed ${parsedName}`,
        timestamp: Date.now(),
      });
      return OkResult(saved.unwrap() as EmbedConfigDTO);
    },

    async deleteEmbed(guildId, name, actorId) {
      const parsedName = parseEmbedName(name);
      if (!parsedName) return ErrResult(new Error("Invalid embed name."));
      const permission = await requireGuildPermission(
        client,
        guildId,
        actorId,
        PermissionFlagsBits.ManageMessages,
      );
      if (permission.isErr()) return ErrResult(permission.error);
      const res = await deleteEmbedConfig(embedConfigId(guildId, parsedName));
      if (res.isErr()) return ErrResult(res.error);
      emit({
        type: "config_changed",
        guildId,
        actorId: actorId ?? undefined,
        detail: `Deleted embed ${parsedName}`,
        timestamp: Date.now(),
      });
      return OkResult(res.unwrap());
    },

    async sendEmbed(guildId, name, actorId) {
      const parsedName = parseEmbedName(name);
      if (!parsedName) return ErrResult(new Error("Invalid embed name."));
      const permission = await requireGuildPermission(
        client,
        guildId,
        actorId,
        PermissionFlagsBits.ManageMessages,
      );
      if (permission.isErr()) return ErrResult(permission.error);
      const { guild } = permission.unwrap();

      const res = await getEmbedConfig(guildId, parsedName);
      if (res.isErr()) return ErrResult(res.error);
      const config = res.unwrap();
      if (!config) return ErrResult(new Error("Embed not found."));
      if (!config.channelId) return ErrResult(new Error("This embed has no target channel set."));

      const channel = await guild.channels.fetch(config.channelId).catch(() => null);
      if (!channel?.isTextBased()) {
        return ErrResult(new Error("Target channel not found or is not a text channel."));
      }
      const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
      const perms = me ? channel.permissionsFor(me) : null;
      if (
        !perms?.has(PermissionFlagsBits.ViewChannel) ||
        !perms.has(PermissionFlagsBits.SendMessages) ||
        !perms.has(PermissionFlagsBits.EmbedLinks)
      ) {
        return ErrResult(new Error("Bot cannot post embeds in that channel."));
      }

      try {
        const sent = await sendEmbedToChannel(config, channel, guild);
        if (config.stickyEnabled) {
          const patchRes = await patchEmbedConfig(config._id, {
            stickyMessageId: sent.id,
            stickyLastResendAt: new Date(),
          });
          if (patchRes.isErr()) {
            log.warn("Failed to update sticky message ID after send", patchRes.error);
          }
        }
        emit({
          type: "config_changed",
          guildId,
          actorId: actorId ?? undefined,
          detail: `Sent embed ${parsedName}`,
          timestamp: Date.now(),
        });
        return OkResult({ messageId: sent.id });
      } catch (err) {
        return ErrResult(err instanceof Error ? err : new Error(String(err)));
      }
    },
  };
}
