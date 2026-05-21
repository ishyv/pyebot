<script lang="ts">
import { Badge, DataStream, StatusLine } from "@hyvnt/hyvui";
import { onDestroy, onMount } from "svelte";

interface Props {
  guildId: string;
}

interface FeedEvent {
  type: string;
  guildId: string;
  detail: string;
  timestamp: number;
  actorId?: string;
  targetId?: string;
}

const { guildId }: Props = $props();
let events = $state<FeedEvent[]>([]);
let source: EventSource | null = null;
let connected = $state(false);

onMount(() => {
  source = new EventSource(`/api/events?guildId=${encodeURIComponent(guildId)}`);
  source.onopen = () => (connected = true);
  source.onerror = () => (connected = false);
  source.addEventListener("botEvent", (e) => {
    try {
      const event = JSON.parse((e as MessageEvent).data) as FeedEvent;
      events = [event, ...events].slice(0, 50);
    } catch {
      // ignore malformed payloads
    }
  });
});

onDestroy(() => source?.close());

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString();
}

function badgeVariant(type: string): "ok" | "warn" | "fail" | "accent" {
  if (type === "automod_trigger") return "warn";
  if (type === "mod_action") return "fail";
  if (type === "member_join") return "ok";
  return "accent";
}
</script>

<div class="feed">
  <div class="feed-status">
    <StatusLine
      status={connected ? "ok" : "pend"}
      message={connected ? "stream live" : "connecting"}
      visible
      cursor={!connected}
    />
    <div class="stream-edge" aria-hidden="true">
      <DataStream active={connected} width="2.5rem" speed="slow" />
    </div>
  </div>

  {#if events.length === 0}
    <p class="empty">
      no recent activity. events appear here in real time as the bot acts in this server.
    </p>
  {:else}
    <ul>
      {#each events as event (event.timestamp + event.detail)}
        <li>
          <Badge variant={badgeVariant(event.type)}>{event.type.replace(/_/g, " ")}</Badge>
          <div class="event-body">
            <p class="event-detail">{event.detail}</p>
            <p class="event-time">{formatTime(event.timestamp)}</p>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .feed {
    display: grid;
    gap: var(--space-sm);
    position: relative;
  }
  .feed-status {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
  }
  .stream-edge { opacity: 0.6; }
  .empty {
    margin: 0;
    color: var(--text-soft);
    font-size: 0.9rem;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-xs);
    max-height: 24rem;
    overflow-y: auto;
  }
  li {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--space-xs);
    align-items: start;
    padding: var(--space-xs) var(--space-sm);
    border: 1px solid var(--line);
    background: var(--bg-elev-soft);
  }
  .event-body { min-width: 0; }
  .event-detail {
    margin: 0;
    font-size: 0.92rem;
    line-height: 1.4;
    overflow-wrap: anywhere;
  }
  .event-time {
    margin: 0.2rem 0 0;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    letter-spacing: 0.05em;
    color: var(--text-soft);
  }
</style>
