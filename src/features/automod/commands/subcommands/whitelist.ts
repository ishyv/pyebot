import type { ChatInputCommandInteraction } from "discord.js";
import type { CommandContext } from "@/core/feature";
import { handleDbError } from "@/core/responseHelpers";
import { getGuild } from "@/db/repositories/guilds";
import { saveAutomodSettings } from "@/features/adminPanels/configMutations";
import { configUpdateMessage } from "@/ui/v2";

/** Handles `/automod whitelist` domain add/remove operations. */
export async function handleWhitelist(
  interaction: ChatInputCommandInteraction,
  ctx: CommandContext,
): Promise<void> {
  await ctx.respond.defer({ visibility: "ephemeral" });

  const action = interaction.options.getString("action", true);
  const domain = interaction.options.getString("domain", true).toLowerCase().trim();

  const guildResult = await getGuild(ctx.guildId);
  if (await handleDbError(guildResult, ctx, "Failed to load guild config.")) return;

  const current = guildResult.unwrap()?.automod.domainWhitelist.domains ?? [];
  let updated: string[];
  if (action === "add") {
    if (current.includes(domain)) {
      await ctx.respond.send({ content: `\`${domain}\` is already whitelisted.` });
      return;
    }
    updated = [...current, domain];
  } else {
    updated = current.filter((d) => d !== domain);
    if (updated.length === current.length) {
      await ctx.respond.send({ content: `\`${domain}\` is not in the whitelist.` });
      return;
    }
  }

  const result = await saveAutomodSettings(ctx.guildId, {
    domainWhitelist: { enabled: true, domains: updated },
  });
  if (await handleDbError(result, ctx, "Could not update domain whitelist.")) return;

  await ctx.respond.send(
    configUpdateMessage(
      action === "add" ? "ok" : "warn",
      action === "add" ? "Domain Added" : "Domain Removed",
      `\`${domain}\` has been ${action === "add" ? "added to" : "removed from"} the whitelist.\n` +
        `**Total Entries:** ${updated.length}`,
    ),
  );
}
