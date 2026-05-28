<script lang="ts">
import type { ResolveStatus } from "@hyvnt/hyvui";
import {
  Badge,
  Button,
  ConfirmDialog,
  CornerBrackets,
  Input,
  Label,
  PageHeader,
  Panel,
  resolve,
  Select,
  Stack,
  Table,
  Tabs,
  Textarea,
  toastStore,
} from "@hyvnt/hyvui";
import { onMount, untrack } from "svelte";
import { enhance } from "$app/forms";
import { page } from "$app/state";
import ChannelSelect from "$lib/components/ChannelSelect.svelte";
import FormField from "$lib/components/FormField.svelte";
import RolePicker from "$lib/components/RolePicker.svelte";
import type { PageData } from "./$types";

interface Props {
  data: PageData;
}

const { data }: Props = $props();

const tabs = [
  { id: "settings", label: "settings" },
  { id: "action", label: "run action" },
  { id: "cases", label: "cases" },
  { id: "appeals", label: "appeals" },
];
let activeTab = $state("settings");

// Settings form
const initial = untrack(() => data.values);
let logChannelId = $state(initial.logChannelId);
let appealsChannelId = $state(initial.appealsChannelId);
let quarantineRoleId = $state(initial.quarantineRoleId);
let verifiedRoleId = $state(initial.verifiedRoleId);

let savingSettings = $state(false);
let settingsResolve: { trigger: (s: ResolveStatus) => void } | undefined;

// Action form
let actionType = $state("warn");
let actionTargetUserId = $state("");
let actionReason = $state("");
let actionDurationMs = $state("3600000");
let actionRoleId = $state("");
let runningAction = $state(false);

let roles = $state<{ id: string; name: string; managed?: boolean }[]>([]);
onMount(async () => {
  const res = await fetch(`/api/guilds/${page.params.guildId}/roles`);
  if (res.ok) {
    const json = await res.json();
    roles = json.roles ?? [];
  }
});

const durationOptions = [
  { value: "600000", label: "10 minutes" },
  { value: "3600000", label: "1 hour" },
  { value: "21600000", label: "6 hours" },
  { value: "86400000", label: "1 day" },
];

const actionTypeOptions = [
  { value: "warn", label: "warn" },
  { value: "timeout", label: "timeout" },
  { value: "kick", label: "kick" },
  { value: "ban", label: "ban" },
  { value: "unban", label: "unban" },
  { value: "restrict", label: "restrict" },
];

// Case delete confirm
let deleteCandidate = $state<{ userId: string; caseId: number; label: string } | null>(null);

const caseColumns = [
  { key: "badge", label: "case" },
  { key: "userId", label: "user" },
  { key: "date", label: "date" },
  { key: "description", label: "description" },
];
const caseRows = $derived(
  data.cases.map((c) => ({
    badge: `${c.type} #${c.caseId}`,
    userId: c.userId,
    date: c.date ?? "unknown",
    description: c.description,
  })),
);

// Mutable per-row drafts so inline edits don't fight the readonly loader payload.
let caseDrafts = $state<Record<number, string>>({});
$effect(() => {
  caseDrafts = Object.fromEntries(data.cases.map((c) => [c.caseId, c.description]));
});

const appealColumns = [
  { key: "badge", label: "case" },
  { key: "userTag", label: "user" },
  { key: "submittedAt", label: "submitted" },
  { key: "reason", label: "reason" },
];
const appealRows = $derived(
  data.appeals.map((a) => ({
    badge: `${a.status} #${a.caseId}`,
    userTag: a.userTag,
    submittedAt: a.submittedAt,
    reason: a.reason,
  })),
);

let appealDrafts = $state<Record<number, string>>({});
$effect(() => {
  appealDrafts = Object.fromEntries(data.appeals.map((a) => [a.caseId, a.reason]));
});
</script>

