import { OkResult, ErrResult, type Result } from "@/core/result";
import { getRpgProfile, patchRpgProfile } from "@/db/repositories/rpg";
import { sessions } from "@/core/state";
import { addItemsToStash } from "./inventory";

export class ExpeditionError extends Error {
  constructor(public readonly code: "IN_RAID" | "NOT_IN_RAID" | "NO_PROFILE" | "DEAD" | "STASH_ERROR", message: string) {
    super(message);
    this.name = "ExpeditionError";
  }
}

export interface ExpeditionSession {
  id: string;
  userId: string;
  location: string;
  loot: Record<string, number>;
  eventsSurvived: number;
}

export async function startExpedition(userId: string, location: string): Promise<Result<{ session: ExpeditionSession }, ExpeditionError>> {
  const profileRes = await getRpgProfile(userId);
  if (profileRes.isErr() || !profileRes.unwrap()) return ErrResult(new ExpeditionError("NO_PROFILE", "No RPG profile found."));
  
  const profile = profileRes.unwrap()!;
  if (profile.activeExpeditionId) return ErrResult(new ExpeditionError("IN_RAID", "You are already in an active expedition!"));
  if (profile.hpCurrent <= 0) return ErrResult(new ExpeditionError("DEAD", "You are dead. You must heal before entering a raid."));

  const expeditionId = "exp_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
  
  const session: ExpeditionSession = {
    id: expeditionId,
    userId,
    location,
    loot: {},
    eventsSurvived: 0
  };
  
  sessions.set(`expedition:${expeditionId}`, session);
  await patchRpgProfile(userId, { activeExpeditionId: expeditionId });
  return OkResult({ session });
}

export function getExpeditionSession(expeditionId: string): ExpeditionSession | null {
  return (sessions.get(`expedition:${expeditionId}`) as ExpeditionSession) || null;
}

export function updateExpeditionSession(session: ExpeditionSession): void {
  sessions.set(`expedition:${session.id}`, session);
}

export async function endExpedition(
  userId: string, 
  status: "extract" | "die", 
  expeditionId: string
): Promise<Result<{ message: string }, ExpeditionError>> {
  const session = getExpeditionSession(expeditionId);
  const profileRes = await getRpgProfile(userId);
  if (profileRes.isErr() || !profileRes.unwrap()) return ErrResult(new ExpeditionError("NO_PROFILE", "No RPG profile found."));
  
  const profile = profileRes.unwrap()!;
  if (!profile.activeExpeditionId || profile.activeExpeditionId !== expeditionId) return ErrResult(new ExpeditionError("NOT_IN_RAID", "You are not in this expedition."));

  sessions.delete(`expedition:${expeditionId}`);

  if (status === "extract") {
    await patchRpgProfile(userId, { activeExpeditionId: null });
    
    if (session && Object.keys(session.loot).length > 0) {
      const stashRes = await addItemsToStash(userId, session.loot);
      if (stashRes.isErr()) {
         return ErrResult(new ExpeditionError("STASH_ERROR", `You extracted, but your stash is overfilled: ${stashRes.error.message}`));
      }
    }
    return OkResult({ message: "You successfully extracted with your loot." });
  } else {
    // Died - wipe equipment and loot
    const loadoutClear = {
      weapon: null, shield: null, helmet: null, chest: null, pants: null, boots: null, ring: null, necklace: null
    };
    
    await patchRpgProfile(userId, { 
      activeExpeditionId: null,
      hpCurrent: 0,
      loadout: loadoutClear
    });
    
    return OkResult({ message: "You died in the raid. All equipped gear and gathered loot was lost." });
  }
}
