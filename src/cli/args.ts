import type {
  ConfigFieldKind,
  HandlerKind,
  ImageCliCommand,
  NewCommandCommand,
  NewConfigCommand,
  NewFeatureCommand,
  NewHandlerCommand,
  TxCliCommand,
} from "./types";

type RawArgs = {
  readonly positional: readonly string[];
  readonly options: Readonly<Record<string, string | boolean | readonly string[]>>;
};

/** Error for user-correctable CLI input problems. */
export class TxCliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TxCliUsageError";
  }
}

/** Parse process argv into a typed CLI command without performing side effects. */
export function parseTxCliArgs(argv: readonly string[]): TxCliCommand {
  const raw = parseRawArgs(argv);
  const [command, subcommand] = raw.positional;

  if (!command || command === "help" || raw.options.help === true) return { kind: "help" };

  if (command === "image") {
    return {
      kind: "image",
      action: subcommand ?? null,
      target: raw.positional[2] ?? null,
      options: singleOptions(raw.options),
    } satisfies ImageCliCommand;
  }

  if (command === "check" && subcommand === "authoring") {
    rejectUnknown(raw, ["help"]);
    return { kind: "check-authoring" };
  }

  if (command !== "new") throw new TxCliUsageError(`Unknown command: ${command}`);
  if (subcommand === "feature") return parseNewFeature(raw);
  if (subcommand === "command") return parseNewCommand(raw);
  if (subcommand === "handler") return parseNewHandler(raw);
  if (subcommand === "config") return parseNewConfig(raw);
  throw new TxCliUsageError(`Unknown new target: ${subcommand ?? "(missing)"}`);
}

function parseRawArgs(argv: readonly string[]): RawArgs {
  const positional: string[] = [];
  const options: Record<string, string | boolean | string[]> = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    const key = arg.slice(2);
    const next = argv[i + 1];
    const value = !next || next.startsWith("--") ? true : next;
    if (value !== true) i++;

    const current = options[key];
    if (current === undefined) {
      options[key] = value;
    } else if (Array.isArray(current)) {
      options[key] = [...current, String(value)];
    } else {
      options[key] = [String(current), String(value)];
    }
  }

  return { positional, options };
}

function parseNewFeature(raw: RawArgs): NewFeatureCommand {
  rejectUnknown(raw, ["id", "name", "description", "default-enabled", "dry-run", "help"]);
  return {
    kind: "new-feature",
    id: requiredString(raw, "id"),
    name: requiredString(raw, "name"),
    description: requiredString(raw, "description"),
    defaultEnabled:
      raw.options["default-enabled"] === undefined
        ? undefined
        : booleanValue(raw, "default-enabled"),
    dryRun: flag(raw, "dry-run"),
  };
}

function parseNewCommand(raw: RawArgs): NewCommandCommand {
  rejectUnknown(raw, ["feature", "name", "description", "admin", "hidden", "dry-run", "help"]);
  return {
    kind: "new-command",
    feature: requiredString(raw, "feature"),
    name: requiredString(raw, "name"),
    description: requiredString(raw, "description"),
    requiresAdmin: flag(raw, "admin"),
    hidden: flag(raw, "hidden"),
    dryRun: flag(raw, "dry-run"),
  };
}

function parseNewHandler(raw: RawArgs): NewHandlerCommand {
  rejectUnknown(raw, ["feature", "kind", "event", "prefix", "method", "dry-run", "help"]);
  const handlerKind = enumValue<HandlerKind>(raw, "kind", ["listen", "handle", "on"]);
  if ((handlerKind === "listen" || handlerKind === "on") && !stringOption(raw, "event")) {
    throw new TxCliUsageError("Missing --event.");
  }
  if (handlerKind === "handle" && !stringOption(raw, "prefix")) {
    throw new TxCliUsageError("Missing --prefix.");
  }
  return {
    kind: "new-handler",
    feature: requiredString(raw, "feature"),
    handlerKind,
    event: stringOption(raw, "event"),
    prefix: stringOption(raw, "prefix"),
    method: stringOption(raw, "method"),
    dryRun: flag(raw, "dry-run"),
  };
}

function parseNewConfig(raw: RawArgs): NewConfigCommand {
  rejectUnknown(raw, [
    "feature",
    "field",
    "kind",
    "label",
    "path",
    "required",
    "option",
    "dry-run",
    "help",
  ]);
  const fieldKind = enumValue<ConfigFieldKind>(raw, "kind", [
    "channel",
    "boolean",
    "number",
    "string",
    "select",
  ]);
  const options = arrayOption(raw, "option");
  if (fieldKind === "select" && (!options || options.length === 0)) {
    throw new TxCliUsageError("Select config fields require at least one --option value:Label.");
  }

  return {
    kind: "new-config",
    feature: requiredString(raw, "feature"),
    field: requiredString(raw, "field"),
    fieldKind,
    label: requiredString(raw, "label"),
    path: requiredString(raw, "path"),
    required: flag(raw, "required"),
    options,
    dryRun: flag(raw, "dry-run"),
  };
}

function rejectUnknown(raw: RawArgs, allowed: readonly string[]): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(raw.options)) {
    if (!allowedSet.has(key)) throw new TxCliUsageError(`Unknown option --${key}.`);
  }
}

function requiredString(raw: RawArgs, name: string): string {
  const value = stringOption(raw, name);
  if (!value) throw new TxCliUsageError(`Missing --${name}.`);
  return value;
}

function stringOption(raw: RawArgs, name: string): string | undefined {
  const value = raw.options[name];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function arrayOption(raw: RawArgs, name: string): readonly string[] | undefined {
  const value = raw.options[name];
  if (Array.isArray(value)) return value.map((entry) => entry.trim()).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return undefined;
}

function flag(raw: RawArgs, name: string): boolean {
  const value = raw.options[name];
  if (value === undefined) return false;
  if (value === true) return true;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new TxCliUsageError(`--${name} must be true or false when a value is provided.`);
}

function booleanValue(raw: RawArgs, name: string): boolean {
  const value = raw.options[name];
  if (value === "true") return true;
  if (value === "false") return false;
  throw new TxCliUsageError(`--${name} must be true or false.`);
}

function enumValue<T extends string>(raw: RawArgs, name: string, values: readonly T[]): T {
  const value = requiredString(raw, name);
  if (values.includes(value as T)) return value as T;
  throw new TxCliUsageError(`--${name} must be one of: ${values.join(", ")}.`);
}

function singleOptions(
  options: Readonly<Record<string, string | boolean | readonly string[]>>,
): Readonly<Record<string, string | boolean>> {
  return Object.fromEntries(
    Object.entries(options).map(([key, value]) => [
      key,
      Array.isArray(value) ? (value.at(-1) ?? true) : value,
    ]),
  );
}
