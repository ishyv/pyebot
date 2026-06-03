import { footer, sep, title } from "../engine/output";
import { defineScript } from "./define";

export default defineScript({
  name: "member-count",
  description: "Splits the member count into humans vs bots.",
  capabilities: [],
  run: (ctx) => {
    const humans = ctx.members.filter((m) => !m.bot).length;
    const bots = ctx.members.length - humans;
    return [
      title("Member Count"),
      { total: ctx.guild.memberCount, humans, bots },
      sep(),
      footer(ctx.guild.name),
    ];
  },
});
