import {
  buildCapabilityGraph,
  type CapabilityGraphInput,
  toGuideGraphSnapshot,
} from "@/core/capabilityGraph";
import type { GuideGraphSnapshot } from "@/webapp/bridge-types";

/**
 * Compatibility wrapper for the dashboard guide.
 *
 * The canonical graph now lives in `core/capabilityGraph`; the webapp guide
 * receives the bridge-safe projection so loader/config internals stay server
 * side.
 */
export function buildGuideGraph(input: CapabilityGraphInput): GuideGraphSnapshot {
  return toGuideGraphSnapshot(buildCapabilityGraph(input));
}
