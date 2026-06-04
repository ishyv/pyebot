import type { ChatInputCommandInteraction } from "discord.js";
import { handleCrossChannel } from "./crosschannel";
import { handleImageAdd } from "./imageAdd";
import { handleImageChannel } from "./imageChannel";
import { handleImageList } from "./imageList";
import { handleImageRemove } from "./imageRemove";
import { handleImageToggle } from "./imageToggle";
import { handleLinkspam } from "./linkspam";
import { handleMentionSpam } from "./mentionSpam";
import { handlePanel } from "./panel";
import { handlePattern } from "./pattern";
import { handlePolicy } from "./policy";
import { handleRaid } from "./raid";
import { handleReportChannel } from "./reportChannel";
import { handleSlowmode } from "./slowmode";
import { handleStatus } from "./status";
import { handleText } from "./text";
import type { AutomodSubcommandContext } from "./types";
import { handleWhitelist } from "./whitelist";

/**
 * Uniform handler shape for `/automod` subcommands after Discord has narrowed
 * the selected subcommand name.
 */
export type AutomodSubcommandHandler = (
  interaction: ChatInputCommandInteraction,
  ctx: AutomodSubcommandContext,
) => Promise<void>;

/** Dispatch table for `/automod`, kept data-only so the entrypoint stays thin. */
export const automodSubcommands: Record<string, AutomodSubcommandHandler> = {
  linkspam: handleLinkspam,
  whitelist: handleWhitelist,
  "report-channel": handleReportChannel,
  status: handleStatus,
  crosschannel: handleCrossChannel,
  mentionspam: handleMentionSpam,
  slowmode: handleSlowmode,
  raid: handleRaid,
  text: handleText,
  pattern: handlePattern,
  policy: handlePolicy,
  "image-add": handleImageAdd,
  "image-list": handleImageList,
  "image-remove": handleImageRemove,
  "image-toggle": handleImageToggle,
  "image-channel": handleImageChannel,
  panel: handlePanel,
};
