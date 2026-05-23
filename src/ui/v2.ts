/**
 * Components V2 primitives.
 *
 * Why this layer exists:
 * - discord.js exposes V2 builders directly (`ContainerBuilder`, `SectionBuilder`,
 *   …), but each call site would otherwise re-encode the same conventions:
 *   the `IsComponentsV2` message flag, the 4000-char text budget, the 40-component
 *   cap, the "section accessory is exactly one button OR thumbnail" rule.
 * - This file makes those conventions one-liners and turns the invariants into
 *   throw-on-violation checks in `v2Message`. A view function never returns a
 *   payload that Discord will reject silently.
 *
 * Non-goals:
 * - These helpers do NOT wrap every discord.js method. Where a builder already
 *   reads cleanly (`new ButtonBuilder().setStyle(...).setLabel(...)`) callers
 *   use it directly. Helpers exist only where they encode a convention.
 *
 * Boundary:
 * - Outputs are passed to `interaction.reply`, `interaction.editReply`,
 *   `interaction.update`, `channel.send`, etc. Discord enforces the same limits
 *   on the wire; the pre-flight check in `v2Message` exists so the failure mode
 *   is a clear stack trace at the view, not a cryptic 400 at send time.
 */

import {
  ActionRowBuilder,
  type ButtonBuilder,
  type ChannelSelectMenuBuilder,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  type MentionableSelectMenuBuilder,
  MessageFlags,
  type RoleSelectMenuBuilder,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  type StringSelectMenuBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
  type UserSelectMenuBuilder,
} from "discord.js";
import { GLYPHS } from "./glyphs";
import { ACCENT, type AccentKey } from "./theme";

/** Discord's hard limit on total components in one message (V2). */
export const V2_COMPONENT_LIMIT = 40;

/** Discord's hard limit on summed TextDisplay characters per message. */
export const V2_TEXT_BUDGET = 4000;

/** Discord's hard limit on top-level components per message. */
export const V2_TOP_LEVEL_LIMIT = 10;

/**
 * A top-level component allowed at the root of a V2 message.
 *
 * Note: `ActionRowBuilder` is parameterised on its row-content type; we widen
 * to `ActionRowBuilder<any>` here because callers compose rows with any of the
 * supported message-actionrow children (buttons, selects).
 */
export type V2Top =
  | ContainerBuilder
  | SectionBuilder
  | TextDisplayBuilder
  | MediaGalleryBuilder
  | SeparatorBuilder
  // biome-ignore lint/suspicious/noExplicitAny: ActionRow's generic is structural; widening is intentional at this boundary.
  | ActionRowBuilder<any>;

/** Children allowed inside a `ContainerBuilder`. Mirrors the discord.js shape. */
export type ContainerChild =
  | SectionBuilder
  | TextDisplayBuilder
  | MediaGalleryBuilder
  | SeparatorBuilder
  // biome-ignore lint/suspicious/noExplicitAny: see V2Top doc comment.
  | ActionRowBuilder<any>;

/** Components allowed as children of an action row inside a V2 message. */
export type RowChild =
  | ButtonBuilder
  | StringSelectMenuBuilder
  | ChannelSelectMenuBuilder
  | RoleSelectMenuBuilder
  | UserSelectMenuBuilder
  | MentionableSelectMenuBuilder;

/**
 * Wraps one or more top-level components into a V2 message payload.
 *
 * - Sets `MessageFlags.IsComponentsV2`. Callers must NOT add `content`, `embeds`,
 *   `poll`, or `stickers` to the resulting object — Discord rejects V2 payloads
 *   that carry any of those fields.
 * - Enforces the three V2 limits up front: top-level count, total component
 *   count, and summed TextDisplay characters. Violations throw at construction
 *   time, surfacing the failure at the view that produced the bad tree.
 *
 * Returned shape is intentionally a plain object so it can be passed to either
 * `interaction.reply`/`editReply`/`update` or `channel.send` without further
 * coercion.
 */
