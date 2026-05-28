import { type ResolveStatus, toastStore } from "@hyvnt/hyvui";
import type { ActionResult, SubmitFunction } from "@sveltejs/kit";

/**
 * Shared form-submission helpers for the dashboard's config pages.
 *
 * Every config form is a SvelteKit form action invoked through `use:enhance`.
 * Before this helper, each page reimplemented the same callback: flip a saving
 * flag, flash the form border via `use:resolve`, and push a toast. Crucially the
 * old copies discarded the server's real error and toasted a generic
 * "save failed, retry". `enhanceSave` keeps the shared shape but surfaces the
 * actual message and the offending field so pages can render it inline.
 */

export interface FieldError {
  /** Form field name the error belongs to (matches the `name=` on the input). */
  field?: string;
  /** Human-readable message from the server parser. */
  message: string;
}

interface SaveArgs {
  /** Toggle the per-section saving flag (drives the button label + disabled). */
  setSaving: (saving: boolean) => void;
  /** Toast message shown on success. */
  okMessage: string;
  /** Returns the section's `use:resolve` action so the border can flash ok/fail. */
  resolve?: () => { trigger: (status: ResolveStatus) => void } | undefined;
  /** Receives the parsed error on failure, or null on success (clears it). */
  setError?: (error: FieldError | null) => void;
  /** Optional hook for forms that need the raw result (e.g. the image-test panel). */
  onResult?: (result: ActionResult) => void;
  /** Passed through to SvelteKit's `update`. Defaults to false (keep field values). */
  reset?: boolean;
}

/**
 * Pure mapping from a SvelteKit action result to the UI outcome. Kept separate
 * from `enhanceSave` so the error-extraction logic is unit-testable without a
 * DOM or a live form.
 */
export function interpretSaveResult(
  result: { type: string; data?: unknown },
  okMessage: string,
): { ok: boolean; message: string; field?: string } {
  if (result.type === "success") return { ok: true, message: okMessage };
  const data =
    result.type === "failure"
      ? (result.data as { error?: unknown; field?: unknown } | undefined)
      : undefined;
  const message = typeof data?.error === "string" ? data.error : "save failed, retry";
  const field = typeof data?.field === "string" ? data.field : undefined;
  return { ok: false, message, field };
}

/**
 * Builds the `use:enhance` submit function for a config-section form.
 *
 * @example
 * <form use:enhance={enhanceSave({
 *   setSaving: (v) => (savingDaily = v),
 *   resolve: () => dailyResolve,
 *   okMessage: "daily saved",
 *   setError: (e) => (dailyError = e),
 * })}>
 */
export function enhanceSave(args: SaveArgs): SubmitFunction {
  return () => {
    args.setSaving(true);
    return async ({ result, update }) => {
      args.setSaving(false);
      const outcome = interpretSaveResult(result, args.okMessage);
      args.resolve?.()?.trigger(outcome.ok ? "ok" : "fail");
      args.setError?.(outcome.ok ? null : { field: outcome.field, message: outcome.message });
      toastStore.push(outcome.message, outcome.ok ? "ok" : "fail");
      args.onResult?.(result);
      await update({ reset: args.reset ?? false });
    };
  };
}

/**
 * Shallow per-key comparison for dirty-state tracking. Pages snapshot their
 * loaded values once (via `untrack`) and compare the live form state against
 * that snapshot to show an "unsaved changes" marker.
 */
export function isDirty<T extends Record<string, unknown>>(current: T, initial: T): boolean {
  for (const key of Object.keys(initial)) {
    if (current[key] !== initial[key]) return true;
  }
  return false;
}
