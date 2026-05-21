<script lang="ts">
import type { ResolveStatus } from "@hyvnt/hyvui";
import { Button, PageHeader, Panel, resolve, Stack, toastStore } from "@hyvnt/hyvui";
import { enhance } from "$app/forms";
import ChannelSelect from "$lib/components/ChannelSelect.svelte";
import FormField from "$lib/components/FormField.svelte";
import type { PageData } from "./$types";

interface Props {
  data: PageData;
}

const { data }: Props = $props();
let saving = $state(false);
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
</script>

<Stack gap="var(--space-lg)">
  <PageHeader title="channels" subtitle="choose where bot messages, logs, and reports are sent." />

  <Panel withInset>
    <form
      method="POST"
      action="?/save"
      use:resolve={(a) => (resolveAction = a)}
      use:enhance={() => {
        saving = true;
        return async ({ result, update }) => {
          saving = false;
          resolveAction?.trigger(result.type === "success" ? "ok" : "fail");
          toastStore.push(
            result.type === "success" ? "channels saved" : "save failed, retry",
            result.type === "success" ? "ok" : "fail",
          );
          await update({ reset: false });
        };
      }}
    >
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
    gap: var(--space-xs);
    margin-top: var(--space-sm);
    padding-top: var(--space-sm);
    border-top: 1px solid var(--line);
  }
</style>
