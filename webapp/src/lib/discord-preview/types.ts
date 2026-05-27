/**
 * Raw Discord "Components V2" message-payload JSON, as produced by discord.js
 * builders' `.toJSON()`. This is what the bot emits and what the playground
 * accepts when you paste a payload.
 *
 * Only the component types the bot actually uses are modeled; anything else is
 * tolerated and rendered as a labeled stub by the parser.
 *
 * Discord component type numbers:
 *   1 action row · 2 button · 3 string select · 9 section · 10 text display
 *   11 thumbnail · 12 media gallery · 14 separator · 17 container
 */

export interface RawPayload {
  /** Message flags bitfield; IsComponentsV2 is 1 << 15. Not required to render. */
  readonly flags?: number;
  readonly components?: readonly RawComponent[];
}

export type RawComponent =
  | RawContainer
  | RawTextDisplay
  | RawSeparator
  | RawSection
  | RawActionRow
  | RawButton
  | RawStringSelect
  | RawThumbnail
  | RawMediaGallery
  | { readonly type: number; readonly [k: string]: unknown };

export interface RawContainer {
  readonly type: 17;
  readonly accent_color?: number | null;
  readonly components?: readonly RawComponent[];
}

export interface RawTextDisplay {
  readonly type: 10;
  readonly content?: string;
}

export interface RawSeparator {
  readonly type: 14;
  readonly divider?: boolean;
  /** 1 = small, 2 = large. */
  readonly spacing?: number;
}

export interface RawSection {
  readonly type: 9;
  readonly components?: readonly RawComponent[];
  readonly accessory?: RawButton | RawThumbnail;
}

export interface RawActionRow {
  readonly type: 1;
  readonly components?: readonly RawComponent[];
}

export interface RawButton {
  readonly type: 2;
  /** 1 primary · 2 secondary · 3 success · 4 danger · 5 link. */
  readonly style?: number;
  readonly label?: string;
  readonly emoji?: { readonly name?: string } | null;
  readonly custom_id?: string;
  readonly url?: string;
  readonly disabled?: boolean;
}

export interface RawStringSelect {
  readonly type: 3;
  readonly custom_id?: string;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly options?: readonly {
    readonly label?: string;
    readonly value?: string;
    readonly description?: string;
    readonly emoji?: { readonly name?: string } | null;
  }[];
}

export interface RawThumbnail {
  readonly type: 11;
  readonly media?: { readonly url?: string };
  readonly description?: string | null;
}

export interface RawMediaGallery {
  readonly type: 12;
  readonly items?: readonly {
    readonly media?: { readonly url?: string };
    readonly description?: string | null;
  }[];
}

// ── Normalized view model the Svelte renderer walks (presentation-ready) ──────

export type ButtonVariant = "primary" | "secondary" | "success" | "danger" | "link";

export interface PreviewButton {
  readonly label: string;
  readonly variant: ButtonVariant;
  readonly disabled: boolean;
  readonly url: string | null;
}

export interface PreviewThumbnail {
  readonly url: string;
  readonly alt: string | null;
}

export type PreviewNode =
  | { readonly kind: "container"; readonly accent: string | null; readonly children: PreviewNode[] }
  | { readonly kind: "text"; readonly content: string }
  | { readonly kind: "separator"; readonly divider: boolean; readonly large: boolean }
  | {
      readonly kind: "section";
      readonly children: PreviewNode[];
      readonly accessory: PreviewButton | PreviewThumbnail | null;
    }
  | { readonly kind: "actionRow"; readonly children: PreviewNode[] }
  | ({ readonly kind: "button" } & PreviewButton)
  | {
      readonly kind: "select";
      readonly placeholder: string | null;
      readonly disabled: boolean;
      readonly options: { readonly label: string; readonly description: string | null }[];
    }
  | ({ readonly kind: "thumbnail" } & PreviewThumbnail)
  | { readonly kind: "media"; readonly items: PreviewThumbnail[] }
  | { readonly kind: "unknown"; readonly typeId: number };

export type ParseResult =
  | { readonly ok: true; readonly nodes: PreviewNode[] }
  | { readonly ok: false; readonly error: string };
