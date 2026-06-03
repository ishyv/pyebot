/**
 * The input collector — an ephemeral message that gathers a script's declared
 * inputs before running it.
 *
 * Entity inputs (role/member/channel) render as Discord's native select menus;
 * text/number inputs are filled via a modal opened from a button. Because the
 * collector message persists, dismissing the modal or hitting a validation error
 * re-renders in place — nothing is lost. Shared by the command (initial render)
 * and the handlers (updates on each interaction).
 *
 * Component budget: a message allows 5 action rows. Each entity input takes one
 * row and the control row takes one, so at most 4 entity inputs are supported.
 */
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ModalBuilder,
  RoleSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
} from "discord.js";
import type { AccentKey } from "@/ui/theme";
import { container, row, separator, text, type V2Top, v2Message } from "@/ui/v2";
import type { InputField } from "./engine";
import type { Runnable } from "./run";

export interface ScriptInputSession {
  readonly runnable: Runnable;
  readonly fields: InputField[];
  values: Record<string, string>;
}

export function sessionKey(userId: string, guildId: string, name: string): string {
  return `scr:${userId}:${guildId}:${name}`;
}

const ENTITY_TYPES = new Set<InputField["type"]>(["role", "member", "channel"]);

function isEntity(field: InputField): boolean {
  return ENTITY_TYPES.has(field.type);
}

/** Builds the select-menu row for one entity input, reflecting any current value. */
function entitySelectRow(name: string, field: InputField, currentValue?: string): V2Top {
  const customId = `scr:sel:${name}:${field.name}`;
  const placeholder = field.label.slice(0, 150);

  if (field.type === "role") {
    const menu = new RoleSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder)
      .setMinValues(field.required ? 1 : 0)
      .setMaxValues(1);
    if (currentValue) menu.setDefaultRoles(currentValue);
    return row(menu);
  }
  if (field.type === "channel") {
    const menu = new ChannelSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder)
      .setMinValues(field.required ? 1 : 0)
      .setMaxValues(1);
    if (currentValue) menu.setDefaultChannels(currentValue);
    return row(menu);
  }
  // member → user select
  const menu = new UserSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder)
    .setMinValues(field.required ? 1 : 0)
    .setMaxValues(1);
  if (currentValue) menu.setDefaultUsers(currentValue);
  return row(menu);
}

function valuesSummary(fields: InputField[], values: Record<string, string>): string {
  const lines = fields.map((f) => {
    const v = values[f.name];
    let shown = "_not set_";
    if (v) {
      if (f.type === "role") shown = `<@&${v}>`;
      else if (f.type === "member") shown = `<@${v}>`;
      else if (f.type === "channel") shown = `<#${v}>`;
      else shown = `\`${v}\``;
    }
    return `**${f.label}:** ${shown}`;
  });
  return lines.join("\n");
}

/** Renders the collector message for the current state of the inputs. */
export function renderCollector(
  name: string,
  fields: InputField[],
  values: Record<string, string>,
  error?: { message: string; soft: boolean },
): ReturnType<typeof v2Message> {
  const accent: AccentKey = error ? (error.soft ? "warn" : "danger") : "info";
  const header = `## \`${name}\`\nProvide the inputs below, then **Run**.`;
  const body = error
    ? `${header}\n\n${valuesSummary(fields, values)}\n\n${error.soft ? "⚠️" : "✗"} ${error.message}`
    : `${header}\n\n${valuesSummary(fields, values)}`;

  const components: V2Top[] = [container(accent, text(body), separator("sm"))];

  for (const f of fields) {
    if (isEntity(f)) components.push(entitySelectRow(name, f, values[f.name]));
  }

  const controls: ButtonBuilder[] = [];
  if (fields.some((f) => !isEntity(f))) {
    controls.push(
      new ButtonBuilder()
        .setCustomId(`scr:txt:${name}`)
        .setLabel("Fill text fields")
        .setStyle(ButtonStyle.Secondary),
    );
  }
  controls.push(
    new ButtonBuilder().setCustomId(`scr:go:${name}`).setLabel("Run").setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("scr:cancel")
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Secondary),
  );
  components.push(row(...controls));

  return v2Message(...components);
}

/** Apply/Cancel control row shown after a collector dry-run produced operations. */
export function applyRow(name: string): V2Top {
  return row(
    new ButtonBuilder()
      .setCustomId(`scr:apply:${name}`)
      .setLabel("Apply")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("scr:cancel")
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Secondary),
  );
}

/** Builds the modal for text/number inputs only, prefilled from current values. */
export function buildInputModal(
  name: string,
  fields: InputField[],
  values: Record<string, string>,
): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(`scr:inp:${name}`)
    .setTitle(`${name} — inputs`.slice(0, 45));
  const textFields = fields.filter((f) => f.type === "text" || f.type === "number").slice(0, 5);
  for (const f of textFields) {
    const input = new TextInputBuilder()
      .setCustomId(f.name)
      .setLabel(f.label.slice(0, 45))
      .setStyle(TextInputStyle.Short)
      .setRequired(f.required)
      .setMaxLength(200);
    if (f.placeholder) input.setPlaceholder(f.placeholder);
    if (values[f.name]) input.setValue(values[f.name]);
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  }
  return modal;
}
