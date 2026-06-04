/**
 * RPG component handlers — a flat registration list. Each route declares its
 * component kind (see ./routes.ts), so the interaction type is narrowed for
 * each handler (button vs select) with no casts.
 */
import { defineHandlers, routeHandlers } from "@/framework";
import { handleCombatMove } from "./handlers/combatMove";
import { handleEquipSelect } from "./handlers/equip";
import {
  handleExpeditionDeeper,
  handleExpeditionGather,
  handleExpeditionLeave,
  handleExpeditionStart,
} from "./handlers/expedition";
import { handleFightAccept } from "./handlers/fightAccept";
import { handleOnboard } from "./handlers/onboard";
import { equipRoutes, expeditionRoutes, fightRoutes, onboardRoutes } from "./routes";

export default defineHandlers([
  ...routeHandlers(fightRoutes, {
    accept: (interaction, args, ctx) => handleFightAccept(interaction, args, ctx),
    move: (interaction, args, ctx) => handleCombatMove(interaction, args, ctx),
  }),
  ...routeHandlers(equipRoutes, {
    select: (interaction, _args, ctx) => handleEquipSelect(interaction, ctx),
  }),
  ...routeHandlers(onboardRoutes, {
    onboard: (interaction, args, ctx) => handleOnboard(interaction, args, ctx),
  }),
  ...routeHandlers(expeditionRoutes, {
    start: (interaction, args, ctx) => handleExpeditionStart(interaction, args, ctx),
    gather: (interaction, args, ctx) => handleExpeditionGather(interaction, args, ctx),
    deeper: (interaction, args, ctx) => handleExpeditionDeeper(interaction, args, ctx),
    leave: (interaction) => handleExpeditionLeave(interaction),
  }),
]);
