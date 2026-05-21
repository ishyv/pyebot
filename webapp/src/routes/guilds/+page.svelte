<script lang="ts">
import {
  Alert,
  ArchiveScene,
  Avatar,
  Badge,
  Button,
  EmptyState,
  FloatCard,
  Label,
  surface,
  Text,
} from "@hyvnt/hyvui";
import type { PageData } from "./$types";

interface Props {
  data: PageData;
}

const { data }: Props = $props();

const inviteUrl = (guildId: string) =>
  `https://discord.com/oauth2/authorize?client_id=${data.clientId}&permissions=8&scope=bot&guild_id=${guildId}`;
</script>

<ArchiveScene title="servers" minCardWidth="22rem" maxCols={3} gap="var(--space-lg)">
  {#if data.botUnavailable}
    <Alert variant="warn" title="bot offline">
      the bot bridge isn't registered. start the bot with WEBAPP=true and reload.
    </Alert>
  {/if}

  {#each data.guilds as guild, i (guild.id)}
    <!-- .float-slot wraps the FloatCard so the tilt expansion sits over neighbors
         via z-index rather than physically pushing them. Defined in theme.css. -->
    <div class="float-slot" use:surface={{ delay: i * 60 }}>
      <FloatCard tiltMax={3}>
        <header class="card-head">
          <Avatar src={guild.iconUrl ?? undefined} name={guild.name} size={40} />
          <div class="head-text">
            <Text variant="heading" as="h2" class="guild-name">{guild.name.toLowerCase()}</Text>
            {#if guild.botPresent}
              <Badge variant="ok">bot present</Badge>
            {:else}
              <Badge variant="warn">bot not in server</Badge>
            {/if}
          </div>
        </header>

        {#if guild.memberCount !== null}
          <Label color="muted">{guild.memberCount.toLocaleString()} members</Label>
        {/if}

        <div class="card-actions">
          {#if guild.botPresent}
            <Button href={`/guilds/${guild.id}`} variant="primary" size="sm">open dashboard</Button>
          {:else}
            <Button href={inviteUrl(guild.id)} variant="secondary" size="sm">invite bot</Button>
          {/if}
        </div>
      </FloatCard>
    </div>
  {:else}
    {#if data.reason === "no-session"}
      <EmptyState title="session expired" description="sign in again to continue.">
        <Button href="/login" variant="primary">sign in</Button>
      </EmptyState>
    {:else if data.reason === "no-user-guilds"}
      <EmptyState
        title="no servers visible"
        description="discord returned no servers for your account. log out and back in to refresh the oauth grant."
      >
        <Button href="/logout" variant="secondary">sign out</Button>
      </EmptyState>
    {:else if data.reason === "no-manageable"}
      <EmptyState
        title="no manageable servers"
        description="you don't have manage server or administrator anywhere. ask the server owner to grant manage server and reload."
      />
    {:else if data.reason === "bot-unavailable"}
      <EmptyState
        title="bot not running"
        description="start the bot with WEBAPP=true and reload this page."
      />
    {:else}
      <EmptyState
        title="no manageable servers"
        description="sign in with an account that has manage server or administrator in a server where this bot is installed."
      />
    {/if}
  {/each}
</ArchiveScene>

<style>
  .card-head {
    display: flex;
    gap: var(--space-sm);
    align-items: center;
    margin-bottom: var(--space-sm);
  }
  .head-text { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; }
  :global(.guild-name) {
    font-size: 1.05rem;
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .card-actions { margin-top: var(--space-sm); }
</style>
