import { fail } from "@sveltejs/kit";
import { getBridge } from "$lib/server/bridge";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
  const bridge = getBridge();
  const [rolesResult, configResult] = await Promise.all([
    bridge.getRoles(params.guildId),
    bridge.getAdminState(params.guildId),
  ]);

  const roles = rolesResult.isOk() ? rolesResult.unwrap() : [];
  const config = configResult.isOk() ? (configResult.unwrap().guild ?? {}) : {};
  const managedRoles =
    (config as { roles?: Record<string, { label?: string; discordRoleId?: string | null }> })
      .roles ?? {};

  return {
    roles,
    managedRoles: Object.entries(managedRoles).map(([key, value]) => ({
      key,
      label: value.label ?? key,
      discordRoleId: value.discordRoleId ?? null,
    })),
  };
};

export const actions: Actions = {
  save: async ({ params, request, locals }) => {
    if (!locals.session) return fail(401, { error: "Authentication required" });
    const data = await request.formData();
    const roleId = String(data.get("roleId") ?? "").trim();
    if (!roleId) return fail(400, { error: "roleId required" });
    const result = await getBridge().saveRolePolicy(params.guildId, {
      roleId,
      label: String(data.get("label") ?? roleId).trim() || roleId,
      discordRoleId: normalize(data.get("discordRoleId")),
      updatedBy: locals.session.userId,
    });
    if (result.isErr()) return fail(403, { error: result.error.message });
    return { success: true, roleId };
  },
};

function normalize(value: FormDataEntryValue | null): string | null {
  if (value === null) return null;
  const str = String(value).trim();
  return str.length > 0 ? str : null;
}
