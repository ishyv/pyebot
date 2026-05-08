/**
 * Feature-owned dashboard configuration metadata.
 *
 * GuildSchema owns the persisted Mongo document shape. This module lets each
 * feature declare the subset of that document the admin dashboard may edit,
 * along with UI labels and validation rules. The split keeps feature-specific
 * admin controls near the feature while still storing values in the guild
 * document.
 *
 * These definitions are config, not state. Runtime/session data belongs in a
 * repository or feature-owned collection instead of a FeatureConfigDefinition.
 */
import {
  ChannelType,
  type Client,
  type GuildBasedChannel,
} from "discord.js";
import { ErrResult, OkResult, type Result } from "@/core/result";
import type { Guild } from "@/db/schemas/guild";

export type FeatureConfigFieldKind = "channel" | "boolean" | "number" | "string" | "select";

interface BaseFeatureConfigField<TKey extends string, TKind extends FeatureConfigFieldKind> {
  readonly kind: TKind;
  readonly key: TKey;
  readonly label: string;
  readonly description?: string;
  readonly path: string;
  readonly required: boolean;
}

export interface ChannelFeatureConfigField<TKey extends string = string>
  extends BaseFeatureConfigField<TKey, "channel"> {
  readonly channelTypes: readonly ChannelType[];
}

export interface BooleanFeatureConfigField<TKey extends string = string>
  extends BaseFeatureConfigField<TKey, "boolean"> {}

export interface NumberFeatureConfigField<TKey extends string = string>
  extends BaseFeatureConfigField<TKey, "number"> {
  readonly integer?: boolean;
  readonly min?: number;
  readonly max?: number;
}

export interface StringFeatureConfigField<TKey extends string = string>
  extends BaseFeatureConfigField<TKey, "string"> {
  readonly minLength?: number;
  readonly maxLength?: number;
}

export interface SelectFeatureConfigField<TKey extends string = string>
  extends BaseFeatureConfigField<TKey, "select"> {
  readonly options: readonly { readonly label: string; readonly value: string }[];
}

export type FeatureConfigField<TKey extends string = string> =
  | ChannelFeatureConfigField<TKey>
  | BooleanFeatureConfigField<TKey>
  | NumberFeatureConfigField<TKey>
  | StringFeatureConfigField<TKey>
  | SelectFeatureConfigField<TKey>;

export interface FeatureConfigDefinition<TFields extends Record<string, FeatureConfigField> = Record<string, FeatureConfigField>> {
  readonly fields: TFields;
}

export interface FeatureConfigValidationIssue {
  readonly key: string;
  readonly path: string;
  readonly message: string;
}

/**
 * Validate a feature's dashboard-editable config declaration at module load.
 * Matching record keys and field keys keep custom IDs, labels, and patch paths
 * from drifting apart as panels are generated dynamically.
 */
export function defineFeatureConfig<const TFields extends Record<string, FeatureConfigField>>(
  definition: FeatureConfigDefinition<TFields>,
): FeatureConfigDefinition<TFields> {
  const seenPaths = new Set<string>();
  for (const [recordKey, field] of Object.entries(definition.fields)) {
    validateFieldMetadata(recordKey, field);
    if (seenPaths.has(field.path)) {
      throw new Error(`Feature config path "${field.path}" is declared more than once.`);
    }
    seenPaths.add(field.path);
  }
  return definition;
}

export function channelConfigField<const TKey extends string>(
  input: Omit<ChannelFeatureConfigField<TKey>, "kind">,
): ChannelFeatureConfigField<TKey> {
  return { kind: "channel", ...input };
}

export function booleanConfigField<const TKey extends string>(
  input: Omit<BooleanFeatureConfigField<TKey>, "kind">,
): BooleanFeatureConfigField<TKey> {
  return { kind: "boolean", ...input };
}

export function numberConfigField<const TKey extends string>(
  input: Omit<NumberFeatureConfigField<TKey>, "kind">,
): NumberFeatureConfigField<TKey> {
  return { kind: "number", ...input };
}

export function stringConfigField<const TKey extends string>(
  input: Omit<StringFeatureConfigField<TKey>, "kind">,
): StringFeatureConfigField<TKey> {
  return { kind: "string", ...input };
}

export function selectConfigField<const TKey extends string>(
  input: Omit<SelectFeatureConfigField<TKey>, "kind">,
): SelectFeatureConfigField<TKey> {
  return { kind: "select", ...input };
}

