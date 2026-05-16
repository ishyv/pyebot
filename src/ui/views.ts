/**
 * Compositional view helpers built on the V2 primitives.
 *
 * Why this file exists:
 * - Three patterns recur in every feature: confirm-then-act for destructive
 *   operations, the empty-list state, and paginated lists. Each ships here as
 *   a single function that returns a `v2Message` payload. Features compose
 *   their own views from these plus the lower-level `v2` primitives.
 *
 * Boundary:
 * - Helpers return `v2Message`-shaped objects. Callers pass the result straight
 *   to `interaction.reply`/`editReply`/`update` or `channel.send`. No
 *   interaction side effects happen inside these helpers — they are pure
 *   renders.
 */

import { ButtonBuilder, ButtonStyle, SectionBuilder, type TextDisplayBuilder } from "discord.js";
import { container, row, separator, text, v2Message } from "./v2";

/** Result type shared by helpers: a fully-baked V2 message payload. */
export type V2Payload = ReturnType<typeof v2Message>;

interface ConfirmDangerArgs {
  /** Prompt rendered above the buttons; supports Discord markdown. */
  readonly prompt: string;
  /** Label of the destructive button (e.g. "Ban", "Delete case"). */
  readonly dangerLabel: string;
  /** Optional label for the cancel button. Defaults to "Cancel". */
  readonly cancelLabel?: string;
  /**
   * Caller-owned `customId` prefix. The helper appends `:confirm` and `:cancel`
   * so a single click handler can branch on the suffix. Must be ≤ 92 chars to
   * leave room for the suffix within Discord's 100-char custom_id limit.
   */
  readonly customIdPrefix: string;
}

/**
 * Renders a danger-confirmation card: red Container with prompt + two buttons.
 *
 * The destructive button uses `Danger` style and sits on the right; cancel is
 * `Secondary` on the left, matching OS dialog conventions. Both customIds are
 * derived from `customIdPrefix` so the calling feature handles them in one
 * place (e.g. `"mod:ban:U123" + ":confirm"` / `":cancel"`).
 */
export function confirmDanger(args: ConfirmDangerArgs): V2Payload {
  if (args.customIdPrefix.length > 92) {
    throw new Error(
      `confirmDanger: customIdPrefix length ${args.customIdPrefix.length} > 92 leaves no room for suffix.`,
    );
  }
  const cancel = new ButtonBuilder()
    .setCustomId(`${args.customIdPrefix}:cancel`)
    .setStyle(ButtonStyle.Secondary)
    .setLabel(args.cancelLabel ?? "Cancel");
  const confirm = new ButtonBuilder()
    .setCustomId(`${args.customIdPrefix}:confirm`)
    .setStyle(ButtonStyle.Danger)
    .setLabel(args.dangerLabel);
  return v2Message(container("danger", text(args.prompt), row(cancel, confirm)));
}

interface EmptyStateArgs {
  readonly title: string;
  readonly body: string;
  /** Optional call-to-action button. When omitted, the card has no buttons. */
  readonly primaryCta?: { label: string; customId: string };
}

/**
 * Renders an explicit empty-state card. Use this anywhere a feature would
 * otherwise show "nothing to display" — modqueue with no pending items,
 * appeals queue when empty, market listing with no offers. The CTA, when
 * present, gives users a direct next action instead of a dead end.
 */
export function emptyState(args: EmptyStateArgs): V2Payload {
  const body = container("mute", text(`## ${args.title}`), separator("sm"), text(args.body));
  if (args.primaryCta) {
    body.addActionRowComponents(
      row(
        new ButtonBuilder()
          .setCustomId(args.primaryCta.customId)
          .setStyle(ButtonStyle.Primary)
          .setLabel(args.primaryCta.label),
      ),
    );
  }
  return v2Message(body);
}

interface PaginateArgs<T> {
  /** Items to display on the current page; slicing is the caller's job. */
  readonly items: readonly T[];
  /** Zero-based current page index. */
  readonly page: number;
  /** Total number of pages, ≥ 1. */
  readonly pageCount: number;
  /**
   * Maps one item to a Section or TextDisplay row. The narrow return type is
   * intentional: lists either show a Section per row (with optional avatar +
   * action button) or plain text. Other layouts compose `v2Message` directly.
   */
  readonly renderItem: (item: T, indexOnPage: number) => SectionBuilder | TextDisplayBuilder;
  /**
   * customId prefix for `prev`/`next` buttons. The helper appends `:prev` and
   * `:next`. The caller's handler must decode and re-render with the new page.
   */
  readonly customIdPrefix: string;
  /** Optional title rendered above the list as a heading TextDisplay. */
  readonly title?: string;
}

/**
 * Renders a paginated list inside a single Container. Page navigation lives in
 * one action row at the bottom (`◀`, `Page n/m`, `▶`). The middle button is
 * disabled and acts as a position indicator.
 *
 * Page state lives entirely in the customId-encoded handler call; this helper
 * has no concept of session storage.
 */
export function paginate<T>(args: PaginateArgs<T>): V2Payload {
  const c = container("info");
  if (args.title) c.addTextDisplayComponents(text(`## ${args.title}`));
  for (const [i, item] of args.items.entries()) {
    const rendered = args.renderItem(item, i);
    // The renderItem return type is narrow on purpose; dispatch is a one-liner.
    if (rendered instanceof SectionBuilder) c.addSectionComponents(rendered);
    else c.addTextDisplayComponents(rendered);
  }
  const prev = new ButtonBuilder()
    .setCustomId(`${args.customIdPrefix}:prev`)
    .setStyle(ButtonStyle.Secondary)
    .setLabel("◀")
    .setDisabled(args.page <= 0);
  const indicator = new ButtonBuilder()
    .setCustomId(`${args.customIdPrefix}:noop`)
    .setStyle(ButtonStyle.Secondary)
    .setLabel(`Page ${args.page + 1}/${Math.max(1, args.pageCount)}`)
    .setDisabled(true);
  const next = new ButtonBuilder()
    .setCustomId(`${args.customIdPrefix}:next`)
    .setStyle(ButtonStyle.Secondary)
    .setLabel("▶")
    .setDisabled(args.page >= args.pageCount - 1);
  c.addActionRowComponents(row(prev, indicator, next));
  return v2Message(c);
}
