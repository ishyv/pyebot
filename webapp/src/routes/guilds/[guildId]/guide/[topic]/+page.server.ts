import { error } from "@sveltejs/kit";
import { GUIDE_TOPICS } from "$lib/guide/topics";
import type { PageServerLoad } from "./$types";

/** Resolves the requested topic id to its metadata, 404 if unknown. */
export const load: PageServerLoad = ({ params }) => {
  const index = GUIDE_TOPICS.findIndex((t) => t.id === params.topic);
  if (index === -1) throw error(404, "guide topic not found.");
  return {
    topic: GUIDE_TOPICS[index],
    prev: index > 0 ? GUIDE_TOPICS[index - 1] : null,
    next: index < GUIDE_TOPICS.length - 1 ? GUIDE_TOPICS[index + 1] : null,
  };
};
