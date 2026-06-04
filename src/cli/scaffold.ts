import { join } from "node:path";
import type {
  CliFileSystem,
  FilePlan,
  NewCommandCommand,
  NewConfigCommand,
  NewFeatureCommand,
  NewHandlerCommand,
  PlannedFile,
  TxCliCommand,
} from "./types";

type ScaffoldCommand = Extract<TxCliCommand, { readonly dryRun: boolean }>;

/** Builds a dry file plan for an authoring scaffold command. */
export async function planScaffold(command: ScaffoldCommand, fs: CliFileSystem): Promise<FilePlan> {
  validateId("feature", "feature" in command ? command.feature : command.id);

  const featureRoot = featureDir(fs.cwd, "feature" in command ? command.feature : command.id);
  if (command.kind !== "new-feature") await requireFeature(featureRoot, fs, command.feature);

  const plan =
    command.kind === "new-feature"
      ? planFeature(command, fs.cwd)
      : command.kind === "new-command"
        ? planCommand(command, fs.cwd)
        : command.kind === "new-handler"
          ? planHandler(command, fs.cwd)
          : planConfig(command, fs.cwd);

  for (const file of plan.files) await assertNewFile(file, fs);
  return plan;
}

function planFeature(command: NewFeatureCommand, cwd: string): FilePlan {
  const defaultEnabled =
    command.defaultEnabled === undefined ? "" : `\n  defaultEnabled: ${command.defaultEnabled},`;
  return {
    files: [
      {
        path: join(featureDir(cwd, command.id), "index.ts"),
        content: [
          'import { defineFeature } from "@/framework";',
          "",
          "export default defineFeature({",
          `  id: ${quote(command.id)},`,
          `  name: ${quote(command.name)},`,
          `  description: ${quote(command.description)},${defaultEnabled}`,
          "});",
          "",
        ].join("\n"),
      },
    ],
    notes: [],
  };
}

function planCommand(command: NewCommandCommand, cwd: string): FilePlan {
  validateId("command", command.name);
  const hiddenHelp = command.hidden ? "false" : "{ hints: [] }";
  return {
    files: [
      {
        path: join(featureDir(cwd, command.feature), "commands", `${command.name}.ts`),
        content: [
          'import { command } from "@/framework";',
          "",
          `export default command(${quote(command.name)})`,
          `  .description(${quote(command.description)})`,
          command.hidden ? "  .hidden()" : `  .help(${hiddenHelp})`,
          ...(command.requiresAdmin ? ["  .adminOnly()"] : []),
          `  .run(async (_c) => ({ content: ${quote(command.description)} }));`,
          "",
        ].join("\n"),
      },
    ],
    notes: [],
  };
}

function planHandler(command: NewHandlerCommand, cwd: string): FilePlan {
  const dir = featureDir(cwd, command.feature);
  if (command.handlerKind === "handle") {
    return {
      files: [
        { path: join(dir, "routes.ts"), content: componentRoutes(command) },
        { path: join(dir, "handlers.ts"), content: componentHandler() },
      ],
      notes: [],
    };
  }
  return {
    files: [
      {
        path: join(dir, "handlers.ts"),
        content: command.handlerKind === "listen" ? listenHandler(command) : eventHandler(command),
      },
    ],
    notes: [],
  };
}

function listenHandler(command: NewHandlerCommand): string {
  const event = command.event ?? "messageCreate";
  return [
    'import { defineHandlers, listen } from "@/framework";',
    "",
    "export default defineHandlers([",
    `  listen(${quote(event)}, async (..._args) => {`,
    "    // Add feature-owned event handling here.",
    "  }),",
    "]);",
    "",
  ].join("\n");
}

function componentRoutes(command: NewHandlerCommand): string {
  return [
    'import { defineRoutes } from "@/framework";',
    "",
    "// One declaration drives both the customId encoding and the typed handler.",
    `export const routes = defineRoutes(${quote(command.feature)}, {`,
    "  action: {},",
    "});",
    "",
  ].join("\n");
}

