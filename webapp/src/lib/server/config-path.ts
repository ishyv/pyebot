/**
 * Read a nested value from a plain JSON object using a dotted path.
 * Returns `undefined` when any intermediate key is missing.
 */
export function getConfigPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((cur, seg) => {
    if (cur === null || typeof cur !== "object") return undefined;
    return (cur as Record<string, unknown>)[seg];
  }, obj);
}
