import { getBridge } from "$lib/server/bridge";
import type { GuideGraphSnapshot } from "$shared/bridge-types";
import type { PageServerLoad } from "./$types";

const EMPTY_GRAPH: GuideGraphSnapshot = {
  capabilities: [],
  features: [],
  commands: [],
  runtimeRoutes: [],
  dashboardPages: [],
};

export const load: PageServerLoad = async ({ params }) => {
  const graph = await getBridge().getGuideGraph(params.guildId);
  return {
    graph: graph.isOk() ? graph.unwrap() : EMPTY_GRAPH,
    loadError: graph.isErr() ? graph.error.message : null,
  };
};
