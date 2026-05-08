import type { ChatInputCommandInteraction } from "discord.js";
import { Feature, SlashCommand } from "@/framework";

@Feature({ id: "hello", intents: ["Guilds"] })
export class HelloFeature {
  @SlashCommand({ name: "hello", description: "Say hello" })
  async hello(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.reply("Hello from tx-v2.");
  }
}
