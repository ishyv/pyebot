import type { Handle } from "@sveltejs/kit";
import { redirect } from "@sveltejs/kit";
import { readSession } from "$lib/server/session";

const PUBLIC_PATHS = ["/login", "/auth/discord/start", "/auth/discord/callback", "/favicon.ico"];

export const handle: Handle = async ({ event, resolve }) => {
  try {
    event.locals.session = await readSession(event.cookies);
  } catch {
    event.locals.session = null;
  }

  const path = event.url.pathname;
  const isPublic =
    PUBLIC_PATHS.includes(path) ||
    path.startsWith("/_app") ||
    path.startsWith("/api/session") ||
    path === "/guide" ||
    path.startsWith("/guide/") ||
    // /playground is a public, no-login Discord-UI preview tool (dev aid).
    path === "/playground" ||
    path.startsWith("/playground/");

  if (!event.locals.session && !isPublic && path !== "/") {
    throw redirect(303, "/login");
  }

  return resolve(event);
};
