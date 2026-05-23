import { ErrResult, OkResult } from "@/core/result";
import {
  getRpgContentSnapshot,
  type RpgContentSnapshot,
  reloadRpgContent as reloadRuntimeRpgContent,
  saveRpgContent as saveRuntimeRpgContent,
} from "@/features/rpg/content/runtime";
import type { BotBridge } from "../bridge-types";
import type { BridgeEmit } from "./shared";

/** Creates RPG content bridge methods for the runtime content snapshot. */
export function createRpgContentBridge(
  emit: BridgeEmit,
): Pick<BotBridge, "getRpgContent" | "saveRpgContent" | "reloadRpgContent"> {
  return {
    async getRpgContent() {
      return OkResult(getRpgContentSnapshot());
    },

    async saveRpgContent(snapshot) {
      const result = await saveRuntimeRpgContent(snapshot as unknown as RpgContentSnapshot);
      if (result.isErr()) return ErrResult(result.error);
      emit({
        type: "rpg_content_reloaded",
        guildId: "global",
        detail: "RPG content reloaded",
        timestamp: Date.now(),
      });
      return OkResult(result.unwrap());
    },

    async reloadRpgContent() {
      const result = await reloadRuntimeRpgContent();
      if (result.isErr()) return ErrResult(result.error);
      emit({
        type: "rpg_content_reloaded",
        guildId: "global",
        detail: "RPG content reloaded",
        timestamp: Date.now(),
      });
      return OkResult(result.unwrap());
    },
  };
}
