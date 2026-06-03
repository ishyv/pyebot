import { defineScript } from "./define";

/** Read-only example: breaks the member list into humans vs bots. */
export default defineScript({
  name: "member-count",
  description: "Counts members, splitting humans from bots.",
  capabilities: [],
  run: (ctx) => {
    const humans = ctx.members.filter((m) => !m.bot).length;
    return {
      total: ctx.guild.memberCount,
      humans,
      bots: ctx.members.length - humans,
    };
  },
});
