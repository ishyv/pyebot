/**
 * RPG gathering action + profession types.
 *
 * Co-located because both are tiny, both gate the same UX (which buttons /
 * commands the user can use), and both come from the same conceptual domain:
 * "what kind of gathering are we doing?"
 */

export type GatherAction = "mine" | "forest";

export type Profession = "miner" | "lumber";

/**
 * Default gathering action for a profession. Used when a command did not
 * receive an explicit type argument and we need to pick the user's natural
 * action from their starter-kit profession.
 */
export function defaultActionForProfession(profession: Profession): GatherAction {
  return profession === "miner" ? "mine" : "forest";
}

/** Untrusted-string boundary helper. Narrows arbitrary input to a GatherAction. */
export function parseGatherAction(value: string | null | undefined): GatherAction | null {
  return value === "mine" || value === "forest" ? value : null;
}
