import type { GuideGroupId, GuideTopicGroup, GuideTopicMeta } from "./types";

/** Canonical group order + display labels. "start" is always first. */
const GROUP_ORDER: readonly { id: GuideGroupId; label: string }[] = [
  { id: "start", label: "start here" },
  { id: "protection", label: "protection" },
  { id: "server_ops", label: "server ops" },
  { id: "engagement", label: "engagement" },
  { id: "publishing", label: "publishing" },
  { id: "ai_tools", label: "ai / tools" },
];

/** Buckets topics into ordered groups, dropping empty groups. */
export function groupTopicsByCapability(
  topics: readonly GuideTopicMeta[],
): readonly GuideTopicGroup[] {
  return GROUP_ORDER.flatMap(({ id, label }) => {
    const inGroup = topics.filter((topic) => topic.group === id);
    return inGroup.length > 0 ? [{ id, label, topics: inGroup }] : [];
  });
}
