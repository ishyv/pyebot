import { error } from "@sveltejs/kit";
import { requireGuildAccess } from "$lib/server/access";
import type { BotEvent } from "$lib/server/bridge";
import { getBridge } from "$lib/server/bridge";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url, locals }) => {
  const guildId = url.searchParams.get("guildId");
  if (!guildId) throw error(400, "guildId required");

  await requireGuildAccess(locals.session, guildId);

  const bridge = getBridge();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (event: BotEvent) => {
        if (event.guildId !== guildId) return;
        controller.enqueue(encoder.encode(`event: botEvent\ndata: ${JSON.stringify(event)}\n\n`));
      };

      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`: ping\n\n`));
      }, 30_000);

      bridge.events.on("event", send);
      controller.enqueue(encoder.encode(`: connected\n\n`));

      const cleanup = () => {
        clearInterval(heartbeat);
        bridge.events.off("event", send);
      };

      // SvelteKit closes the stream when the client disconnects via cancel().
      (controller as unknown as { _cleanup?: () => void })._cleanup = cleanup;
    },
    cancel() {
      const c = this as unknown as { _cleanup?: () => void };
      c._cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
};
