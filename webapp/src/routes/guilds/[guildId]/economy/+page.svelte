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
  Tabs,
  Toggle,
  toastStore,
} from "@hyvnt/hyvui";
import { untrack } from "svelte";
import { enhance } from "$app/forms";
import FormField from "$lib/components/FormField.svelte";
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

let dailyResolve: { trigger: (s: ResolveStatus) => void } | undefined;
let workResolve: { trigger: (s: ResolveStatus) => void } | undefined;
let taxResolve: { trigger: (s: ResolveStatus) => void } | undefined;

function makeEnhancer(
  setSaving: (v: boolean) => void,
  resolveRef: () => { trigger: (s: ResolveStatus) => void } | undefined,
  okMsg: string,
) {
  return () => {
    setSaving(true);
    return async ({
      result,
      update,
    }: {
      result: { type: string };
      update: (opts?: { reset?: boolean }) => Promise<void>;
    }) => {
      setSaving(false);
      const ok = result.type === "success";
      resolveRef()?.trigger(ok ? "ok" : "fail");
      toastStore.push(ok ? okMsg : "save failed, retry", ok ? "ok" : "fail");
      await update({ reset: false });
    };
  };
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
          use:enhance={makeEnhancer((v) => (savingDaily = v), () => dailyResolve, "daily saved")}
        >
          <FormField label="reward amount" description="currency granted on a successful daily claim.">
            <Input type="number" bind:value={dailyReward} />
            <input type="hidden" name="reward" value={dailyReward} />
          </FormField>
          <FormField
            label="cooldown (hours)"
            description="minimum hours between claims for a given member."
          >
            <Input type="number" bind:value={dailyCooldownHours} />
            <input type="hidden" name="cooldownHours" value={dailyCooldownHours} />
          </FormField>
          <FormField
            label="streak bonus per consecutive day"
            description="extra currency added per day of an active streak."
          >
            <Input type="number" bind:value={dailyStreakBonus} />
            <input type="hidden" name="streakBonus" value={dailyStreakBonus} />
          </FormField>

          <div class="actions">
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
          use:enhance={makeEnhancer((v) => (savingWork = v), () => workResolve, "work saved")}
        >
          <FormField label="base reward" description="base pay before bonuses.">
            <Input type="number" bind:value={workRewardBase} />
            <input type="hidden" name="rewardBase" value={workRewardBase} />
          </FormField>
          <FormField
            label="cooldown (minutes)"
            description="minimum minutes between successive work commands."
          >
            <Input type="number" bind:value={workCooldownMinutes} />
            <input type="hidden" name="cooldownMinutes" value={workCooldownMinutes} />
          </FormField>
          <FormField
            label="daily cap"
            description="maximum number of work commands a member can run per day."
          >
            <Input type="number" bind:value={workDailyCap} />
            <input type="hidden" name="dailyCap" value={workDailyCap} />
          </FormField>
          <FormField
            label="failure chance (0 to 1)"
            description="probability a work attempt fails and pays nothing."
          >
            <Input type="number" bind:value={workFailureChance} />
            <input type="hidden" name="failureChance" value={workFailureChance} />
          </FormField>

          <div class="actions">
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
          use:enhance={makeEnhancer((v) => (savingTax = v), () => taxResolve, "tax saved")}
        >
          <input type="hidden" name="enabled" value={taxEnabled ? "on" : ""} />

          <FormField
            label="tax rate (0 to 1)"
            description="fraction of transferred currency removed as tax."
          >
            <Input type="number" bind:value={taxRate} />
            <input type="hidden" name="rate" value={taxRate} />
          </FormField>
          <FormField
            label="minimum taxable amount"
            description="transfers below this size are not taxed."
          >
            <Input type="number" bind:value={taxMinimum} />
            <input type="hidden" name="minimumTaxableAmount" value={taxMinimum} />
          </FormField>

          <div class="actions">
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
    gap: var(--space-xs);
    margin-top: var(--space-sm);
    padding-top: var(--space-sm);
    border-top: 1px solid var(--line);
  }
</style>
