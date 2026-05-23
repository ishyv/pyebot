import { ErrResult, OkResult } from "@/core/result";
import { saveAutomodSettings } from "@/features/adminPanels/configMutations";
import type { BotBridge } from "../bridge-types";
import type { BridgeEmit } from "./shared";

/** Creates AutoMod settings bridge methods backed by guild config mutation helpers. */
export function createAutomodBridge(emit: BridgeEmit): Pick<BotBridge, "saveAutomod"> {
  return {
    async saveAutomod(guildId, patch, actorId) {
      const result = await saveAutomodSettings(guildId, patch);
      if (result.isErr()) return ErrResult(result.error);
      emit({
        type: "config_changed",
        guildId,
        actorId: actorId ?? undefined,
        detail: "Updated automod",
        timestamp: Date.now(),
      });
      return OkResult(undefined);
    },
  };
}
