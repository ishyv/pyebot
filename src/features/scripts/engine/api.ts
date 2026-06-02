/**
 * The script-facing API (`ctx`) and the data snapshot it is built from.
 *
 * This module is **pure** — it must never import discord.js, because it runs
 * inside the worker. The main thread loads a `ScriptSnapshot` of guild data and
 * passes it across; `buildContext` reconstructs `ctx` from that snapshot.
 * Read/query helpers operate on the snapshot; mutating recorders append to the
 * operation plan and only exist when the matching capability is granted.
 */
import type { Operation } from "./operations";

/** Gates which mutating recorders appear on `ctx`. Read/query is always available. */
export type Capability = "roles" | "messaging" | "channels";

export interface MemberSnapshot {
  id: string;
  tag: string;
  bot: boolean;
  roleIds: string[];
  /** Epoch millis the member joined, or null if unknown. */
  joinedAt: number | null;
}

export interface RoleSnapshot {
  id: string;
  name: string;
}

export interface ChannelSnapshot {
  id: string;
  name: string;
}

/** Serializable guild data handed to the worker. Plain data only — no methods. */
export interface ScriptSnapshot {
  guild: { id: string; name: string; memberCount: number };
  channel: { id: string; name: string } | null;
  invoker: { id: string; tag: string } | null;
  members: MemberSnapshot[];
  roles: RoleSnapshot[];
  channels: ChannelSnapshot[];
  /** Epoch millis at execution time. */
  now: number;
}

export interface MemberView {
  readonly id: string;
  readonly tag: string;
  readonly bot: boolean;
  readonly roleIds: readonly string[];
  readonly joinedAt: number | null;
  has_role(nameOrId: string): boolean;
  joined_days_ago(): number | null;
}

export interface ScriptApi {
  readonly guild: ScriptSnapshot["guild"];
  readonly channel: ScriptSnapshot["channel"];
  readonly invoker: ScriptSnapshot["invoker"];
  readonly members: readonly MemberView[];
  readonly roles: readonly RoleSnapshot[];
  readonly channels: readonly ChannelSnapshot[];
  readonly now: number;
  addRole?(member: MemberView | string, role: string): void;
  removeRole?(member: MemberView | string, role: string): void;
  dm?(member: MemberView | string, content: string): void;
  createChannel?(opts: { name: string; type?: "text" | "voice" }): void;
  createRole?(opts: { name: string; color?: number }): void;
}

/** Records one operation onto the plan (and enforces the budget). */
export type Sink = (op: Operation) => void;

export interface WorkerRequest {
  readonly code: string;
  readonly snapshot: ScriptSnapshot;
  readonly capabilities: Capability[];
  readonly maxOperations: number;
}

export type WorkerResponse =
  | { readonly ok: true; readonly value: unknown; readonly operations: Operation[] }
  | { readonly ok: false; readonly message: string };

type Writable<T> = { -readonly [K in keyof T]: T[K] };

function userIdOf(member: MemberView | string): string {
  return typeof member === "string" ? member : member.id;
}

/**
 * Builds `ctx` from a snapshot. Mutating recorders are attached only for granted
 * capabilities, so an ungranted call is `undefined` at runtime (and absent from
 * the type), not a silent no-op.
 */
export function buildContext(
  snapshot: ScriptSnapshot,
  capabilities: ReadonlySet<Capability>,
  record: Sink,
): ScriptApi {
  const resolveRoleId = (nameOrId: string): string => {
    const role = snapshot.roles.find((r) => r.id === nameOrId || r.name === nameOrId);
    return role?.id ?? nameOrId;
  };

  const members: MemberView[] = snapshot.members.map((m) => ({
    id: m.id,
    tag: m.tag,
    bot: m.bot,
    roleIds: m.roleIds,
    joinedAt: m.joinedAt,
    has_role: (nameOrId: string) => m.roleIds.includes(resolveRoleId(nameOrId)),
    joined_days_ago: () =>
      m.joinedAt === null ? null : Math.floor((snapshot.now - m.joinedAt) / 86_400_000),
  }));

  const api: Writable<ScriptApi> = {
    guild: snapshot.guild,
    channel: snapshot.channel,
    invoker: snapshot.invoker,
    members,
    roles: snapshot.roles,
    channels: snapshot.channels,
    now: snapshot.now,
  };

  if (capabilities.has("roles")) {
    api.addRole = (member, role) => record({ kind: "add_role", userId: userIdOf(member), role });
    api.removeRole = (member, role) =>
      record({ kind: "remove_role", userId: userIdOf(member), role });
  }
  if (capabilities.has("messaging")) {
    api.dm = (member, content) => record({ kind: "dm", userId: userIdOf(member), content });
  }
  if (capabilities.has("channels")) {
    api.createChannel = (opts) =>
      record({ kind: "create_channel", name: opts.name, channelType: opts.type ?? "text" });
    api.createRole = (opts) =>
      record({ kind: "create_role", name: opts.name, color: opts.color ?? null });
  }

  return api;
}
