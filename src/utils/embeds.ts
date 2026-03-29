import { EmbedBuilder, type ColorResolvable } from "discord.js";

export const Colors = {
  success: 0x57f287 as ColorResolvable,
  error: 0xed4245 as ColorResolvable,
  warning: 0xfee75c as ColorResolvable,
  info: 0x5865f2 as ColorResolvable,
  neutral: 0x2b2d31 as ColorResolvable,
} as const;

export function successEmbed(description: string, title?: string): EmbedBuilder {
  const e = new EmbedBuilder().setColor(Colors.success).setDescription(description);
  if (title) e.setTitle(title);
  return e;
}

export function errorEmbed(description: string, title?: string): EmbedBuilder {
  const e = new EmbedBuilder().setColor(Colors.error).setDescription(description);
  if (title) e.setTitle(title);
  return e;
}

export function infoEmbed(description: string, title?: string): EmbedBuilder {
  const e = new EmbedBuilder().setColor(Colors.info).setDescription(description);
  if (title) e.setTitle(title);
  return e;
}

export function warningEmbed(description: string, title?: string): EmbedBuilder {
  const e = new EmbedBuilder().setColor(Colors.warning).setDescription(description);
  if (title) e.setTitle(title);
  return e;
}

export function neutralEmbed(description: string, title?: string): EmbedBuilder {
  const e = new EmbedBuilder().setColor(Colors.neutral).setDescription(description);
  if (title) e.setTitle(title);
  return e;
}
