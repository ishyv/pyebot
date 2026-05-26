import type { FeatureConfigRegistry } from "@/core/featureCatalog";
import { FEATURE_CONFIGS } from "@/features/config";
import { loadFeatures } from "@/framework/loader";
import type { LoadedFeature } from "@/framework/types";
import { buildCommandCatalog } from "@/utils/command-registry";
import { buildGuideGraph } from "@/utils/feature-guide";

export type AuthoringCheckStatus = "pass" | "fail";

export interface AuthoringCheck {
  readonly id: string;
  readonly status: AuthoringCheckStatus;
  readonly message: string;
}

export interface AuthoringCheckResult {
  readonly ok: boolean;
  readonly checks: readonly AuthoringCheck[];
}

export interface AuthoringCheckDependencies {
  loadFeatures(): Promise<LoadedFeature[]>;
  readonly featureConfigs: FeatureConfigRegistry;
}

const defaultDependencies: AuthoringCheckDependencies = {
  loadFeatures,
  featureConfigs: FEATURE_CONFIGS,
};

/** Runs metadata-only framework authoring checks without logging into Discord. */
export async function checkAuthoring(
  dependencies: AuthoringCheckDependencies = defaultDependencies,
): Promise<AuthoringCheckResult> {
  const checks: AuthoringCheck[] = [];
  let features: LoadedFeature[];

  try {
    features = await dependencies.loadFeatures();
    checks.push({
      id: "load-features",
      status: "pass",
      message: `Loaded ${features.length} feature(s).`,
    });
  } catch (error) {
    return result([
      {
        id: "load-features",
        status: "fail",
        message: messageOf(error),
      },
    ]);
  }

  checks.push(validateDuplicateCommands(features));
  checks.push(validateConfigRegistry(features, dependencies.featureConfigs));

  try {
    buildCommandCatalog(features);
    checks.push({
      id: "command-catalog",
      status: "pass",
      message: "Command help metadata is valid.",
    });
  } catch (error) {
    checks.push({ id: "command-catalog", status: "fail", message: messageOf(error) });
  }

  try {
    buildGuideGraph({ features });
    checks.push({ id: "guide-graph", status: "pass", message: "Runtime guide metadata is valid." });
  } catch (error) {
    checks.push({ id: "guide-graph", status: "fail", message: messageOf(error) });
  }

  return result(checks);
}

function validateDuplicateCommands(features: readonly LoadedFeature[]): AuthoringCheck {
  const seen = new Map<string, string>();
  for (const feature of features) {
    for (const command of feature.commands) {
      const owner = seen.get(command.data.name);
      if (owner) {
        return {
          id: "command-names",
          status: "fail",
          message: `Command "${command.data.name}" is declared by both ${owner} and ${feature.descriptor.id}.`,
        };
      }
      seen.set(command.data.name, feature.descriptor.id);
    }
  }
  return { id: "command-names", status: "pass", message: "Command names are unique." };
}

function validateConfigRegistry(
  features: readonly LoadedFeature[],
  configs: FeatureConfigRegistry,
): AuthoringCheck {
  const featureIds = new Set(features.map((feature) => feature.descriptor.id));
  const unknown = Object.keys(configs).filter((featureId) => !featureIds.has(featureId));
  if (unknown.length > 0) {
    return {
      id: "feature-configs",
      status: "fail",
      message: `Config registry references unknown feature(s): ${unknown.join(", ")}.`,
    };
  }
  return {
    id: "feature-configs",
    status: "pass",
    message: "Feature config registry matches loaded features.",
  };
}

function result(checks: readonly AuthoringCheck[]): AuthoringCheckResult {
  return {
    ok: checks.every((check) => check.status === "pass"),
    checks,
  };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
