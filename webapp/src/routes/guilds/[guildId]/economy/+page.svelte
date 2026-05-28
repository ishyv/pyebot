<script lang="ts">
import type { ResolveStatus } from "@hyvnt/hyvui";
import {
  Alert,
  Button,
  Input,
  PageHeader,
  Panel,
  resolve,
  Stack,
  surface,
  Tabs,
  Toggle,
} from "@hyvnt/hyvui";
import { untrack } from "svelte";
import { enhance } from "$app/forms";
import FormField from "$lib/components/FormField.svelte";
import { enhanceSave, type FieldError, isDirty } from "$lib/forms";
import type { PageData } from "./$types";

interface Props {
  data: PageData;
}

const { data }: Props = $props();

const tabs = [
  { id: "daily", label: "daily" },
  { id: "work", label: "work" },
  { id: "tax", label: "tax" },
];
let activeTab = $state("daily");

// Snapshot loader values once for field seeding. `untrack` prevents the
// reactive read so subsequent loader refreshes don't clobber in-flight edits.
const initialDaily = untrack(() => data.daily);
const initialWork = untrack(() => data.work);
const initialTax = untrack(() => data.tax);

let dailyReward = $state(String(initialDaily.reward));
let dailyCooldownHours = $state(String(initialDaily.cooldownHours));
let dailyStreakBonus = $state(String(initialDaily.streakBonus));

let workRewardBase = $state(String(initialWork.rewardBase));
let workCooldownMinutes = $state(String(initialWork.cooldownMinutes));
let workDailyCap = $state(String(initialWork.dailyCap));
let workFailureChance = $state(String(initialWork.failureChance));

let taxEnabled = $state(initialTax.enabled);
let taxRate = $state(String(initialTax.rate));
let taxMinimum = $state(String(initialTax.minimumTaxableAmount));

let savingDaily = $state(false);
let savingWork = $state(false);
let savingTax = $state(false);

let dailyError = $state<FieldError | null>(null);
let workError = $state<FieldError | null>(null);
let taxError = $state<FieldError | null>(null);

let dailyResolve: { trigger: (s: ResolveStatus) => void } | undefined;
let workResolve: { trigger: (s: ResolveStatus) => void } | undefined;
let taxResolve: { trigger: (s: ResolveStatus) => void } | undefined;

// Dirty against the live loader value: after a successful save, `update()`
// refreshes `data` and the flag clears on its own.
const dailyDirty = $derived(
  isDirty(
    { reward: dailyReward, cooldownHours: dailyCooldownHours, streakBonus: dailyStreakBonus },
    {
      reward: String(data.daily.reward),
      cooldownHours: String(data.daily.cooldownHours),
      streakBonus: String(data.daily.streakBonus),
    },
  ),
);
const workDirty = $derived(
  isDirty(
    {
      rewardBase: workRewardBase,
      cooldownMinutes: workCooldownMinutes,
      dailyCap: workDailyCap,
      failureChance: workFailureChance,
    },
    {
      rewardBase: String(data.work.rewardBase),
      cooldownMinutes: String(data.work.cooldownMinutes),
      dailyCap: String(data.work.dailyCap),
      failureChance: String(data.work.failureChance),
    },
  ),
);
const taxDirty = $derived(
  isDirty(
    { enabled: taxEnabled, rate: taxRate, minimum: taxMinimum },
    {
      enabled: data.tax.enabled,
      rate: String(data.tax.rate),
      minimum: String(data.tax.minimumTaxableAmount),
    },
  ),
);

function resetDaily(): void {
  dailyReward = String(data.daily.reward);
  dailyCooldownHours = String(data.daily.cooldownHours);
  dailyStreakBonus = String(data.daily.streakBonus);
  dailyError = null;
}
function resetWork(): void {
  workRewardBase = String(data.work.rewardBase);
  workCooldownMinutes = String(data.work.cooldownMinutes);
  workDailyCap = String(data.work.dailyCap);
  workFailureChance = String(data.work.failureChance);
  workError = null;
}
function resetTax(): void {
  taxEnabled = data.tax.enabled;
  taxRate = String(data.tax.rate);
  taxMinimum = String(data.tax.minimumTaxableAmount);
  taxError = null;
}
</script>

