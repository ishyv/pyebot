import type { ButtonInteraction, StringSelectMenuInteraction } from "discord.js";
import { Handle } from "@/framework/decorators";
import type { Ctx } from "@/framework/types";
import { handleTycoonComponent } from "./handlers/dashboard";

export default class TycoonHandlers {
  @Handle("tycoon:")
  async onTycoon(
    interaction: ButtonInteraction | StringSelectMenuInteraction,
    ctx: Ctx,
  ): Promise<void> {
    await handleTycoonComponent(interaction, ctx);
  }
}
