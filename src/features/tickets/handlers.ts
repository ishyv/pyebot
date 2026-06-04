import { defineHandlers, routeHandlers } from "@/framework";
import { handleTicketClose } from "./handlers/close";
import { routes } from "./routes";

export default defineHandlers([
  ...routeHandlers(routes, {
    // args.channel is the decoded ticket channel id (a snowflake).
    close: async (interaction, args, ctx) => {
      await handleTicketClose(interaction, ctx, args.channel);
    },
  }),
]);
