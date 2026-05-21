import { redirect } from "@sveltejs/kit";
import { clearSession } from "$lib/server/session";

export async function POST({ cookies }) {
  await clearSession(cookies);
  throw redirect(303, "/login");
}
