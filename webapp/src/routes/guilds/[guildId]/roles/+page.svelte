<script lang="ts">
import { Badge, Button, EmptyState, Input, Label, PageHeader, Panel, Stack } from "@hyvnt/hyvui";
import { enhance } from "$app/forms";
import { enhanceSave } from "$lib/forms";
import RolePicker from "$lib/components/RolePicker.svelte";
import type { PageData } from "./$types";

interface Props {
  data: PageData;
}

const { data }: Props = $props();

function roleNameFor(id: string | null): string {
  if (!id) return "not set";
  const role = data.roles.find((r) => r.id === id);
  return role ? role.name : `unknown role (${id})`;
}

// Per-row draft state so inline edits don't mutate readonly loader data.
// Seed synchronously so keys exist before RolePicker mounts, otherwise bind:value
// would pass undefined to its $bindable("") fallback (props_invalid_value).
const buildLabels = () => Object.fromEntries(data.managedRoles.map((m) => [m.key, m.label]));
const buildDiscordIds = () =>
  Object.fromEntries(data.managedRoles.map((m) => [m.key, m.discordRoleId ?? ""]));
let labels = $state<Record<string, string>>(buildLabels());
let discordIds = $state<Record<string, string>>(buildDiscordIds());
$effect(() => {
  labels = buildLabels();
  discordIds = buildDiscordIds();
});
</script>

<Stack gap="var(--space-lg)">
  <PageHeader title="roles" subtitle="managed roles and their discord bindings." />

  <Panel>
    {#snippet header()}
      <Label color="muted">configure capabilities and limits in-discord via the role commands.</Label>
    {/snippet}

    {#if data.managedRoles.length === 0}
      <EmptyState
        title="no managed roles yet"
        description="create one in discord via the /role commands, then refresh."
      />
    {:else}
      <Stack gap="var(--space-sm)">
        {#each data.managedRoles as managed (managed.key)}
          <form
            class="role-row"
            method="POST"
            action="?/save"
            use:enhance={enhanceSave({
              setSaving: () => {},
              okMessage: `${managed.key} saved`,
            })}
          >
            <input type="hidden" name="roleId" value={managed.key} />

            <div class="role-meta">
              <p class="role-key">{managed.key}</p>
              <Input
                value={labels[managed.key] ?? ""}
                oninput={(e) => (labels[managed.key] = (e.target as HTMLInputElement).value)}
              />
              <input type="hidden" name="label" value={labels[managed.key] ?? ""} />
            </div>

            <div class="role-binding">
              <Badge variant={managed.discordRoleId ? "ok" : "warn"}>
                {roleNameFor(managed.discordRoleId).toLowerCase()}
              </Badge>
              <RolePicker
                name="discordRoleId"
                bind:value={discordIds[managed.key]}
                roles={data.roles}
              />
              <input
                type="hidden"
                name="discordRoleId"
                value={discordIds[managed.key] ?? ""}
              />
            </div>

            <Button type="submit" size="sm">save</Button>
          </form>
        {/each}
      </Stack>
    {/if}
  </Panel>
</Stack>

<style>
  .role-row {
    display: grid;
    grid-template-columns: 1fr minmax(12rem, 18rem) auto;
    gap: var(--space-md);
    align-items: center;
    padding: var(--space-sm);
    border: 1px solid var(--line);
  }
  .role-meta { display: grid; gap: var(--space-2xs); min-width: 0; }
  .role-binding { display: grid; gap: var(--space-2xs); min-width: 0; }
  .role-key {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.82rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-soft);
  }
  @media (max-width: 48rem) {
    .role-row { grid-template-columns: 1fr; }
  }
</style>