export function v2Message(...children: V2Top[]): {
  components: V2Top[];
  flags: MessageFlags.IsComponentsV2;
} {
  if (children.length === 0) {
    throw new Error("v2Message requires at least one top-level component.");
  }
  if (children.length > V2_TOP_LEVEL_LIMIT) {
    throw new Error(
      `v2Message: ${children.length} top-level components exceeds limit ${V2_TOP_LEVEL_LIMIT}.`,
    );
  }
  let totalComponents = 0;
  let totalChars = 0;
  for (const child of children) {
    const counts = walkCounts(child);
    totalComponents += counts.components;
    totalChars += counts.chars;
  }
  if (totalComponents > V2_COMPONENT_LIMIT) {
    throw new Error(
      `v2Message: ${totalComponents} components exceeds limit ${V2_COMPONENT_LIMIT}.`,
    );
  }
  if (totalChars > V2_TEXT_BUDGET) {
    throw new Error(`v2Message: ${totalChars} text chars exceeds budget ${V2_TEXT_BUDGET}.`);
  }
  return { components: children, flags: MessageFlags.IsComponentsV2 };
}

/** Standard success response for short command confirmations. */
export function successMessage(title: string, body: string) {
  return v2Message(container("ok", text(`## ${title}\n${body}`)));
}

/** Standard failure response for command/database errors shown to users. */
export function failureMessage(body: string, title = "Failed") {
  return v2Message(container("danger", text(`## ${title}\n${body}`)));
}

/**
 * Standard config-update response with optional detail and footer blocks.
 * Kept thin so feature commands still own their wording.
 */
export function configUpdateMessage(
  accent: AccentKey,
  title: string,
  body: string,
  details?: string,
  footer?: string,
) {
  return v2Message(
    container(
      accent,
      text(`## ${title}\n${body}`),
      ...(details ? [separator("sm"), text(details)] : []),
      ...(footer ? [separator("sm"), text(footer)] : []),
    ),
  );
}

/**
 * Builds a `ContainerBuilder` with the given accent and children.
 *
 * The accent key resolves to a hex colour from `ACCENT`. Use `info` for default
 * neutral framing; use `danger`/`warn` only when the view actually represents
 * the corresponding severity, so colour stays meaningful.
 */
export function container(accent: AccentKey, ...children: ContainerChild[]): ContainerBuilder {
  const c = new ContainerBuilder().setAccentColor(ACCENT[accent]);
  for (const child of children) {
    if (child instanceof SectionBuilder) c.addSectionComponents(child);
    else if (child instanceof TextDisplayBuilder) c.addTextDisplayComponents(child);
    else if (child instanceof MediaGalleryBuilder) c.addMediaGalleryComponents(child);
    else if (child instanceof SeparatorBuilder) c.addSeparatorComponents(child);
    else if (child instanceof ActionRowBuilder) c.addActionRowComponents(child);
  }
  return c;
}

/**
 * Builds a Section: one block of text plus exactly one accessory (button or
 * thumbnail). The accessory sits next to the text rather than below it — this
 * is the V2 unlock that makes lists feel app-like (Approve button beside the
 * row it acts on, avatar beside the user blurb).
 */
export function section(
  textContent: string,
  accessory: ButtonBuilder | ThumbnailBuilder,
): SectionBuilder {
  const s = new SectionBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(textContent),
  );
  // SectionBuilder exposes two setters; pick by accessory class.
  if (accessory instanceof ThumbnailBuilder) {
    s.setThumbnailAccessory(accessory);
  } else {
    s.setButtonAccessory(accessory);
  }
  return s;
}

/** Plain `TextDisplayBuilder` wrapper; trivial but keeps view files readable. */
export function text(content: string): TextDisplayBuilder {
  return new TextDisplayBuilder().setContent(content);
}

/**
 * Builds a thumbnail accessory for a section. `alt` is optional but should be
 * set whenever the image conveys information (avatar of the actioned user, etc.)
 * for screen-reader users and for Discord's accessibility tooling.
 */
export function thumb(url: string, alt?: string): ThumbnailBuilder {
  const t = new ThumbnailBuilder().setURL(url);
  if (alt) t.setDescription(alt);
  return t;
}

/**
 * Visual rhythm between blocks. `"sm"` is a tight gap; `"lg"` is a divider line.
 * Default is small spacing without a visible divider.
 */
