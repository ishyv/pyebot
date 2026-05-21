<script lang="ts">
import type { ResolveStatus } from "@hyvnt/hyvui";
import {
  Button,
  Input,
  PageHeader,
  Panel,
  resolve,
  Stack,
  surface,
  Toggle,
  toastStore,
} from "@hyvnt/hyvui";
import { untrack } from "svelte";
import { enhance } from "$app/forms";
import ChannelSelect from "$lib/components/ChannelSelect.svelte";
import FormField from "$lib/components/FormField.svelte";
import RolePicker from "$lib/components/RolePicker.svelte";
import type { PageData } from "./$types";

interface Props {
  data: PageData;
}

interface SlowRule {
  enabled: boolean;
  roleId: string;
  cooldownSeconds: number;
  durationSeconds: number;
}

const { data }: Props = $props();

// Snapshot loader values once for field seeding. `untrack` makes the intent
// explicit so Svelte 5 doesn't warn about a missed reactive read.
const initialLink = untrack(() => data.linkSpam);
const initialMention = untrack(() => data.mentionSpam);
const initialSlow = untrack(() => data.perUserSlow);

let linkSpamEnabled = $state(initialLink.enabled);
let linkSpamMaxLinks = $state(String(initialLink.maxLinks));
let linkSpamWindowSeconds = $state(String(initialLink.windowSeconds));
let linkSpamReportChannelId = $state(initialLink.reportChannelId);

let mentionSpamEnabled = $state(initialMention.enabled);
let mentionSpamMaxMentions = $state(String(initialMention.maxMentions));
let mentionSpamWindowSeconds = $state(String(initialMention.windowSeconds));

let perUserSlowEnabled = $state(initialSlow.enabled);
let slowRoleId = $state("");
let slowCooldownSeconds = $state("30");
let slowDurationSeconds = $state("3600");
let slowRules = $state<SlowRule[]>(normalizeSlowRules(initialSlow.rules));

let savingLink = $state(false);
let savingMention = $state(false);
let savingSlow = $state(false);

// `use:resolve` actions trigger a status flash on the form border.
let linkResolve: { trigger: (s: ResolveStatus) => void } | undefined;
let mentionResolve: { trigger: (s: ResolveStatus) => void } | undefined;
let slowResolve: { trigger: (s: ResolveStatus) => void } | undefined;

const slowRulesJson = $derived(JSON.stringify(slowRules));

function roleNameFor(roleId: string): string {
  return data.roles.find((role) => role.id === roleId)?.name ?? roleId;
}

function normalizeSlowRules(value: unknown): SlowRule[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): SlowRule[] => {
    if (typeof entry !== "object" || entry === null) return [];
    const rule = entry as Record<string, unknown>;
    const roleId = String(rule.roleId ?? "");
    if (!roleId) return [];
    return [
      {
        enabled: Boolean(rule.enabled ?? true),
        roleId,
        cooldownSeconds: Number(rule.cooldownSeconds ?? 30),
        durationSeconds: Number(rule.durationSeconds ?? 3600),
      },
    ];
  });
}

function upsertSlowRule(): void {
  const roleId = slowRoleId.trim();
  const cooldownSeconds = Math.trunc(Number(slowCooldownSeconds));
  const durationSeconds = Math.trunc(Number(slowDurationSeconds));
  if (!roleId || !Number.isFinite(cooldownSeconds) || !Number.isFinite(durationSeconds)) return;
  slowRules = [
    ...slowRules.filter((rule) => rule.roleId !== roleId),
    { enabled: true, roleId, cooldownSeconds, durationSeconds },
  ];
}

function removeSlowRule(roleId: string): void {
  slowRules = slowRules.filter((rule) => rule.roleId !== roleId);
}
</script>

