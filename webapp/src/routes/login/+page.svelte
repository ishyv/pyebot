<script lang="ts">
import { Alert, Button, Label, StageScene, Text } from "@hyvnt/hyvui";
import type { PageData } from "./$types";

interface Props {
  data: PageData;
}

const { data }: Props = $props();
</script>

<StageScene>
  {#snippet label()}
    <Label color="signal">bot dashboard</Label>
  {/snippet}

  {#snippet heading()}
    <Text expression="title-card" as="h1">tx control</Text>
  {/snippet}

  {#snippet subheading()}
    <Text expression="manifesto">
      sign in with discord to configure servers where you have manage server or administrator.
    </Text>
  {/snippet}

  {#snippet actions()}
    {#if data.missing.length > 0}
      <Alert variant="warn" title="configuration incomplete">
        environment variables required: {data.missing.join(", ")}
      </Alert>
    {:else}
      <div class="cta-row">
        {#if data.error}
          <Label color="muted">sign-in interrupted, try again</Label>
        {/if}
        <Button href="/auth/discord/start" variant="primary" echo>continue with discord</Button>
      </div>
    {/if}
  {/snippet}
</StageScene>

<style>
  .cta-row {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-sm);
  }
</style>
