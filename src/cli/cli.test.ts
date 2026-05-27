import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  type CliFileSystem,
  checkAuthoring,
  parseTxCliArgs,
  planScaffold,
  runTxCli,
  TxCliUsageError,
} from "@/cli";
import { Handle } from "@/framework/decorators";

class DuplicateAuthoringHandlers {
  @Handle("dup:")
  @Handle("dup:")
  async onDuplicate() {}
}

const memoryFs = (
  existing: readonly string[] = [],
): CliFileSystem & { written: Map<string, string> } => {
  const files = new Map<string, string>();
  const existingSet = new Set(existing);
  return {
    cwd: "/repo",
    exists: async (path) => existingSet.has(path) || files.has(path),
    writeFile: async (path, content) => {
      files.set(path, content);
    },
    readFile: async (path) => files.get(path) ?? "",
    written: files,
  };
};

describe("parseTxCliArgs", () => {
  test("parses explicit feature scaffolding flags", () => {
    expect(
      parseTxCliArgs([
        "new",
        "feature",
        "--id",
        "counting",
        "--name",
        "Counting",
        "--description",
        "Counting game channel.",
        "--default-enabled",
        "false",
      ]),
    ).toEqual({
      kind: "new-feature",
      id: "counting",
      name: "Counting",
      description: "Counting game channel.",
      defaultEnabled: false,
      dryRun: false,
    });
  });

  test("rejects missing required authoring flags", () => {
    expect(() => parseTxCliArgs(["new", "feature", "--id", "counting"])).toThrow(
      new TxCliUsageError("Missing --name."),
    );
  });

  test("rejects unknown authoring flags", () => {
    expect(() =>
      parseTxCliArgs([
        "new",
        "command",
        "--feature",
        "economy",
        "--name",
        "balance",
        "--description",
        "Show a balance.",
        "--fancy",
      ]),
    ).toThrow(new TxCliUsageError("Unknown option --fancy."));
  });

  test("requires handler-specific routing flags", () => {
    expect(() =>
      parseTxCliArgs(["new", "handler", "--feature", "tickets", "--kind", "handle"]),
    ).toThrow(new TxCliUsageError("Missing --prefix."));
  });

  test("requires select config options", () => {
    expect(() =>
      parseTxCliArgs([
        "new",
        "config",
        "--feature",
        "counting",
        "--field",
        "mode",
        "--kind",
        "select",
        "--label",
        "Mode",
        "--path",
        "counting.mode",
      ]),
    ).toThrow(
      new TxCliUsageError("Select config fields require at least one --option value:Label."),
    );
  });

  test("preserves legacy image dispatch", () => {
    expect(parseTxCliArgs(["image", "test", "avatar.png", "--guild", "123"])).toEqual({
      kind: "image",
      action: "test",
      target: "avatar.png",
      options: { guild: "123" },
    });
  });
});

