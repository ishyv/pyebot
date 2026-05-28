/**
 * Pure normalization of a pasted Discord components-v2 payload into a typed,
 * presentation-ready tree. Defensive by design — the input is untrusted pasted
 * JSON, so every field is checked and unknown component types degrade to a
 * labeled stub rather than throwing.
 *
 * No Svelte here so it can be unit-tested directly (the .svelte renderer just
 * walks the returned `PreviewNode[]`).
 */

import type {
  ButtonVariant,
  ParseResult,
  PreviewButton,
  PreviewNode,
  PreviewThumbnail,
  RawButton,
  RawComponent,
  RawThumbnail,
} from "./types";

const BUTTON_VARIANTS: Record<number, ButtonVariant> = {
  1: "primary",
  2: "secondary",
  3: "success",
  4: "danger",
  5: "link",
};

/** 24-bit int accent → #rrggbb, mirroring EmbedPreview. Null when absent. */
export function accentToHex(value: number | null | undefined): string | null {
  if (typeof value !== "number") return null;
  return `#${(value >>> 0).toString(16).padStart(6, "0").slice(-6)}`;
}

function asArray(value: unknown): RawComponent[] {
  return Array.isArray(value) ? (value as RawComponent[]) : [];
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function emojiPrefix(emoji: unknown): string {
  const name = (emoji as { name?: string } | null | undefined)?.name;
  return typeof name === "string" && name.length > 0 ? `${name} ` : "";
}

function toButton(raw: RawButton): PreviewButton {
  const label = `${emojiPrefix(raw.emoji)}${str(raw.label)}`.trim();
  return {
    label: label.length > 0 ? label : "button",
    variant: BUTTON_VARIANTS[raw.style ?? 2] ?? "secondary",
    disabled: raw.disabled === true,
    url: typeof raw.url === "string" ? raw.url : null,
  };
}

function toThumbnail(raw: RawThumbnail): PreviewThumbnail {
  return {
    url: str(raw.media?.url),
    alt: typeof raw.description === "string" ? raw.description : null,
  };
}

function normalize(component: RawComponent): PreviewNode {
  const type = (component as { type?: unknown }).type;
  switch (type) {
    case 17:
      return {
        kind: "container",
        accent: accentToHex((component as { accent_color?: number | null }).accent_color),
        children: asArray((component as { components?: unknown }).components).map(normalize),
      };
    case 10:
      return { kind: "text", content: str((component as { content?: unknown }).content) };
    case 14:
      return {
        kind: "separator",
        divider: (component as { divider?: unknown }).divider !== false,
        large: (component as { spacing?: unknown }).spacing === 2,
      };
    case 9: {
      const accessoryRaw = (component as { accessory?: RawComponent }).accessory;
      let accessory: PreviewButton | PreviewThumbnail | null = null;
      if (accessoryRaw && (accessoryRaw as { type?: number }).type === 2) {
        accessory = toButton(accessoryRaw as RawButton);
      } else if (accessoryRaw && (accessoryRaw as { type?: number }).type === 11) {
        accessory = toThumbnail(accessoryRaw as RawThumbnail);
      }
      return {
        kind: "section",
        children: asArray((component as { components?: unknown }).components).map(normalize),
        accessory,
      };
    }
    case 1:
      return {
        kind: "actionRow",
        children: asArray((component as { components?: unknown }).components).map(normalize),
      };
    case 2:
      return { kind: "button", ...toButton(component as RawButton) };
    case 3: {
      const raw = component as {
        placeholder?: string;
        disabled?: boolean;
        options?: { label?: string; description?: string }[];
      };
      return {
        kind: "select",
        placeholder: typeof raw.placeholder === "string" ? raw.placeholder : null,
        disabled: raw.disabled === true,
        options: asArray(raw.options).map((o) => ({
          label: str((o as { label?: unknown }).label) || "option",
          description:
            typeof (o as { description?: unknown }).description === "string"
              ? (o as { description: string }).description
              : null,
        })),
      };
    }
    case 11:
      return { kind: "thumbnail", ...toThumbnail(component as RawThumbnail) };
    case 12:
      return {
        kind: "media",
        items: asArray((component as { items?: unknown }).items).map((i) =>
          toThumbnail({ type: 11, media: (i as { media?: { url?: string } }).media }),
        ),
      };
    default:
      return { kind: "unknown", typeId: typeof type === "number" ? type : -1 };
  }
}

/**
 * Parse a pasted payload. Accepts either a full message object
 * (`{ components: [...] }`) or a bare array of components.
 */
export function parsePayload(input: unknown): ParseResult {
  let components: unknown;
  if (Array.isArray(input)) {
    components = input;
  } else if (input && typeof input === "object" && "components" in input) {
    components = (input as { components?: unknown }).components;
  } else {
    return { ok: false, error: "expected an object with a components array, or an array." };
  }
  if (!Array.isArray(components)) {
    return { ok: false, error: "components must be an array." };
  }
  return { ok: true, nodes: components.map((c) => normalize(c as RawComponent)) };
}

/** Convenience: parse a raw JSON string, surfacing JSON errors as a result. */
export function parsePayloadJson(text: string): ParseResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? `invalid json: ${err.message}` : "invalid json.",
    };
  }
  return parsePayload(value);
}
