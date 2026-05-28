<script lang="ts">
import type { ResolveStatus } from "@hyvnt/hyvui";
import { Alert, Button, PageHeader, Panel, resolve, Stack } from "@hyvnt/hyvui";
import { enhance } from "$app/forms";
import ChannelSelect from "$lib/components/ChannelSelect.svelte";
import FormField from "$lib/components/FormField.svelte";
import { enhanceSave, type FieldError, isDirty } from "$lib/forms";
import type { PageData } from "./$types";

interface Props {
  data: PageData;
}

const { data }: Props = $props();
let saving = $state(false);
let error = $state<FieldError | null>(null);
let resolveAction: { trigger: (s: ResolveStatus) => void } | undefined;

const fields = [
  {
    key: "welcome",
    label: "welcome channel",
    description: "new members are greeted here when they join.",
  },
  { key: "goodbye", label: "goodbye channel", description: "posts when members leave the server." },
  { key: "logs", label: "general logs", description: "general activity log for the bot." },
  {
    key: "reports",
    label: "reports channel",
    description: "where automod and user reports are sent.",
  },
  {
    key: "messageLogs",
    label: "message logs",
    description: "edited and deleted messages are logged here.",
  },
  { key: "voiceLogs", label: "voice logs", description: "voice channel join and leave events." },
  {
    key: "staff",
    label: "staff channel",
    description: "channel where mod notifications are sent.",
  },
];

// Local mutable copies so ChannelSelect's bindable value works.
// Seed synchronously so every key exists before the pickers mount, otherwise
// bind:value would pass undefined to ChannelSelect's $bindable("") fallback.
const buildValues = () => Object.fromEntries(fields.map((f) => [f.key, data.values[f.key] ?? ""]));
let values = $state<Record<string, string>>(buildValues());
$effect(() => {
  values = buildValues();
});

// Dirty against the loader value; the $effect above reseeds `values` after a
// successful save, so the marker clears on its own.
const dirty = $derived(isDirty(values, buildValues()));

function reset(): void {
  values = buildValues();
  error = null;
}
</script>

<Stack gap="var(--space-lg)">
  <PageHeader title="channels" subtitle="choose where bot messages, logs, and reports are sent." />

  <Panel withInset>
    <form
      method="POST"
      action="?/save"
      use:resolve={(a) => (resolveAction = a)}
      use:enhance={enhanceSave({
        setSaving: (v) => (saving = v),
        resolve: () => resolveAction,
        okMessage: "channels saved",
        setError: (e) => (error = e),
      })}
    >
      {#if error}
        <Alert variant="error">{error.message}</Alert>
      {/if}
      {#each fields as field (field.key)}
        <FormField label={field.label} description={field.description}>
          <ChannelSelect
            name={field.key}
            bind:value={values[field.key]}
            channels={data.channels}
            types={["text", "announcement"]}
          />
          <input type="hidden" name={field.key} value={values[field.key] ?? ""} />
        </FormField>
      {/each}

      <div class="actions">
        {#if dirty}<span class="unsaved">unsaved changes</span>{/if}
        {#if dirty}
          <Button type="button" variant="ghost" size="sm" onclick={reset}>reset</Button>
        {/if}
        <Button type="submit" variant="primary" disabled={saving} echo>
          {saving ? "saving" : "save channels"}
        </Button>
      </div>
    </form>
  </Panel>
</Stack>

<style>
  .actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: var(--space-xs);
    margin-top: var(--space-sm);
    padding-top: var(--space-sm);
    border-top: 1px solid var(--line);
  }
  .unsaved {
    margin-right: auto;
    color: var(--text-soft);
    font-family: var(--font-mono);
    font-size: 0.78rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
</style>