export function validateFeatureConfig(
  guild: Guild,
  definition: FeatureConfigDefinition,
): Result<void, readonly FeatureConfigValidationIssue[]> {
  const issues: FeatureConfigValidationIssue[] = [];
  for (const field of Object.values(definition.fields)) {
    const value = getConfigPathValue(guild, field.path);
    const issue = validateFieldValue(field, value);
    if (issue) issues.push(issue);
  }
  return issues.length ? ErrResult(issues) : OkResult(undefined);
}

/**
 * Read a dotted guild-config path without throwing on missing intermediate
 * objects. Admin panels use this for display, where a missing value should
 * render as unset instead of breaking the entire dashboard.
 */
export function getConfigPathValue(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (current === null || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[segment];
  }, source);
}

/**
 * Convert one dashboard field write into a Mongo dot-path patch.
 * The field definition is the allow-list: callers provide a field key, not an
 * arbitrary path, so features control which guild paths the generic panel can
 * mutate.
 */
export function buildConfigFieldPatch(
  definition: FeatureConfigDefinition,
  fieldKey: string,
  rawValue: unknown,
): Result<Record<string, unknown>, FeatureConfigValidationIssue> {
  const field = definition.fields[fieldKey];
  if (!field) {
    return ErrResult({ key: fieldKey, path: "", message: "Unknown config field." });
  }

  const issue = validateFieldValue(field, rawValue);
  if (issue) return ErrResult(issue);
  return OkResult({ [field.path]: rawValue });
}

/**
 * Resolve a configured channel only when the stored ID still points at a
 * channel in this guild and matches the declared Discord channel type.
 * Returning null is intentional: deleted channels and stale config are normal
 * admin-panel states, not runtime exceptions.
 */
export async function resolveConfiguredChannel(
  client: Client,
  guild: Guild,
  definition: FeatureConfigDefinition,
  fieldKey: string,
): Promise<GuildBasedChannel | null> {
  const field = definition.fields[fieldKey];
  if (!field || field.kind !== "channel") return null;

  const channelId = getConfigPathValue(guild, field.path);
  if (typeof channelId !== "string" || channelId.length === 0) return null;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !("guild" in channel) || channel.guild.id !== guild._id) return null;
  if (!field.channelTypes.includes(channel.type)) return null;
  return channel as GuildBasedChannel;
}

function validateFieldMetadata(recordKey: string, field: FeatureConfigField): void {
  for (const [name, value] of [["key", field.key], ["label", field.label], ["path", field.path]] as const) {
    if (value.trim().length === 0) {
      throw new Error(`Feature config field "${recordKey}" has an empty ${name}.`);
    }
  }
  if (recordKey !== field.key) {
    throw new Error(`Feature config field "${recordKey}" must use matching key "${field.key}".`);
  }
  if (field.kind === "channel" && field.channelTypes.length === 0) {
    throw new Error(`Channel config field "${field.key}" must declare at least one channel type.`);
  }
  if (field.kind === "select" && field.options.length === 0) {
    throw new Error(`Select config field "${field.key}" must declare at least one option.`);
  }
}

function validateFieldValue(
  field: FeatureConfigField,
  value: unknown,
): FeatureConfigValidationIssue | null {
  if (value === null || value === undefined || value === "") {
    return field.required ? issue(field, `${field.label} is required.`) : null;
  }
  switch (field.kind) {
    case "channel":
    case "string":
      return typeof value === "string" ? validateStringBounds(field, value) : issue(field, `${field.label} must be text.`);
    case "boolean":
      return typeof value === "boolean" ? null : issue(field, `${field.label} must be true or false.`);
    case "number":
      return validateNumber(field, value);
    case "select":
      return typeof value === "string" && field.options.some((option) => option.value === value)
        ? null
        : issue(field, `${field.label} must be one of the declared options.`);
  }
}

function validateStringBounds(
  field: ChannelFeatureConfigField | StringFeatureConfigField,
  value: string,
): FeatureConfigValidationIssue | null {
  if (field.kind !== "string") return null;
  if (field.minLength !== undefined && value.length < field.minLength) return issue(field, `${field.label} is too short.`);
  if (field.maxLength !== undefined && value.length > field.maxLength) return issue(field, `${field.label} is too long.`);
  return null;
}

function validateNumber(field: NumberFeatureConfigField, value: unknown): FeatureConfigValidationIssue | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return issue(field, `${field.label} must be a finite number.`);
  if (field.integer && !Number.isInteger(value)) return issue(field, `${field.label} must be a whole number.`);
  if (field.min !== undefined && value < field.min) return issue(field, `${field.label} is too small.`);
  if (field.max !== undefined && value > field.max) return issue(field, `${field.label} is too large.`);
  return null;
}

function issue(field: FeatureConfigField, message: string): FeatureConfigValidationIssue {
  return { key: field.key, path: field.path, message };
}
