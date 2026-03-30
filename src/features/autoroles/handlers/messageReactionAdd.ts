/**
 * messageReactionAdd handler — applies onReact autorole rules.
 */

import type { Client, MessageReaction, PartialMessageReaction, User, PartialUser } from "discord.js";
import { applyReactRules } from "@/features/autoroles/service";
import { createLogger } from "@/core/logger";

const log = createLogger("autoroles:react");

function emojiKey(reaction: MessageReaction | PartialMessageReaction): string {
  return reaction.emoji.id
    ? `${reaction.emoji.name}:${reaction.emoji.id}`
    : (reaction.emoji.name ?? "?");
}

export function register(client: Client): void {
  client.on(
    "messageReactionAdd",
    async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
      try {
        const guild = reaction.message.guild;
        if (!guild || user.bot) return;

        const member = await guild.members.fetch(user.id).catch(() => null);
        if (!member) return;

        await applyReactRules(guild, member, reaction.message.id, emojiKey(reaction));
      } catch (err) {
        log.error("Error in messageReactionAdd autorole handler", err);
      }
    },
  );
}
