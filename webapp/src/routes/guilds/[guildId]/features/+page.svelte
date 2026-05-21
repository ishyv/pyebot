<script lang="ts">
import {
  Card,
  Label,
  PageHeader,
  Stack,
  StatusDot,
  surface,
  Toggle,
  toastStore,
} from "@hyvnt/hyvui";
import { enhance } from "$app/forms";
import type { PageData } from "./$types";

interface Props {
  data: PageData;
}

const { data }: Props = $props();
let saving = $state<string | null>(null);

// Per-row form refs. HyvUI's Toggle emits a synthetic Event whose currentTarget
// is null, so we can't walk up the DOM from the event. Instead we capture each
// form imperatively and submit by featureId.
let formRefs = $state<Record<string, HTMLFormElement | null>>({});

// Short descriptions live next to the data so future engineers can adjust copy
// in one place. Reads stay lowercase per design law.
const descriptions: Record<string, string> = {
  tickets: "per-user support channels with helper roles.",
  automod: "block link spam, mention spam, and raid patterns.",
  autoroles: "auto-assign roles on join.",
  warns: "warning system with thresholds and escalation.",
  roles: "role policies with reach limits.",
  reputation: "member reputation tracking.",
  tops: "leaderboards for activity and reputation.",
  suggest: "suggestion box with up and down voting.",
  economy: "currency, daily rewards, work, market.",
  game: "rpg combat, gathering, crafting.",
  counting: "counting game with streak tracking.",
};

const describe = (id: string) => descriptions[id] ?? "no description available.";
</script>

<Stack gap="var(--space-lg)">
  <PageHeader
    title="features"
    subtitle="toggle features on or off. disabling a feature hides its commands and stops its handlers."
  />

  <Stack gap="var(--space-sm)">
    {#each data.features as feature, i (feature.id)}
      <div class="lift" use:surface={{ delay: i * 40 }}>
        <Card>
          <div class="row">
            <div class="info">
              <div class="info-head">
                <StatusDot status={feature.enabled ? "ok" : "pend"} pulse={false} />
                <Label color={feature.enabled ? "accent" : "muted"}>{feature.id}</Label>
              </div>
              <p>{describe(feature.id)}</p>
            </div>
            <form
              method="POST"
              action="?/toggle"
              bind:this={formRefs[feature.id]}
              use:enhance={() => {
                saving = feature.id;
                const wasEnabled = feature.enabled;
                return async ({ result, update }) => {
                  saving = null;
                  toastStore.push(
                    result.type === "success"
                      ? wasEnabled ? `${feature.id} disabled` : `${feature.id} enabled`
                      : "toggle failed",
                    result.type === "success" ? "ok" : "fail",
                  );
                  await update();
                };
              }}
            >
              <input type="hidden" name="featureId" value={feature.id} />
              <input type="hidden" name="enabled" value={String(!feature.enabled)} />
              <Toggle
                checked={feature.enabled}
                disabled={saving === feature.id}
                label={feature.enabled ? "on" : "off"}
                onchange={() => formRefs[feature.id]?.requestSubmit()}
              />
            </form>
          </div>
        </Card>
      </div>
    {/each}
  </Stack>
</Stack>

<style>
  .row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: var(--space-md);
    align-items: center;
  }
  .info { min-width: 0; }
  .info-head {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    margin-bottom: var(--space-2xs);
  }
  .info p {
    margin: 0;
    color: var(--text-soft);
    font-size: 0.85rem;
    line-height: 1.45;
  }
</style>
