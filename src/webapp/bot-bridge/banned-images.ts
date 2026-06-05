import { type Client, PermissionFlagsBits } from "discord.js";
import { ErrResult, OkResult } from "@/core/result";
import { ensureGuild } from "@/db/repositories/guilds";
import {
  type BannedImageRecord,
  displayBannedImageId,
  findBannedImageMatch,
  listActiveBannedImages,
  MAX_IMAGE_BYTES,
  removeBannedImage as softRemoveBannedImage,
  addBannedImage as storeBannedImage,
  editBannedImage as updateBannedImage,
} from "@/features/automod/bannedImages";
import { hashImageBuffer } from "@/features/automod/imageHash";
import { headlessEntityContext } from "@/framework/entity-context";
import type { BannedImageSummary, BotBridge, ImageDetectionTolerance } from "../bridge-types";
import { type BridgeEmit, requireGuildPermission } from "./shared";

function summarizeBannedImage(record: BannedImageRecord): BannedImageSummary {
  return {
    id: displayBannedImageId(record),
    label: record.label,
    reason: record.reason,
    sourceUrl: record.sourceUrl,
    sourceContentType: record.sourceContentType,
    sourceFilename: record.sourceFilename,
    addedBy: record.addedBy,
    addedAt: record.addedAt.toISOString(),
  };
}

function imageToleranceFromConfig(config: unknown): ImageDetectionTolerance {
  const automod =
    typeof config === "object" && config !== null
      ? (config as { automod?: unknown }).automod
      : null;
  const image =
    typeof automod === "object" && automod !== null
      ? (automod as { imageDetection?: unknown }).imageDetection
      : null;
  const tolerance =
    typeof image === "object" && image !== null
      ? (image as { tolerance?: unknown }).tolerance
      : null;
  return tolerance === "strict" || tolerance === "loose" ? tolerance : "balanced";
}

/** Creates banned-image dashboard bridge methods backed by AutoMod image storage. */
export function createBannedImagesBridge(
  client: Client,
  emit: BridgeEmit,
): Pick<
  BotBridge,
  | "listBannedImages"
  | "addBannedImage"
  | "editBannedImage"
  | "removeBannedImage"
  | "testBannedImage"
> {
  return {
    async listBannedImages(guildId) {
      try {
        const entities = await headlessEntityContext();
        return OkResult(
          (await listActiveBannedImages(entities, guildId)).map(summarizeBannedImage),
        );
      } catch (error) {
        return ErrResult(error instanceof Error ? error : new Error(String(error)));
      }
    },

    async addBannedImage(guildId, input, actorId) {
      const permission = await requireGuildPermission(
        client,
        guildId,
        actorId,
        PermissionFlagsBits.ManageGuild,
      );
      if (permission.isErr()) return ErrResult(permission.error);
      const reason = input.reason.trim();
      if (!reason) return ErrResult(new Error("Reason required."));
      if (input.bytes.byteLength === 0) return ErrResult(new Error("Image required."));
      if (input.bytes.byteLength > MAX_IMAGE_BYTES) {
        return ErrResult(new Error("Image is too large."));
      }

      try {
        const hashes = await hashImageBuffer(Buffer.from(input.bytes));
        const record = await storeBannedImage(await headlessEntityContext(), {
          guildId,
          actorId: actorId ?? permission.unwrap().member.id,
          reason,
          label: input.label,
          sourceUrl: null,
          sourceContentType: input.contentType,
          sourceFilename: input.filename,
          hashes,
        });
        emit({
          type: "config_changed",
          guildId,
          actorId: actorId ?? undefined,
          detail: `Added banned image ${displayBannedImageId(record)}`,
          timestamp: Date.now(),
        });
        return OkResult(summarizeBannedImage(record));
      } catch (error) {
        return ErrResult(error instanceof Error ? error : new Error(String(error)));
      }
    },

    async editBannedImage(guildId, id, patch, actorId) {
      const permission = await requireGuildPermission(
        client,
        guildId,
        actorId,
        PermissionFlagsBits.ManageGuild,
      );
      if (permission.isErr()) return ErrResult(permission.error);
      const reason = patch.reason?.trim();
      if (patch.reason !== undefined && !reason) return ErrResult(new Error("Reason required."));

      try {
        const record = await updateBannedImage(await headlessEntityContext(), guildId, id, {
          ...(reason !== undefined ? { reason } : {}),
          ...(patch.label !== undefined ? { label: patch.label } : {}),
        });
        if (!record) return ErrResult(new Error("Banned image not found."));
        emit({
          type: "config_changed",
          guildId,
          actorId: actorId ?? undefined,
          detail: `Edited banned image ${displayBannedImageId(record)}`,
          timestamp: Date.now(),
        });
        return OkResult(summarizeBannedImage(record));
      } catch (error) {
        return ErrResult(error instanceof Error ? error : new Error(String(error)));
      }
    },

    async removeBannedImage(guildId, id, actorId) {
      const permission = await requireGuildPermission(
        client,
        guildId,
        actorId,
        PermissionFlagsBits.ManageGuild,
      );
      if (permission.isErr()) return ErrResult(permission.error);

      try {
        const record = await softRemoveBannedImage(
          await headlessEntityContext(),
          guildId,
          id,
          actorId ?? permission.unwrap().member.id,
        );
        if (!record) return ErrResult(new Error("Banned image not found."));
        emit({
          type: "config_changed",
          guildId,
          actorId: actorId ?? undefined,
          detail: `Removed banned image ${displayBannedImageId(record)}`,
          timestamp: Date.now(),
        });
        return OkResult(summarizeBannedImage(record));
      } catch (error) {
        return ErrResult(error instanceof Error ? error : new Error(String(error)));
      }
    },

    async testBannedImage(guildId, input) {
      if (input.bytes.byteLength === 0) return ErrResult(new Error("Image required."));
      if (input.bytes.byteLength > MAX_IMAGE_BYTES) {
        return ErrResult(new Error("Image is too large."));
      }

      try {
        const [records, configResult] = await Promise.all([
          headlessEntityContext().then((entities) => listActiveBannedImages(entities, guildId)),
          ensureGuild(guildId),
        ]);
        if (configResult.isErr()) return ErrResult(configResult.error);
        const hashes = await hashImageBuffer(Buffer.from(input.bytes));
        const match = findBannedImageMatch(
          hashes,
          records,
          imageToleranceFromConfig(configResult.unwrap()),
        );
        return OkResult({
          matched: match !== null,
          record: match ? summarizeBannedImage(match.record) : null,
          distance: match ? match.distance : null,
        });
      } catch (error) {
        return ErrResult(error instanceof Error ? error : new Error(String(error)));
      }
    },
  };
}