<Stack gap="var(--space-lg)">
  <PageHeader title="automod" subtitle="block spam patterns and abusive behavior automatically." />

  <div use:surface={{ delay: 0 }}>
    <Panel withInset>
      {#snippet header()}
        <div class="panel-head">
          <span class="panel-title">link spam</span>
          <Toggle bind:checked={linkSpamEnabled} label={linkSpamEnabled ? "enabled" : "disabled"} />
        </div>
      {/snippet}

      <form
        method="POST"
        action="?/saveLinkSpam"
        use:resolve={(a) => (linkResolve = a)}
        use:enhance={() => {
          savingLink = true;
          return async ({ result, update }) => {
            savingLink = false;
            if (result.type === "success") {
              linkResolve?.trigger("ok");
              toastStore.push("link spam saved", "ok");
            } else {
              linkResolve?.trigger("fail");
              toastStore.push("save failed, retry", "fail");
            }
            await update({ reset: false });
          };
        }}
      >
        <input type="hidden" name="enabled" value={linkSpamEnabled ? "on" : ""} />

        <FormField
          label="max links per window"
          description="a member posting more than this many links inside the time window triggers action."
        >
          <Input type="number" bind:value={linkSpamMaxLinks} />
          <input type="hidden" name="maxLinks" value={linkSpamMaxLinks} />
        </FormField>

        <FormField
          label="window (seconds)"
          description="how long the counter looks back for spam patterns."
        >
          <Input type="number" bind:value={linkSpamWindowSeconds} />
          <input type="hidden" name="windowSeconds" value={linkSpamWindowSeconds} />
        </FormField>

        <FormField
          label="report channel"
          description="where automod fires get reported. leave empty to use the global reports channel."
        >
          <ChannelSelect
            name="reportChannelId"
            bind:value={linkSpamReportChannelId}
            channels={data.channels}
            types={["text"]}
          />
          <input type="hidden" name="reportChannelId" value={linkSpamReportChannelId} />
        </FormField>

        <div class="actions">
          <Button type="submit" variant="primary" disabled={savingLink} echo>
            {savingLink ? "saving" : "save link spam"}
          </Button>
        </div>
      </form>
    </Panel>
  </div>

  <div use:surface={{ delay: 60 }}>
    <Panel withInset>
      {#snippet header()}
        <div class="panel-head">
          <span class="panel-title">mention spam</span>
          <Toggle bind:checked={mentionSpamEnabled} label={mentionSpamEnabled ? "enabled" : "disabled"} />
        </div>
      {/snippet}

      <form
        method="POST"
        action="?/saveMentionSpam"
        use:resolve={(a) => (mentionResolve = a)}
        use:enhance={() => {
          savingMention = true;
          return async ({ result, update }) => {
            savingMention = false;
            if (result.type === "success") {
              mentionResolve?.trigger("ok");
              toastStore.push("mention spam saved", "ok");
            } else {
              mentionResolve?.trigger("fail");
              toastStore.push("save failed, retry", "fail");
            }
            await update({ reset: false });
          };
        }}
      >
        <input type="hidden" name="enabled" value={mentionSpamEnabled ? "on" : ""} />

        <FormField
          label="max mentions per window"
          description="a member mentioning more people than this in the window triggers action."
        >
          <Input type="number" bind:value={mentionSpamMaxMentions} />
          <input type="hidden" name="maxMentions" value={mentionSpamMaxMentions} />
        </FormField>

        <FormField label="window (seconds)" description="how long the counter looks back.">
          <Input type="number" bind:value={mentionSpamWindowSeconds} />
          <input type="hidden" name="windowSeconds" value={mentionSpamWindowSeconds} />
        </FormField>

        <div class="actions">
          <Button type="submit" variant="primary" disabled={savingMention} echo>
            {savingMention ? "saving" : "save mention spam"}
          </Button>
        </div>
      </form>
    </Panel>
  </div>

  <div use:surface={{ delay: 120 }}>
    <Panel withInset>
      {#snippet header()}
        <div class="panel-head">
          <span class="panel-title">user slow roles</span>
          <Toggle bind:checked={perUserSlowEnabled} label={perUserSlowEnabled ? "enabled" : "disabled"} />
        </div>
      {/snippet}

      <form
        method="POST"
        action="?/savePerUserSlow"
        use:resolve={(a) => (slowResolve = a)}
        use:enhance={() => {
          savingSlow = true;
          return async ({ result, update }) => {
            savingSlow = false;
            if (result.type === "success") {
              slowResolve?.trigger("ok");
              toastStore.push("user slow roles saved", "ok");
            } else {
              slowResolve?.trigger("fail");
              toastStore.push("save failed, retry", "fail");
            }
            await update({ reset: false });
          };
        }}
      >
        <input type="hidden" name="enabled" value={perUserSlowEnabled ? "on" : ""} />
        <input type="hidden" name="rules" value={slowRulesJson} />

        <div class="slow-builder">
          <FormField label="slow role" description="members with this role get a per-user cooldown.">
            <RolePicker name="roleId" bind:value={slowRoleId} roles={data.roles} placeholder="choose role" />
          </FormField>

          <FormField label="cooldown (seconds)" description="how long the member must wait after a message.">
            <Input type="number" bind:value={slowCooldownSeconds} />
          </FormField>

          <FormField label="effect duration (seconds)" description="how long the bot keeps the slow role.">
            <Input type="number" bind:value={slowDurationSeconds} />
          </FormField>

          <Button type="button" variant="secondary" onclick={upsertSlowRule}>add role</Button>
        </div>

        {#if slowRules.length > 0}
          <div class="slow-list">
            {#each slowRules as rule (rule.roleId)}
              <div class="slow-rule">
                <span>@{roleNameFor(rule.roleId)}</span>
                <span>{rule.cooldownSeconds}s cooldown</span>
                <span>{rule.durationSeconds}s effect</span>
                <Button type="button" size="sm" variant="destructive" onclick={() => removeSlowRule(rule.roleId)}>
                  remove
                </Button>
              </div>
            {/each}
          </div>
        {/if}

        <div class="actions">
          <Button type="submit" variant="primary" disabled={savingSlow} echo>
            {savingSlow ? "saving" : "save user slow roles"}
          </Button>
        </div>
      </form>
    </Panel>
  </div>
</Stack>

<style>
  .panel-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-md);
  }
  .panel-title {
    font-family: var(--font-mono);
    font-size: 0.88rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-xs);
    margin-top: var(--space-sm);
    padding-top: var(--space-sm);
    border-top: 1px solid var(--line);
  }
  .slow-builder {
    display: grid;
    grid-template-columns: minmax(12rem, 1.4fr) minmax(8rem, 1fr) minmax(8rem, 1fr) auto;
    gap: var(--space-md);
    align-items: end;
  }
  .slow-list {
    display: grid;
    gap: var(--space-xs);
    margin-top: var(--space-md);
  }
  .slow-rule {
    display: grid;
    grid-template-columns: minmax(10rem, 1fr) auto auto auto;
    gap: var(--space-sm);
    align-items: center;
    padding: var(--space-xs) var(--space-sm);
    border: 1px solid var(--line);
    font-family: var(--font-mono);
    font-size: 0.82rem;
  }
  @media (max-width: 860px) {
    .slow-builder,
    .slow-rule {
      grid-template-columns: 1fr;
    }
  }
</style>
