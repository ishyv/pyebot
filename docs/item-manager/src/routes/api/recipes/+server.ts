import { json } from "@sveltejs/kit";
import { readRecipeSummaries } from "$lib/server/registry-io";

export async function GET() {
  try {
    return json(readRecipeSummaries());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: message }, { status: 500 });
  }
}
