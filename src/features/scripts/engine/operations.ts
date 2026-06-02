/**
 * The operation plan a script produces.
 *
 * Scripts never touch the discord.js client. Instead, calling a recorder on the
 * context (e.g. `ctx.addRole(m, "Veteran")`) appends one of these operations to
 * a plan. The main thread validates the plan with `OperationsSchema` — the
 * worker's output is untrusted data — then applies it (see `apply.ts`).
 */
import { z } from "zod";

const AddRole = z.object({
  kind: z.literal("add_role"),
  userId: z.string(),
  /** Role name or id; resolved against the guild at apply time. */
  role: z.string(),
});

const RemoveRole = z.object({
  kind: z.literal("remove_role"),
  userId: z.string(),
  role: z.string(),
});

const Dm = z.object({
  kind: z.literal("dm"),
  userId: z.string(),
  content: z.string().min(1).max(2000),
});

const CreateChannel = z.object({
  kind: z.literal("create_channel"),
  name: z.string().min(1).max(100),
  channelType: z.enum(["text", "voice"]),
});

const CreateRole = z.object({
  kind: z.literal("create_role"),
  name: z.string().min(1).max(100),
  color: z.number().int().min(0).max(0xffffff).nullable(),
});

export const OperationSchema = z.discriminatedUnion("kind", [
  AddRole,
  RemoveRole,
  Dm,
  CreateChannel,
  CreateRole,
]);

export const OperationsSchema = z.array(OperationSchema);

export type Operation = z.infer<typeof OperationSchema>;
