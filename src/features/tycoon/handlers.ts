/**
 * Tycoon component handlers — a flat registration list. The old single
 * @Handle("tycoon:") customId switch is now one typed route per surface (see
 * ./routes.ts); each handler receives a narrowed interaction (button / select /
 * modal) and decoded args.
 */
import { defineHandlers, routeHandlers } from "@/framework";
import {
  handleCollect,
  handleDoAutomate,
  handleDoCharter,
  handleDoUpgrade,
  handleExchangeButton,
  handleExchangeSubmit,
  handleExpandSelect,
  handleModeSelect,
  handleRefresh,
  handleUpgradeSelect,
} from "./handlers/dashboard";
import { tycoonRoutes } from "./routes";

export default defineHandlers([
  ...routeHandlers(tycoonRoutes, {
    "do-charter": (interaction, args, ctx) => handleDoCharter(interaction, args, ctx),
    "do-automate": (interaction, args, ctx) => handleDoAutomate(interaction, args, ctx),
    "do-upgrade": (interaction, args, ctx) => handleDoUpgrade(interaction, args, ctx),
    collect: (interaction, args, ctx) => handleCollect(interaction, args, ctx),
    refresh: (interaction, args, ctx) => handleRefresh(interaction, args, ctx),
    exchange: (interaction, args, ctx) => handleExchangeButton(interaction, args, ctx),
    upgrade: (interaction, args, ctx) => handleUpgradeSelect(interaction, args, ctx),
    expand: (interaction, args, ctx) => handleExpandSelect(interaction, args, ctx),
    mode: (interaction, args, ctx) => handleModeSelect(interaction, args, ctx),
    "exchange-submit": (interaction, args, ctx) => handleExchangeSubmit(interaction, args, ctx),
  }),
]);
