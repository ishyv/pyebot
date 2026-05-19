import type { ButtonInteraction, StringSelectMenuInteraction } from "discord.js";
import { Handle } from "@/framework/decorators";
import type { Ctx } from "@/framework/types";
import { handleCombatMove } from "./handlers/combatMove";
import { handleEquipSelect } from "./handlers/equip";
import { handleExpeditionButton } from "./handlers/expedition";
import { handleFightAccept } from "./handlers/fightAccept";
import { handleOnboard } from "./handlers/onboard";

export default class RpgHandlers {
  @Handle("fight_accept:")
  async onFightAccept(
    interaction: ButtonInteraction | StringSelectMenuInteraction,
    _ctx: Ctx,
  ): Promise<void> {
    await handleFightAccept(interaction as ButtonInteraction);
  }

  @Handle("fight_move:")
  async onFightMove(
    interaction: ButtonInteraction | StringSelectMenuInteraction,
    _ctx: Ctx,
  ): Promise<void> {
    await handleCombatMove(interaction as ButtonInteraction);
  }

  @Handle("equip:")
  async onEquipSelect(
    interaction: ButtonInteraction | StringSelectMenuInteraction,
    ctx: Ctx,
  ): Promise<void> {
    await handleEquipSelect(interaction as StringSelectMenuInteraction, ctx);
  }

  @Handle("rpg:onboard:")
  async onOnboard(
    interaction: ButtonInteraction | StringSelectMenuInteraction,
    ctx: Ctx,
  ): Promise<void> {
    await handleOnboard(interaction as ButtonInteraction, ctx);
  }

  @Handle("expedition:")
  async onExpedition(
    interaction: ButtonInteraction | StringSelectMenuInteraction,
    ctx: Ctx,
  ): Promise<void> {
    await handleExpeditionButton(interaction as ButtonInteraction, ctx);
  }
}
