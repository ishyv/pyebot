/** Parsed command accepted by the local `tx` CLI. */
export type TxCliCommand =
  | { readonly kind: "help" }
  | ImageCliCommand
  | NewFeatureCommand
  | NewCommandCommand
  | NewHandlerCommand
  | NewConfigCommand
  | { readonly kind: "check-authoring" };

/** Legacy automod image command kept under the `tx image ...` surface. */
export interface ImageCliCommand {
  readonly kind: "image";
  readonly action: string | null;
  readonly target: string | null;
  readonly options: Readonly<Record<string, string | boolean>>;
}

interface DryRunOption {
  readonly dryRun: boolean;
}

/** Creates a feature manifest under `src/features/<id>/index.ts`. */
export interface NewFeatureCommand extends DryRunOption {
  readonly kind: "new-feature";
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly defaultEnabled: boolean | undefined;
}

/** Creates a command module under an existing feature's `commands/` folder. */
export interface NewCommandCommand extends DryRunOption {
  readonly kind: "new-command";
  readonly feature: string;
  readonly name: string;
  readonly description: string;
  readonly requiresAdmin: boolean;
  readonly hidden: boolean;
}

export type HandlerKind = "listen" | "handle" | "on";

/** Creates a top-level feature `handlers.ts` file for the active loader contract. */
export interface NewHandlerCommand extends DryRunOption {
  readonly kind: "new-handler";
  readonly feature: string;
  readonly handlerKind: HandlerKind;
  readonly event: string | undefined;
  readonly prefix: string | undefined;
  readonly method: string | undefined;
}

export type ConfigFieldKind = "channel" | "boolean" | "number" | "string" | "select";

/** Creates a feature-owned dashboard config declaration. */
export interface NewConfigCommand extends DryRunOption {
  readonly kind: "new-config";
  readonly feature: string;
  readonly field: string;
  readonly fieldKind: ConfigFieldKind;
  readonly label: string;
  readonly path: string;
  readonly required: boolean;
  readonly options?: readonly string[];
}

/** One file the CLI intends to write. Paths are absolute. */
export interface PlannedFile {
  readonly path: string;
  readonly content: string;
}

/** Dry, inspectable output from scaffold planning before side effects happen. */
export interface FilePlan {
  readonly files: readonly PlannedFile[];
  readonly notes: readonly string[];
}

/** Small filesystem boundary so CLI planning can be tested without touching disk. */
export interface CliFileSystem {
  readonly cwd: string;
  exists(path: string): Promise<boolean>;
  writeFile(path: string, content: string): Promise<void>;
  readFile?(path: string): Promise<string>;
}

/** Process-facing result. Scripts decide how to print and which exit code to use. */
export interface TxCliResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}
