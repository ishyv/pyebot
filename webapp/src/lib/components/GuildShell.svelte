<script lang="ts">
import { Avatar, Breadcrumb, Button, SidebarNav, surface, Topbar } from "@hyvnt/hyvui";
import type { Snippet } from "svelte";

interface Props {
  guildId: string;
  guildName: string;
  guildIconUrl: string | null;
  activePath: string;
  children: Snippet;
}

const { guildId, guildName, guildIconUrl, activePath, children }: Props = $props();

const navItems = $derived(
  [
    { label: "overview", href: `/guilds/${guildId}` },
    { label: "features", href: `/guilds/${guildId}/features` },
    { label: "moderation", href: `/guilds/${guildId}/moderation` },
    { label: "automod", href: `/guilds/${guildId}/automod` },
    { label: "channels", href: `/guilds/${guildId}/channels` },
    { label: "roles", href: `/guilds/${guildId}/roles` },
    { label: "economy", href: `/guilds/${guildId}/economy` },
    { label: "embeds", href: `/guilds/${guildId}/embeds` },
  ].map((item) => ({
    ...item,
    // Overview matches on exact path; the rest on prefix.
    active:
      item.href === `/guilds/${guildId}`
        ? activePath === item.href
        : activePath.startsWith(item.href),
  })),
);

const breadcrumb = $derived([
  { label: "servers", href: "/guilds" },
  { label: guildName.toLowerCase() },
]);
</script>

<div class="shell">
  <Topbar>
    {#snippet left()}
      <div class="brand">
        <Avatar src={guildIconUrl ?? undefined} name={guildName} size={28} />
        <Breadcrumb items={breadcrumb} />
      </div>
    {/snippet}
    {#snippet right()}
      <div class="topbar-actions">
        <Button variant="ghost" size="sm" href="/guilds">switch server</Button>
        <form method="POST" action="/logout">
          <Button variant="ghost" size="sm" type="submit">sign out</Button>
        </form>
      </div>
    {/snippet}
  </Topbar>

  <div class="body">
    <aside class="sidebar" aria-label="guild navigation">
      <SidebarNav items={navItems} />
    </aside>
    <main class="main" use:surface={{ delay: 0 }}>
      {@render children()}
    </main>
  </div>
</div>

<style>
  .shell {
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .topbar-actions {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
  }

  .topbar-actions form { display: contents; }

  .body {
    display: grid;
    grid-template-columns: 15rem 1fr;
    flex: 1;
    min-height: 0;
  }

  /* Subtle inset gradient so the sidebar reads as a separate plane from main,
     not just a divider line. */
  .sidebar {
    padding: var(--space-lg) var(--space-sm);
    border-right: 1px solid var(--line);
    background: linear-gradient(180deg, var(--bg-elev) 0%, var(--bg-elev-soft) 100%);
  }

  /* Padding scales with viewport: 1.5rem at narrow, up to 3rem on wide.
     Inner max-width prevents lines from stretching uncomfortably wide on
     ultrawide displays while still using the available space below that. */
  .main {
    padding: var(--space-lg) clamp(1.5rem, 4vw, 3rem);
    overflow-x: hidden;
    min-width: 0;
  }
  .main > :global(*) {
    max-width: 90rem;
    margin-inline: auto;
  }

  @media (max-width: 720px) {
    .body { grid-template-columns: 1fr; }
    .sidebar {
      border-right: none;
      border-bottom: 1px solid var(--line);
      padding: var(--space-md);
      background: none;
    }
    .main { padding: var(--space-md); }
  }
</style>
