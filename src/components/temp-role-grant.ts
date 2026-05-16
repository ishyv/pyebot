/**
 * Active temporary role grant.
 *
 * The grant is lifecycle state, not guild configuration. Policy config says
 * what should happen; this record says which member currently needs expiry.
 */
import { z } from "zod";
import { component } from "@/framework/component";

export const TempRoleGrant = component({
  collection: "temp_role_grants",
  schema: z.object({
    guildId: z.string(),
    userId: z.string(),
    policyId: z.string(),
    roleId: z.string(),
    expiresAt: z.coerce.date(),
    createdAt: z.coerce.date().default(() => new Date()),
  }),
});

export type TempRoleGrantValue = z.infer<typeof TempRoleGrant.schema>;

/** Stable id for one member's active grant under one policy. */
export function tempRoleGrantId(guildId: string, userId: string, policyId: string): string {
  return `${guildId}:${policyId}:${userId}`;
}