<Stack gap="var(--space-lg)">
  <PageHeader title="economy" subtitle="daily rewards, work pay, and taxation." />

  <Tabs {tabs} active={activeTab} onchange={(id) => (activeTab = id)} />

  {#if activeTab === "daily"}
    <div use:surface={{ delay: 0 }}>
      <Panel withInset>
        <form
          method="POST"
          action="?/saveDaily"
          use:resolve={(a) => (dailyResolve = a)}
          use:enhance={enhanceSave({
            setSaving: (v) => (savingDaily = v),
            resolve: () => dailyResolve,
            okMessage: "daily saved",
            setError: (e) => (dailyError = e),
          })}
        >
          {#if dailyError && !dailyError.field}
            <Alert variant="error">{dailyError.message}</Alert>
          {/if}
          <FormField
            label="reward amount"
            description="currency granted on a successful daily claim."
            error={dailyError?.field === "reward" ? dailyError.message : undefined}
          >
            <Input type="number" bind:value={dailyReward} />
            <input type="hidden" name="reward" value={dailyReward} />
          </FormField>
          <FormField
            label="cooldown (hours)"
            description="minimum hours between claims for a given member."
            error={dailyError?.field === "cooldownHours" ? dailyError.message : undefined}
          >
            <Input type="number" bind:value={dailyCooldownHours} />
            <input type="hidden" name="cooldownHours" value={dailyCooldownHours} />
          </FormField>
          <FormField
            label="streak bonus per consecutive day"
            description="extra currency added per day of an active streak."
            error={dailyError?.field === "streakBonus" ? dailyError.message : undefined}
          >
            <Input type="number" bind:value={dailyStreakBonus} />
            <input type="hidden" name="streakBonus" value={dailyStreakBonus} />
          </FormField>

          <div class="actions">
            {#if dailyDirty}<span class="unsaved">unsaved changes</span>{/if}
            {#if dailyDirty}
              <Button type="button" variant="ghost" size="sm" onclick={resetDaily}>reset</Button>
            {/if}
            <Button type="submit" variant="primary" disabled={savingDaily} echo>
              {savingDaily ? "saving" : "save daily"}
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  {:else if activeTab === "work"}
    <div use:surface={{ delay: 0 }}>
      <Panel withInset>
        <form
          method="POST"
          action="?/saveWork"
          use:resolve={(a) => (workResolve = a)}
          use:enhance={enhanceSave({
            setSaving: (v) => (savingWork = v),
            resolve: () => workResolve,
            okMessage: "work saved",
            setError: (e) => (workError = e),
          })}
        >
          {#if workError && !workError.field}
            <Alert variant="error">{workError.message}</Alert>
          {/if}
          <FormField
            label="base reward"
            description="base pay before bonuses."
            error={workError?.field === "rewardBase" ? workError.message : undefined}
          >
            <Input type="number" bind:value={workRewardBase} />
            <input type="hidden" name="rewardBase" value={workRewardBase} />
          </FormField>
          <FormField
            label="cooldown (minutes)"
            description="minimum minutes between successive work commands."
            error={workError?.field === "cooldownMinutes" ? workError.message : undefined}
          >
            <Input type="number" bind:value={workCooldownMinutes} />
            <input type="hidden" name="cooldownMinutes" value={workCooldownMinutes} />
          </FormField>
          <FormField
            label="daily cap"
            description="maximum number of work commands a member can run per day."
            error={workError?.field === "dailyCap" ? workError.message : undefined}
          >
            <Input type="number" bind:value={workDailyCap} />
            <input type="hidden" name="dailyCap" value={workDailyCap} />
          </FormField>
          <FormField
            label="failure chance (0 to 1)"
            description="probability a work attempt fails and pays nothing."
            error={workError?.field === "failureChance" ? workError.message : undefined}
          >
            <Input type="number" bind:value={workFailureChance} />
            <input type="hidden" name="failureChance" value={workFailureChance} />
          </FormField>

          <div class="actions">
            {#if workDirty}<span class="unsaved">unsaved changes</span>{/if}
            {#if workDirty}
              <Button type="button" variant="ghost" size="sm" onclick={resetWork}>reset</Button>
            {/if}
            <Button type="submit" variant="primary" disabled={savingWork} echo>
              {savingWork ? "saving" : "save work"}
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  {:else if activeTab === "tax"}
    <div use:surface={{ delay: 0 }}>
      <Panel withInset>
        {#snippet header()}
          <div class="panel-head">
            <span class="panel-title">tax</span>
            <Toggle bind:checked={taxEnabled} label={taxEnabled ? "enabled" : "disabled"} />
          </div>
        {/snippet}

        <form
          method="POST"
          action="?/saveTax"
          use:resolve={(a) => (taxResolve = a)}
          use:enhance={enhanceSave({
            setSaving: (v) => (savingTax = v),
            resolve: () => taxResolve,
            okMessage: "tax saved",
            setError: (e) => (taxError = e),
          })}
        >
          <input type="hidden" name="enabled" value={taxEnabled ? "on" : ""} />

          {#if taxError && !taxError.field}
            <Alert variant="error">{taxError.message}</Alert>
          {/if}
          <FormField
            label="tax rate (0 to 1)"
            description="fraction of transferred currency removed as tax."
            error={taxError?.field === "rate" ? taxError.message : undefined}
          >
            <Input type="number" bind:value={taxRate} />
            <input type="hidden" name="rate" value={taxRate} />
          </FormField>
          <FormField
            label="minimum taxable amount"
            description="transfers below this size are not taxed."
            error={taxError?.field === "minimumTaxableAmount" ? taxError.message : undefined}
          >
            <Input type="number" bind:value={taxMinimum} />
            <input type="hidden" name="minimumTaxableAmount" value={taxMinimum} />
          </FormField>

          <div class="actions">
            {#if taxDirty}<span class="unsaved">unsaved changes</span>{/if}
            {#if taxDirty}
              <Button type="button" variant="ghost" size="sm" onclick={resetTax}>reset</Button>
            {/if}
            <Button type="submit" variant="primary" disabled={savingTax} echo>
              {savingTax ? "saving" : "save tax"}
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  {/if}
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
    align-items: center;
    gap: var(--space-xs);
    margin-top: var(--space-sm);
    padding-top: var(--space-sm);
    border-top: 1px solid var(--line);
  }
  /* Push the marker to the left so the save/reset buttons stay right-aligned. */
  .unsaved {
    margin-right: auto;
    color: var(--text-soft);
    font-family: var(--font-mono);
    font-size: 0.78rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
</style>
