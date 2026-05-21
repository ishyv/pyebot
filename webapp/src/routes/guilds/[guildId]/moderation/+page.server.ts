import { fail } from "@sveltejs/kit";
import { getBridge } from "$lib/server/bridge";
import { getConfigPath } from "$lib/server/config-path";
import { parseModerationAction } from "$lib/server/dashboard-parsers";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
  const bridge = getBridge();
  const [channelsResult, configResult, casesResult, appealsResult] = await Promise.all([
    bridge.getChannels(params.guildId),
    bridge.getAdminState(params.guildId),
    bridge.listCases(params.guildId),
    bridge.listAppeals(params.guildId),
  ]);

  const channels = channelsResult.isOk() ? channelsResult.unwrap() : [];
  const config = configResult.isOk() ? (configResult.unwrap().guild ?? {}) : {};

  return {
    register: "hextech" as const,
    channels,
    cases: casesResult.isOk() ? casesResult.unwrap().slice(0, 25) : [],
    appeals: appealsResult.isOk() ? appealsResult.unwrap().slice(0, 25) : [],
    values: {
      logChannelId:
        ((getConfigPath(config, "channels.core.modlog") as { channelId?: string } | null)
          ?.channelId as string | undefined) ?? "",
      appealsChannelId:
        (getConfigPath(config, "moderation.appealsChannelId") as string | null) ?? "",
      quarantineRoleId:
        (getConfigPath(config, "moderation.quarantine.roleId") as string | null) ?? "",
      verifiedRoleId:
        (getConfigPath(config, "moderation.verification.roleId") as string | null) ?? "",
    },
  };
};

export const actions: Actions = {
  save: async ({ params, request, locals }) => {
    const data = await request.formData();
    const result = await getBridge().saveModeration(
      params.guildId,
      {
        modLogChannelId: normalize(data.get("logChannelId")),
        appealsChannelId: normalize(data.get("appealsChannelId")),
        quarantineRoleId: normalize(data.get("quarantineRoleId")),
        verifiedRoleId: normalize(data.get("verifiedRoleId")),
      },
      locals.session?.userId,
    );
    if (result.isErr()) return fail(500, { error: result.error.message });
    return { success: true };
  },
  action: async ({ params, request, locals }) => {
    if (!locals.session) return fail(401, { actionError: "Authentication required" });
    const data = await request.formData();
    const action = parseModerationAction(data, locals.session.userId);
    if (!action.ok) return fail(400, { actionError: action.error });
    const result = await getBridge().runModerationAction(params.guildId, action.value);
    if (result.isErr()) return fail(403, { actionError: result.error.message });
    return { actionSuccess: true };
  },
  editCase: async ({ params, request, locals }) => {
    if (!locals.session) return fail(401, { caseError: "Authentication required" });
    const data = await request.formData();
    const userId = normalize(data.get("userId"));
    const caseId = Number(data.get("caseId"));
    const description = normalize(data.get("description"));
    if (!userId || !Number.isInteger(caseId) || !description) {
      return fail(400, { caseError: "userId, caseId, and description required" });
    }
    const result = await getBridge().editCase(
      params.guildId,
      locals.session.userId,
      userId,
      caseId,
      description,
    );
    if (result.isErr()) return fail(403, { caseError: result.error.message });
    return { caseSuccess: true };
  },
  deleteCase: async ({ params, request, locals }) => {
    if (!locals.session) return fail(401, { caseError: "Authentication required" });
    const data = await request.formData();
    const userId = normalize(data.get("userId"));
    const caseId = Number(data.get("caseId"));
    if (!userId || !Number.isInteger(caseId)) {
      return fail(400, { caseError: "userId and caseId required" });
    }
    const result = await getBridge().deleteCase(
      params.guildId,
      locals.session.userId,
      userId,
      caseId,
    );
    if (result.isErr()) return fail(403, { caseError: result.error.message });
    return { caseSuccess: true };
  },
  resolveAppeal: async ({ params, request, locals }) => {
    if (!locals.session) return fail(401, { appealError: "Authentication required" });
    const data = await request.formData();
    const caseId = Number(data.get("caseId"));
    const status = String(data.get("status") ?? "");
    const note = normalize(data.get("note")) ?? "Resolved from dashboard";
    if (!Number.isInteger(caseId) || (status !== "approved" && status !== "denied")) {
      return fail(400, { appealError: "caseId and status required" });
    }
    const result = await getBridge().resolveAppeal(
      params.guildId,
      caseId,
      locals.session.userId,
      status,
      note,
    );
    if (result.isErr()) return fail(403, { appealError: result.error.message });
    return { appealSuccess: true };
  },
};

function normalize(value: FormDataEntryValue | null): string | null {
  if (value === null) return null;
  const str = String(value).trim();
  return str.length > 0 ? str : null;
}
