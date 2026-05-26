import type { CommandModule } from "@/framework";
import { type CommandScenario, runCommandScenario } from "./command-harness";

export interface CommandSmokeEntry {
  readonly file: string;
  readonly command: CommandModule;
}

type SlashOption = {
  readonly name: string;
  readonly type: number;
  readonly options?: readonly SlashOption[];
};

async function loadCommandModules(): Promise<readonly CommandSmokeEntry[]> {
  const glob = new Bun.Glob("src/features/**/commands/*.ts");
  const files = Array.from(glob.scanSync({ cwd: ".", absolute: false }))
    .filter((file) => !file.endsWith(".test.ts"))
    .sort();

  return Promise.all(
    files.map(async (file) => {
      const specifier = `../${file.replace(/^src[\\/]/, "").replaceAll("\\", "/")}`;
      const mod = (await import(specifier)) as { default: CommandModule };
      return { file, command: mod.default };
    }),
  );
}

export const allCommandModules = await loadCommandModules();

function commandOptions(command: CommandModule): readonly SlashOption[] {
  const json = command.data.toJSON() as { options?: readonly SlashOption[] };
  return json.options ?? [];
}

function scenarioOptionNames(scenario: CommandScenario): readonly string[] {
  return [
    ...Object.keys(scenario.options?.strings ?? {}),
    ...Object.keys(scenario.options?.integers ?? {}),
    ...Object.keys(scenario.options?.booleans ?? {}),
    ...Object.keys(scenario.options?.users ?? {}),
    ...Object.keys(scenario.options?.channels ?? {}),
    ...Object.keys(scenario.options?.roles ?? {}),
    ...Object.keys(scenario.options?.mentionables ?? {}),
    ...Object.keys(scenario.options?.attachments ?? {}),
  ];
}

function optionScope(command: CommandModule, scenario: CommandScenario): readonly SlashOption[] {
  const topLevel = commandOptions(command);
  if (scenario.subcommandGroup) {
    const group = topLevel.find(
      (option) => option.name === scenario.subcommandGroup && option.type === 2,
    );
    if (!group)
      throw new Error(
        `${scenario.commandName} has no subcommand group ${scenario.subcommandGroup}`,
      );
    const subcommand = group.options?.find(
      (option) => option.name === scenario.subcommand && option.type === 1,
    );
    if (!subcommand) {
      throw new Error(
        `${scenario.commandName} has no subcommand ${scenario.subcommand ?? "<missing>"} in group ${scenario.subcommandGroup}`,
      );
    }
    return subcommand.options ?? [];
  }

  if (scenario.subcommand) {
    const subcommand = topLevel.find(
      (option) => option.name === scenario.subcommand && option.type === 1,
    );
    if (!subcommand)
      throw new Error(`${scenario.commandName} has no subcommand ${scenario.subcommand}`);
    return subcommand.options ?? [];
  }

  return topLevel.filter((option) => option.type !== 1 && option.type !== 2);
}

/**
 * Validates slash metadata against an explicit scenario before running the real command callback.
 */
export async function runCommandSmokeScenario(
  entry: CommandSmokeEntry,
  scenario: CommandScenario,
): Promise<Awaited<ReturnType<typeof runCommandScenario>>> {
  if (entry.command.data.name !== scenario.commandName) {
    throw new Error(
      `Scenario for ${scenario.commandName} was paired with ${entry.command.data.name}`,
    );
  }

  const available = new Set(optionScope(entry.command, scenario).map((option) => option.name));
  for (const name of scenarioOptionNames(scenario)) {
    if (!available.has(name))
      throw new Error(`${scenario.commandName} scenario uses unknown option ${name}`);
  }

  return runCommandScenario(entry.command, scenario);
}
