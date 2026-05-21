<script lang="ts">
import {
  Badge,
  Button,
  ConfirmDialog,
  Input,
  PageHeader,
  Panel,
  Stack,
  surface,
  toastStore,
} from "@hyvnt/hyvui";
import { enhance } from "$app/forms";
import { page } from "$app/state";
import type { PageData } from "./$types";

interface Props {
  data: PageData;
}

const { data }: Props = $props();

const guildId = $derived(page.params.guildId);
const channelName = $derived(
  new Map(data.channels.map((c) => [c.id, c.name] as const)),
);

let newName = $state("");
let creating = $state(false);

// One dialog drives both the destructive delete and the public "send now".
let pending = $state<{ action: "send" | "delete"; name: string } | null>(null);

function scheduleLabel(hours: number | null): string {
  if (hours === null) return "schedule";
  if (hours === 168) return "weekly";
  if (hours === 24) return "daily";
  return `every ${hours}h`;
}
</script>

<Stack gap="var(--space-lg)">
  <PageHeader title="embeds" subtitle="build, save, and post rich embeds to your channels." />

  <div use:surface={{ delay: 0 }}>
    <Panel withInset>
      {#snippet header()}<span class="panel-title">new embed</span>{/snippet}
      <form
        method="POST"
        action="?/create"
        class="create"
        use:enhance={() => {
          creating = true;
          return async ({ result, update }) => {
            creating = false;
            if (result.type === "failure") {
              toastStore.push(String(result.data?.error ?? "could not create"), "fail");
            }
            await update({ reset: false });
          };
        }}
      >
        <Input bind:value={newName} placeholder="welcome-message" />
        <input type="hidden" name="name" value={newName} />
        <Button type="submit" variant="primary" disabled={creating || newName.trim() === ""} echo>
          {creating ? "creating" : "create"}
        </Button>
      </form>
      <p class="hint">names use letters, numbers, hyphens and underscores. used as the embed id.</p>
    </Panel>
  </div>

  <div use:surface={{ delay: 60 }}>
    <Panel>
      {#snippet header()}<span class="panel-title">saved embeds</span>{/snippet}
      {#if data.embeds.length === 0}
        <p class="empty">no embeds yet. create one above to get started.</p>
      {:else}
        <ul class="list">
          {#each data.embeds as embed (embed.name)}
            <li class="row lift">
              <div class="row-main">
                <span class="name">{embed.name}</span>
                <span class="channel">
                  {embed.channelId
                    ? `#${channelName.get(embed.channelId) ?? "unknown"}`
                    : "no channel"}
                </span>
              </div>
              <div class="row-badges">
                {#if embed.stickyEnabled}<Badge variant="accent">sticky</Badge>{/if}
                {#if embed.scheduleEnabled}
                  <Badge variant="ok">{scheduleLabel(embed.scheduleIntervalHours)}</Badge>
                {/if}
              </div>
              <div class="row-actions">
                <Button variant="ghost" size="sm" href={`/guilds/${guildId}/embeds/${embed.name}`}>
                  edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onclick={() => (pending = { action: "send", name: embed.name })}
                >
                  send
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onclick={() => (pending = { action: "delete", name: embed.name })}
                >
                  delete
                </Button>
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </Panel>
  </div>
</Stack>

<!-- Hidden forms submitted by the confirm dialog. -->
<form method="POST" action="?/send" id="embed-send-form" use:enhance={() => {
  return async ({ result, update }) => {
    if (result.type === "success") toastStore.push("embed sent", "ok");
    else if (result.type === "failure") toastStore.push(String(result.data?.error ?? "send failed"), "fail");
    pending = null;
    await update();
  };
}}>
  <input type="hidden" name="name" value={pending?.action === "send" ? pending.name : ""} />
</form>

<form method="POST" action="?/delete" id="embed-delete-form" use:enhance={() => {
  return async ({ result, update }) => {
    if (result.type === "success") toastStore.push("embed deleted", "ok");
    else if (result.type === "failure") toastStore.push(String(result.data?.error ?? "delete failed"), "fail");
    pending = null;
    await update();
  };
}}>
  <input type="hidden" name="name" value={pending?.action === "delete" ? pending.name : ""} />
</form>

<ConfirmDialog
  open={pending?.action === "send"}
  title={`send ${pending?.name ?? "embed"}`}
  description="this posts the embed to its target channel right now. everyone in the channel will see it."
  confirmLabel="send now"
  cancelLabel="cancel"
  onconfirm={() => {
    (document.getElementById("embed-send-form") as HTMLFormElement | null)?.requestSubmit();
  }}
  oncancel={() => (pending = null)}
/>

<ConfirmDialog
  open={pending?.action === "delete"}
  title={`delete ${pending?.name ?? "embed"}`}
  description="this removes the saved embed. it cannot be undone."
  confirmLabel="delete"
  cancelLabel="keep"
  destructive
  onconfirm={() => {
    (document.getElementById("embed-delete-form") as HTMLFormElement | null)?.requestSubmit();
  }}
  oncancel={() => (pending = null)}
/>

<style>
  .panel-title {
    font-family: var(--font-mono);
    font-size: 0.88rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text);
  }
  .create {
    display: flex;
    gap: var(--space-sm);
    align-items: flex-start;
  }
  .create :global(input) {
    flex: 1;
  }
  .hint {
    margin: var(--space-2xs) 0 0;
    color: var(--text-soft);
    font-family: var(--font-body);
    font-size: 0.92rem;
  }
  .empty {
    margin: 0;
    color: var(--text-soft);
    font-family: var(--font-body);
    font-size: 0.95rem;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-xs);
  }
  .row {
    display: grid;
    grid-template-columns: 1fr auto auto;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-sm) var(--space-md);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
  }
  .row-main {
    display: flex;
    flex-direction: column;
    gap: var(--space-2xs);
    min-width: 0;
  }
  .name {
    font-family: var(--font-mono);
    letter-spacing: 0.06em;
    color: var(--text);
  }
  .channel {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--text-soft);
  }
  .row-badges {
    display: flex;
    gap: var(--space-2xs);
  }
  .row-actions {
    display: flex;
    gap: var(--space-2xs);
  }
  @media (max-width: 640px) {
    .row {
      grid-template-columns: 1fr;
      align-items: flex-start;
    }
  }
</style>
