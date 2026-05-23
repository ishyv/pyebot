/**
 * Concrete `BotBridge` implementation built from the live Discord.js client.
 *
 * This module owns bridge lifecycle wiring: event stream creation, bot event
 * subscriptions, Discord member join/leave listeners, and final composition of
 * the feature-specific bridge method groups.
 */

import { EventEmitter } from "node:events";
import type { Client, GuildMember, PartialGuildMember } from "discord.js";
import { bus } from "@/core/bus";
import { createAutomodBridge } from "./bot-bridge/automod";
import { createBannedImagesBridge } from "./bot-bridge/banned-images";
import { createEconomyBridge } from "./bot-bridge/economy";
import { createEmbedBridge } from "./bot-bridge/embeds";
import { createFeatureBridge } from "./bot-bridge/features";
import { createGuildBridge } from "./bot-bridge/guild";
import { createModerationBridge, mapActionEvent } from "./bot-bridge/moderation";
import { createRpgContentBridge } from "./bot-bridge/rpg-content";
import type { BotBridge, BotEvent } from "./bridge-types";

/** Builds the live bot bridge registered for the embedded webapp. */
export function createBridgeFromClient(client: Client): BotBridge {
  const events = new EventEmitter();
  events.setMaxListeners(64);

  const emit = (event: BotEvent): void => {
    events.emit("event", event);
  };

  bus.on("mod:action", (event) => {
    emit(mapActionEvent(event));
  });
  bus.on("appeal:decided", (event) => {
    emit({
      type: "appeal_decided",
      guildId: event.guildId,
      actorId: event.reviewerId,
      targetId: event.userId,
      detail: `Appeal ${event.status} for case #${event.caseId}`,
      timestamp: Date.now(),
    });
  });

  client.on("guildMemberAdd", (member: GuildMember) => {
    emit({
      type: "member_join",
      guildId: member.guild.id,
      targetId: member.id,
      detail: `${member.user.tag} joined`,
      timestamp: Date.now(),
    });
  });
  client.on("guildMemberRemove", (member: GuildMember | PartialGuildMember) => {
    emit({
      type: "member_leave",
      guildId: member.guild.id,
      targetId: member.id,
      detail: `${member.user.tag} left`,
      timestamp: Date.now(),
    });
  });

  const bridge = {
    events,
    ...createGuildBridge(client, emit),
    ...createFeatureBridge(emit),
    ...createEconomyBridge(emit),
    ...createAutomodBridge(emit),
    ...createBannedImagesBridge(client, emit),
    ...createModerationBridge(client, emit),
    ...createRpgContentBridge(emit),
    ...createEmbedBridge(client, emit),
  } satisfies BotBridge;

  return bridge;
}