export function separator(spacing: "sm" | "lg" = "sm"): SeparatorBuilder {
  const sep = new SeparatorBuilder();
  sep.setSpacing(spacing === "lg" ? SeparatorSpacingSize.Large : SeparatorSpacingSize.Small);
  return sep;
}

/**
 * Builds an action row. Enforces Discord's 5-children-per-row cap so the
 * failure surfaces at the view instead of inside the API call.
 */
export function row<T extends RowChild>(...children: T[]): ActionRowBuilder<T> {
  if (children.length === 0 || children.length > 5) {
    throw new Error(`row: ${children.length} children; valid range is 1..5.`);
  }
  return new ActionRowBuilder<T>().addComponents(...children);
}

/**
 * Renders a breadcrumb line as a `TextDisplay`, e.g.
 * `breadcrumb("Server", "Settings", "Roles")` → `Server › Settings › Roles`.
 *
 * Multi-step views (wizards, paginated lists, admin panels) use this at the
 * top of their container so the user always knows where they are.
 */
export function breadcrumb(...crumbs: string[]): TextDisplayBuilder {
  if (crumbs.length === 0) throw new Error("breadcrumb: at least one crumb required.");
  return text(`-# ${crumbs.join(" › ")}`);
}

/**
 * Renders a 10-cell progress bar using `GLYPHS.bar.full` / `.empty`.
 *
 * `value` and `max` are clamped: negative `value` → 0 cells, `value >= max` →
 * 10 cells. `max <= 0` yields an empty bar rather than throwing, because views
 * sometimes render a "no data yet" state before any progress accumulates.
 */
export function progress(value: number, max: number): TextDisplayBuilder {
  const cells = 10;
  const filled = max > 0 ? Math.max(0, Math.min(cells, Math.round((value / max) * cells))) : 0;
  return text(GLYPHS.bar.full.repeat(filled) + GLYPHS.bar.empty.repeat(cells - filled));
}

/**
 * Convenience: a `MediaGalleryItem` with a URL and required alt text.
 *
 * Why alt is required here even though Discord allows it to be empty:
 * - Most galleries we ship are decorative-only by accident; making `alt`
 *   required at the helper boundary forces the author to think about it.
 */
export function galleryItem(url: string, alt: string, spoiler = false): MediaGalleryItemBuilder {
  const item = new MediaGalleryItemBuilder().setURL(url).setDescription(alt);
  if (spoiler) item.setSpoiler(true);
  return item;
}

/** Builds a `MediaGallery` from 1..10 items. */
export function gallery(...items: MediaGalleryItemBuilder[]): MediaGalleryBuilder {
  if (items.length === 0 || items.length > 10) {
    throw new Error(`gallery: ${items.length} items; valid range is 1..10.`);
  }
  return new MediaGalleryBuilder().addItems(...items);
}

// ---------------------------------------------------------------------------
// Internal: recursive component/char counter used by v2Message limit checks.
// Kept private; tests exercise it through v2Message's throw paths.
// ---------------------------------------------------------------------------

interface Counts {
  components: number;
  chars: number;
}

function walkCounts(node: V2Top | ContainerChild | RowChild): Counts {
  // Each node counts as 1 toward the component cap; text contribution is read
  // from the builder's own .data field, populated by the .setContent setter.
  let components = 1;
  let chars = 0;
  if (node instanceof TextDisplayBuilder) {
    chars += (node.data.content ?? "").length;
  } else if (node instanceof SectionBuilder) {
    for (const child of node.components) {
      if (child instanceof TextDisplayBuilder) {
        chars += (child.data.content ?? "").length;
        components += 1;
      }
    }
    if (node.accessory) components += 1;
  } else if (node instanceof ContainerBuilder) {
    for (const child of node.components) {
      const sub = walkCounts(child as ContainerChild);
      components += sub.components;
      chars += sub.chars;
    }
  } else if (node instanceof ActionRowBuilder) {
    // Each row counts as itself; its children also count individually.
    components += node.components.length;
  } else if (node instanceof MediaGalleryBuilder) {
    components += node.items.length;
  }
  return { components, chars };
}
