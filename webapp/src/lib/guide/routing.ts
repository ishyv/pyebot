import { GUIDE_TOPICS } from "./topics";

/**
 * Resolves a public topic slug against the canonical guide list.
 * Route loaders use this so public and guild guide URLs reject the same ids.
 */
export function findGuideTopic(id: string) {
  const index = GUIDE_TOPICS.findIndex((topic) => topic.id === id);
  if (index === -1) return null;

  return {
    topic: GUIDE_TOPICS[index],
    prev: index > 0 ? GUIDE_TOPICS[index - 1] : null,
    next: index < GUIDE_TOPICS.length - 1 ? GUIDE_TOPICS[index + 1] : null,
  };
}
