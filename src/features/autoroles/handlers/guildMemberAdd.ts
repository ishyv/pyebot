/**
 * guildMemberAdd handler — applies onJoin autorole rules.
 */

import type { Client } from "discord.js";
import { applyJoinRules } from "@/features/autoroles/service";
import { createLogger } from "@/core/logger";

const log = createLogger("autoroles:join");

export function register(client: Client): void {
  client.on("guildMemberAdd", async (member) => {
    try {
      await applyJoinRules(member.guild, member);
    } catch (err) {
      log.error("Error in guildMemberAdd autorole handler", err);
    }
  });
}
