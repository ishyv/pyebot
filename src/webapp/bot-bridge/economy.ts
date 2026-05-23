import { ErrResult, OkResult } from "@/core/result";
import {
  saveEconomySettings,
  saveEconomyTaxSettings,
} from "@/features/adminPanels/configMutations";
import type { BotBridge } from "../bridge-types";
import type { BridgeEmit } from "./shared";

/** Creates economy settings bridge methods backed by the economy component stores. */
export function createEconomyBridge(
  emit: BridgeEmit,
): Pick<BotBridge, "saveEconomy" | "saveEconomyTax"> {
  return {
    async saveEconomy(guildId, patch, actorId) {
      const result = await saveEconomySettings(guildId, patch);
      if (result.isErr()) return ErrResult(result.error);
      emit({
        type: "config_changed",
        guildId,
        actorId: actorId ?? undefined,
        detail: "Updated economy",
        timestamp: Date.now(),
      });
      return OkResult(undefined);
    },

    async saveEconomyTax(guildId, patch, actorId) {
      const result = await saveEconomyTaxSettings(guildId, patch);
      if (result.isErr()) return ErrResult(result.error);
      emit({
        type: "config_changed",
        guildId,
        actorId: actorId ?? undefined,
        detail: "Updated economy tax",
        timestamp: Date.now(),
      });
      return OkResult(undefined);
    },
  };
}
