import { json } from "@sveltejs/kit";
import { requireEnv } from "$lib/server/auth";

export function GET({ locals }) {
  let configured = true;
  let missing: string[] = [];

  try {
    requireEnv();
  } catch (error) {
    configured = false;
    missing =
      error instanceof Error
        ? error.message.replace("Missing dashboard environment: ", "").split(", ")
        : [];
  }

  return json({
    configured,
    missing,
    user: locals.session
      ? {
          id: locals.session.userId,
          username: locals.session.username,
          avatarUrl: locals.session.avatarUrl,
        }
      : null,
  });
}
