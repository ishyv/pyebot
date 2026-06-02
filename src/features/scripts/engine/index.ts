/**
 * Public surface of the scripting engine.
 *
 * Other features (currently `embeds`) depend only on this barrel, never on the
 * engine internals. Keep the export list small and intentional.
 */
export { type RunScriptOptions, runScript, type ScriptContext, type ScriptOutput } from "./runner";