<Stack gap="var(--space-lg)">
  <PageHeader title="moderation" subtitle="logging, appeals, role policy, and live actions." />

  <Tabs {tabs} active={activeTab} onchange={(id) => (activeTab = id)} />

  {#if activeTab === "settings"}
    <Panel withInset>
      <form
        method="POST"
        action="?/save"
        use:resolve={(a) => (settingsResolve = a)}
        use:enhance={() => {
          savingSettings = true;
          return async ({ result, update }) => {
            savingSettings = false;
            if (result.type === "success") {
              settingsResolve?.trigger("ok");
              toastStore.push("moderation saved", "ok");
            } else {
              settingsResolve?.trigger("fail");
              toastStore.push("save failed, retry", "fail");
            }
            await update({ reset: false });
          };
        }}
      >
        <FormField label="mod log channel" description="bans, mutes, warns, and kicks are logged here.">
          <ChannelSelect
            name="logChannelId"
            bind:value={logChannelId}
            channels={data.channels}
            types={["text"]}
          />
          <input type="hidden" name="logChannelId" value={logChannelId} />
        </FormField>

        <FormField
          label="appeals channel"
          description="submitted ban or mute appeals show up here for staff review."
        >
          <ChannelSelect
            name="appealsChannelId"
            bind:value={appealsChannelId}
            channels={data.channels}
            types={["text"]}
          />
          <input type="hidden" name="appealsChannelId" value={appealsChannelId} />
        </FormField>

        <FormField label="quarantine role" description="role assigned to members under quarantine.">
          <RolePicker name="quarantineRoleId" bind:value={quarantineRoleId} {roles} />
          <input type="hidden" name="quarantineRoleId" value={quarantineRoleId} />
        </FormField>

        <FormField
          label="verified role"
          description="role indicating a verified member, used for ban evasion checks."
        >
          <RolePicker name="verifiedRoleId" bind:value={verifiedRoleId} {roles} />
          <input type="hidden" name="verifiedRoleId" value={verifiedRoleId} />
        </FormField>

        <div class="actions">
          <Button type="submit" variant="primary" disabled={savingSettings} echo>
            {savingSettings ? "saving" : "save moderation"}
          </Button>
        </div>
      </form>
    </Panel>
  {:else if activeTab === "action"}
    <Panel withInset>
      {#snippet header()}
        <Label color="accent">runs through the live bot using your discord permissions</Label>
      {/snippet}

      <form
        method="POST"
        action="?/action"
        use:enhance={() => {
          runningAction = true;
          return async ({ result, update }) => {
            runningAction = false;
            if (result.type === "success") {
              toastStore.push("action complete", "ok");
              actionTargetUserId = "";
              actionReason = "";
            } else {
              const msg = String(
                (result.type === "failure" && result.data?.actionError) || "action refused",
              );
              toastStore.push(msg, "fail");
            }
            await update();
          };
        }}
      >
        <div class="grid-2">
          <FormField label="action">
            <Select bind:value={actionType} options={actionTypeOptions} />
            <input type="hidden" name="type" value={actionType} />
          </FormField>

          <FormField label="user id">
            <Input bind:value={actionTargetUserId} placeholder="discord user id" />
            <input type="hidden" name="targetUserId" value={actionTargetUserId} />
          </FormField>

          <FormField label="timeout duration">
            <Select bind:value={actionDurationMs} options={durationOptions} />
            <input type="hidden" name="durationMs" value={actionDurationMs} />
          </FormField>

          <FormField label="restrict role">
            <RolePicker name="roleId" bind:value={actionRoleId} {roles} />
            <input type="hidden" name="roleId" value={actionRoleId} />
          </FormField>
        </div>

        <FormField label="reason">
          <Textarea bind:value={actionReason} rows={3} placeholder="visible in the mod log" />
          <input type="hidden" name="reason" value={actionReason} />
        </FormField>

        <div class="actions">
          <Button type="submit" variant="primary" disabled={runningAction || !actionTargetUserId} echo>
            {runningAction ? "running" : "run action"}
          </Button>
        </div>
      </form>
    </Panel>
  {:else if activeTab === "cases"}
    <Panel>
      {#snippet header()}<Label color="muted">latest moderation history</Label>{/snippet}
      <CornerBrackets size={14} />


      {#if data.cases.length === 0}
        <p class="empty">no cases recorded.</p>
      {:else}
        <Table columns={caseColumns} rows={caseRows} />
        <div class="row-actions-grid">
          {#each data.cases as item (item.caseId)}
            <form method="POST" action="?/editCase" class="row-edit">
              <input type="hidden" name="userId" value={item.userId} />
              <input type="hidden" name="caseId" value={item.caseId} />
              <Badge variant="accent">{item.type} #{item.caseId}</Badge>
              <Input
                value={caseDrafts[item.caseId] ?? item.description}
                oninput={(e) => (caseDrafts[item.caseId] = (e.target as HTMLInputElement).value)}
              />
              <input type="hidden" name="description" value={caseDrafts[item.caseId] ?? item.description} />
              <div class="row-buttons">
                <Button type="submit" size="sm">save</Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onclick={() =>
                    (deleteCandidate = {
                      userId: item.userId,
                      caseId: item.caseId,
                      label: `${item.type} #${item.caseId}`,
                    })}
                >
                  delete
                </Button>
              </div>
            </form>
          {/each}
        </div>
      {/if}
    </Panel>

    <!-- Hidden form submitted by ConfirmDialog confirm. -->
    <form method="POST" action="?/deleteCase" id="case-delete-form" use:enhance={() => {
      return async ({ result, update }) => {
        if (result.type === "success") toastStore.push("case removed", "ok");
        else toastStore.push("delete failed", "fail");
        deleteCandidate = null;
        await update();
      };
    }}>
      <input type="hidden" name="userId" value={deleteCandidate?.userId ?? ""} />
      <input type="hidden" name="caseId" value={String(deleteCandidate?.caseId ?? "")} />
    </form>

    <ConfirmDialog
      open={!!deleteCandidate}
      title={`remove ${deleteCandidate?.label ?? "case"}`}
      description="this clears the record from history. it cannot be undone."
      confirmLabel="remove"
      cancelLabel="keep"
      destructive
      onconfirm={() => {
        (document.getElementById("case-delete-form") as HTMLFormElement | null)?.requestSubmit();
      }}
      oncancel={() => (deleteCandidate = null)}
    />
  {:else if activeTab === "appeals"}
    <Panel>
      {#snippet header()}<Label color="muted">open and recent appeal records</Label>{/snippet}

      {#if data.appeals.length === 0}
        <p class="empty">no appeals found.</p>
      {:else}
        <Table columns={appealColumns} rows={appealRows} />
        <div class="row-actions-grid">
          {#each data.appeals as appeal (appeal.caseId)}
            {@const draft = appealDrafts[appeal.caseId] ?? appeal.reason}
            <div class="row-edit">
              <Badge variant={appeal.status === "pending" ? "warn" : "accent"}>
                {appeal.status} #{appeal.caseId}
              </Badge>
              <Input
                value={draft}
                oninput={(e) => (appealDrafts[appeal.caseId] = (e.target as HTMLInputElement).value)}
              />
              <div class="row-buttons">
                <!-- Two single-button forms keep each status as a static hidden input. -->
                <form
                  method="POST"
                  action="?/resolveAppeal"
                  use:enhance={() => async ({ result, update }) => {
                    toastStore.push(
                      result.type === "success" ? "appeal approved" : "resolve failed",
                      result.type === "success" ? "ok" : "fail",
                    );
                    await update();
                  }}
                >
                  <input type="hidden" name="caseId" value={appeal.caseId} />
                  <input type="hidden" name="status" value="approved" />
                  <input type="hidden" name="note" value={draft} />
                  <Button type="submit" size="sm">approve</Button>
                </form>
                <form
                  method="POST"
                  action="?/resolveAppeal"
                  use:enhance={() => async ({ result, update }) => {
                    toastStore.push(
                      result.type === "success" ? "appeal denied" : "resolve failed",
                      result.type === "success" ? "ok" : "fail",
                    );
                    await update();
                  }}
                >
                  <input type="hidden" name="caseId" value={appeal.caseId} />
                  <input type="hidden" name="status" value="denied" />
                  <input type="hidden" name="note" value={draft} />
                  <Button type="submit" size="sm" variant="destructive">deny</Button>
                </form>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </Panel>
  {/if}
</Stack>

<style>
  .grid-2 {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-md);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-xs);
    margin-top: var(--space-sm);
    padding-top: var(--space-sm);
    border-top: 1px solid var(--line);
  }
  .empty { margin: var(--space-sm) 0 0; color: var(--text-soft); }
  .row-actions-grid { display: grid; gap: var(--space-xs); margin-top: var(--space-sm); }
  .row-edit {
    display: grid;
    grid-template-columns: minmax(8rem, 12rem) 1fr auto;
    gap: var(--space-sm);
    align-items: center;
    padding: var(--space-xs) var(--space-sm);
    border: 1px solid var(--line);
  }
  .row-buttons { display: inline-flex; gap: var(--space-2xs); }
  @media (max-width: 48rem) {
    .grid-2, .row-edit { grid-template-columns: 1fr; }
    .row-buttons { justify-content: flex-start; }
  }
</style>
