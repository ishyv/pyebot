import crypto from "node:crypto";
import type { Cookies } from "@sveltejs/kit";
import { type DashboardSession, requireEnv } from "./auth";
import { getDashboardDb } from "./db";
import { refreshDiscordAccessToken } from "./discord";
import { isTokenExpired, tokenExpiresAt } from "./oauth";

const COOKIE_NAME = "tx_dashboard_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function sign(value: string): string {
  const { SESSION_SECRET } = requireEnv();
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");
}

function encodeSessionCookie(sessionId: string): string {
  return `${sessionId}.${sign(sessionId)}`;
}

function decodeSessionCookie(value: string | undefined): string | null {
  if (!value) return null;
  const [sessionId, signature] = value.split(".");
  if (!sessionId || !signature) return null;
  return sign(sessionId) === signature ? sessionId : null;
}

export async function createSession(
  cookies: Cookies,
  input: Omit<DashboardSession, "id" | "expiresAt">,
): Promise<DashboardSession> {
  const session: DashboardSession = {
    ...input,
    id: crypto.randomUUID(),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  };

  const db = await getDashboardDb();
  await db.collection<DashboardSession>("web_sessions").insertOne(session);
  cookies.set(COOKIE_NAME, encodeSessionCookie(session.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });

  return session;
}

export async function readSession(cookies: Cookies): Promise<DashboardSession | null> {
  const sessionId = decodeSessionCookie(cookies.get(COOKIE_NAME));
  if (!sessionId) return null;

  const db = await getDashboardDb();
  const session = await db.collection<DashboardSession>("web_sessions").findOne({ id: sessionId });
  if (!session || new Date(session.expiresAt).getTime() < Date.now()) {
    cookies.delete(COOKIE_NAME, { path: "/" });
    return null;
  }

  if (!isTokenExpired(session.tokenExpiresAt)) {
    return session;
  }

  const refreshed = await refreshDiscordAccessToken(session.refreshToken);
  const updatedSession: DashboardSession = {
    ...session,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token ?? session.refreshToken,
    tokenExpiresAt: tokenExpiresAt(refreshed.expires_in),
    scope: refreshed.scope ?? session.scope,
  };
  await db
    .collection<DashboardSession>("web_sessions")
    .updateOne({ id: session.id }, { $set: updatedSession });
  return updatedSession;
}

export async function clearSession(cookies: Cookies): Promise<void> {
  const sessionId = decodeSessionCookie(cookies.get(COOKIE_NAME));
  if (sessionId) {
    const db = await getDashboardDb().catch(() => null);
    await db?.collection("web_sessions").deleteOne({ id: sessionId });
  }
  cookies.delete(COOKIE_NAME, { path: "/" });
}