describe("planScaffold", () => {
  test("plans a feature manifest without touching disk", async () => {
    const fs = memoryFs();
    const plan = await planScaffold(
      {
        kind: "new-feature",
        id: "counting",
        name: "Counting",
        description: "Counting game channel.",
        defaultEnabled: false,
        dryRun: false,
      },
      fs,
    );

    expect(plan.files).toHaveLength(1);
    expect(plan.files[0]?.path).toBe(join("/repo", "src", "features", "counting", "index.ts"));
    expect(plan.files[0]?.content).toContain("export default defineFeature");
    expect(plan.files[0]?.content).toContain('id: "counting"');
    expect(plan.files[0]?.content).toContain("defaultEnabled: false");
    expect(fs.written.size).toBe(0);
  });

  test("refuses existing scaffold targets", async () => {
    const fs = memoryFs([join("/repo", "src", "features", "counting", "index.ts")]);

    await expect(
      planScaffold(
        {
          kind: "new-feature",
          id: "counting",
          name: "Counting",
          description: "Counting game channel.",
          defaultEnabled: undefined,
          dryRun: false,
        },
        fs,
      ),
    ).rejects.toThrow("Refusing to overwrite existing file");
  });

  test("plans a command entrypoint that uses ctx.respond", async () => {
    const fs = memoryFs([join("/repo", "src", "features", "economy", "index.ts")]);
    const plan = await planScaffold(
      {
        kind: "new-command",
        feature: "economy",
        name: "balance",
        description: "Show a user's balance.",
        requiresAdmin: true,
        hidden: false,
        dryRun: false,
      },
      fs,
    );

    expect(plan.files[0]?.path).toBe(
      join("/repo", "src", "features", "economy", "commands", "balance.ts"),
    );
    expect(plan.files[0]?.content).toContain('command("balance")');
    expect(plan.files[0]?.content).toContain("await ctx.respond.send");
    expect(plan.files[0]?.content).toContain(".adminOnly()");
  });

  test("config scaffold prints registry wiring instead of editing the registry", async () => {
    const fs = memoryFs([join("/repo", "src", "features", "counting", "index.ts")]);
    const plan = await planScaffold(
      {
        kind: "new-config",
        feature: "counting",
        field: "channel",
        fieldKind: "channel",
        label: "Counting channel",
        path: "counting.channelId",
        required: true,
        dryRun: false,
      },
      fs,
    );

    expect(plan.files[0]?.path).toBe(join("/repo", "src", "features", "counting", "config.ts"));
    expect(plan.files[0]?.content).toContain("defineFeatureConfig");
    expect(plan.files[0]?.content).toContain("channelConfigField");
    expect(plan.notes.join("\n")).toContain("countingFeatureConfig");
    expect(plan.notes.join("\n")).toContain("src/features/config.ts");
  });
});

describe("runTxCli", () => {
  test("dry-run renders planned writes without writing files", async () => {
    const fs = memoryFs();
    const result = await runTxCli(
      [
        "new",
        "feature",
        "--id",
        "counting",
        "--name",
        "Counting",
        "--description",
        "Counting game channel.",
        "--dry-run",
      ],
      { fs },
    );

    expect(result.stdout).toContain("Would write");
    expect(result.exitCode).toBe(0);
    expect(fs.written.size).toBe(0);
  });
});

describe("checkAuthoring", () => {
  test("validates loaded framework metadata without Discord login", async () => {
    const result = await checkAuthoring({
      loadFeatures: async () => [
        {
          descriptor: {
            id: "utility",
            name: "Utility",
            description: "Useful commands.",
            defaultEnabled: true,
          },
          commands: [
            {
              data: {
                name: "ping",
                toJSON: () => ({ name: "ping", description: "Check latency." }),
              },
              help: { hints: [] },
              execute: async () => {},
            },
          ],
          handlers: null,
        },
      ],
      featureConfigs: {},
    });

    expect(result.ok).toBe(true);
    expect(result.checks.every((check) => check.status === "pass")).toBe(true);
    expect(result.checks.find((check) => check.id === "capability-graph")?.message).toContain(
      "1 command(s)",
    );
  });

  test("fails unknown feature configs and stale hints", async () => {
    const result = await checkAuthoring({
      loadFeatures: async () => [
        {
          descriptor: {
            id: "utility",
            name: "Utility",
            description: "Useful commands.",
            defaultEnabled: true,
          },
          commands: [
            {
              data: {
                name: "ping",
                toJSON: () => ({ name: "ping", description: "Check latency." }),
              },
              help: { hints: ["/missing"] },
              execute: async () => {},
            },
          ],
          handlers: new DuplicateAuthoringHandlers(),
        },
      ],
      featureConfigs: { missing: { fields: {} } },
    });

    expect(result.ok).toBe(false);
    expect(result.checks).toContainEqual(
      expect.objectContaining({
        id: "feature-configs",
        status: "fail",
      }),
    );
    expect(result.checks.find((check) => check.id === "capability-graph")?.message).toContain(
      "unknown command hint",
    );
  });

  test("fails duplicate capability graph node ids", async () => {
    const result = await checkAuthoring({
      loadFeatures: async () => [
        {
          descriptor: {
            id: "utility",
            name: "Utility",
            description: "Useful commands.",
            defaultEnabled: true,
          },
          commands: [],
          handlers: new DuplicateAuthoringHandlers(),
        },
      ],
      featureConfigs: {},
    });

    expect(result.ok).toBe(false);
    expect(result.checks.find((check) => check.id === "capability-graph")?.message).toContain(
      "duplicate node id",
    );
  });
});