function componentHandler(): string {
  return [
    'import { defineHandlers, routeHandlers } from "@/framework";',
    'import { routes } from "./routes";',
    "",
    "export default defineHandlers([",
    "  ...routeHandlers(routes, {",
    "    action: async (_interaction, _args, _ctx) => {",
    "      // Add feature-owned component handling here.",
    "    },",
    "  }),",
    "]);",
    "",
  ].join("\n");
}

function eventHandler(command: NewHandlerCommand): string {
  const event = command.event ?? `${toPascal(command.feature)}Event`;
  return [
    'import { defineHandlers, on } from "@/framework";',
    "",
    `class ${event} {}`,
    "",
    "export default defineHandlers([",
    `  on(${event}, async (_event, _ctx) => {`,
    "    // Replace the local event token with a shared event class when another feature emits it.",
    "  }),",
    "]);",
    "",
  ].join("\n");
}

function planConfig(command: NewConfigCommand, cwd: string): FilePlan {
  validateId("field", command.field);
  const configName = `${toCamel(command.feature)}FeatureConfig`;
  const fieldFactory = `${command.fieldKind}ConfigField`;
  const fieldBody = configFieldBody(command);
  return {
    files: [
      {
        path: join(featureDir(cwd, command.feature), "config.ts"),
        content: [
          ...(command.fieldKind === "channel" ? ['import { ChannelType } from "discord.js";'] : []),
          `import { ${fieldFactory}, defineFeatureConfig } from "@/core/featureConfig";`,
          "",
          `export const ${configName} = defineFeatureConfig({`,
          "  fields: {",
          `    ${command.field}: ${fieldFactory}({`,
          fieldBody,
          "    }),",
          "  },",
          "});",
          "",
        ].join("\n"),
      },
    ],
    notes: [
      "Wire this config into src/features/config.ts:",
      `  import { ${configName} } from "./${command.feature}/config";`,
      `  ${command.feature}: ${configName},`,
    ],
  };
}

function configFieldBody(command: NewConfigCommand): string {
  const common = [
    `      key: ${quote(command.field)},`,
    `      label: ${quote(command.label)},`,
    `      path: ${quote(command.path)},`,
    `      required: ${command.required},`,
  ];
  if (command.fieldKind === "channel") {
    return [...common, "      channelTypes: [ChannelType.GuildText],"].join("\n");
  }
  if (command.fieldKind === "select") {
    const options = command.options ?? [];
    const rendered = options.map((entry) => {
      const [value, label = value] = entry.split(":", 2);
      return `        { label: ${quote(label)}, value: ${quote(value)} },`;
    });
    return [...common, "      options: [", ...rendered, "      ],"].join("\n");
  }
  return common.join("\n");
}

async function requireFeature(
  featureRoot: string,
  fs: CliFileSystem,
  feature: string,
): Promise<void> {
  const indexPath = join(featureRoot, "index.ts");
  if (!(await fs.exists(indexPath))) {
    throw new Error(`Feature "${feature}" does not exist at ${indexPath}.`);
  }
}

async function assertNewFile(file: PlannedFile, fs: CliFileSystem): Promise<void> {
  if (await fs.exists(file.path)) {
    throw new Error(`Refusing to overwrite existing file: ${file.path}`);
  }
}

function featureDir(cwd: string, feature: string): string {
  return join(cwd, "src", "features", feature);
}

function validateId(label: string, value: string): void {
  if (/^[a-z][a-z0-9-]*$/.test(value)) return;
  throw new Error(`Invalid ${label} id "${value}". Use lowercase letters, numbers, and hyphens.`);
}

function toPascal(value: string): string {
  return value
    .split(/[-_:]/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join("");
}

function toCamel(value: string): string {
  const pascal = toPascal(value);
  return pascal[0]?.toLowerCase() + pascal.slice(1);
}

function quote(value: string): string {
  return JSON.stringify(value);
}
