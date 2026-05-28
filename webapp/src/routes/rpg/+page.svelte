<script lang="ts">
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  CornerBrackets,
  Divider,
  Drawer,
  EmptyState,
  ErrorState,
  Grid,
  Input,
  Label,
  MetricCard,
  Modal,
  PageHeader,
  Panel,
  SearchBar,
  Select,
  Skeleton,
  Stack,
  StatusDot,
  surface,
  Tabs,
  Text,
  Textarea,
  toastStore,
} from "@hyvnt/hyvui";
import { onMount } from "svelte";

interface ItemDef {
  id: string;
  name: string;
  category: string;
  rarity: string;
  trait1: string;
  trait2: string;
  sources: string[];
  description: string;
}

interface RecipeDef {
  id: string;
  method: string;
  ingredients: string[];
  output: { id: string; qty: number };
}

const CATEGORIES = [
  "all",
  "mineral",
  "timber",
  "herb",
  "animal",
  "reagent",
  "medical",
  "component",
  "tool",
  "weapon",
  "armor",
  "artifact",
  "misc",
] as const;

const TRAITS = ["density", "sharpness", "organic", "toxicity", "magic", "liquid", "none"];
const RARITIES = ["common", "uncommon", "rare", "legendary"] as const;
const SOURCES = ["gather", "expedition", "craft", "drop", "quest", "shop"];

/**
 * Rarity → HyvUI Badge variant. Under the arcane register --signal is tox green,
 * --accent is violet, --accent-strong is magenta — so this gives a four-step
 * graduation entirely in the active palette, no extra colors required.
 */
const RARITY_BADGE: Record<string, "default" | "signal" | "accent" | "ok" | "warn"> = {
  common: "default",
  uncommon: "signal",
  rare: "accent",
  legendary: "warn",
};

const mainTabs = [
  { id: "registry", label: "registry" },
  { id: "recipes", label: "recipes" },
];

let items = $state<ItemDef[]>([]);
let recipes = $state<RecipeDef[]>([]);
let loading = $state(true);
let loadError = $state<string | null>(null);

let activeMainTab = $state("registry");
let activeCategory = $state("all");
let searchQuery = $state("");
let recipeSearch = $state("");

let showAddModal = $state(false);
let editDrawerOpen = $state(false);
let editingItem = $state<ItemDef | null>(null);
let saving = $state(false);
let deleteCandidate = $state<ItemDef | null>(null);

let newItem = $state<ItemDef>(blankItem());

function blankItem(): ItemDef {
  return {
    id: "",
    name: "",
    category: "mineral",
    rarity: "common",
    trait1: "none",
    trait2: "none",
    sources: [],
    description: "",
  };
}

const filteredItems = $derived.by(() => {
  let result = items;
  if (activeCategory !== "all") result = result.filter((i) => i.category === activeCategory);
  const q = searchQuery.trim().toLowerCase();
  if (q) {
    result = result.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.id.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.trait1.toLowerCase().includes(q) ||
        i.trait2.toLowerCase().includes(q),
    );
  }
  return result;
});

const filteredRecipes = $derived.by(() => {
  const q = recipeSearch.trim().toLowerCase();
  if (!q) return recipes;
  return recipes.filter(
    (r) =>
      r.id.toLowerCase().includes(q) ||
      r.output.id.toLowerCase().includes(q) ||
      r.ingredients.some((i) => i.toLowerCase().includes(q)),
  );
});

const rarityCounts = $derived.by(() => {
  const counts: Record<string, number> = {};
  for (const r of RARITIES) counts[r] = items.filter((i) => i.rarity === r).length;
  return counts;
});

const categoryTabs = $derived(CATEGORIES.map((cat) => ({ id: cat, label: cat })));

async function loadItems() {
  loading = true;
  loadError = null;
  try {
    const res = await fetch("/api/rpg/items");
    const data = await res.json();
    if (Array.isArray(data.items)) {
      items = data.items;
    } else {
      loadError = data.error ?? "registry unreachable";
      items = [];
    }
  } catch (err) {
    loadError = err instanceof Error ? err.message : "registry unreachable";
    items = [];
  } finally {
    loading = false;
  }
}

async function loadRecipes() {
  try {
    const res = await fetch("/api/rpg/recipes");
    const data = await res.json();
    recipes = Array.isArray(data) ? data : [];
  } catch {
    recipes = [];
  }
}

async function saveItem(item: ItemDef) {
  saving = true;
  try {
    const res = await fetch(`/api/rpg/items/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });
    const data = await res.json();
    if (data.success) {
      toastStore.push(`${item.id} saved`, "ok");
      await loadItems();
      editDrawerOpen = false;
      editingItem = null;
    } else {
      toastStore.push(data.error ?? "save failed", "fail");
    }
  } catch {
    toastStore.push("save failed, retry", "fail");
  } finally {
    saving = false;
  }
}

async function addItem() {
  if (!newItem.id || !newItem.name) {
    toastStore.push("id and name are required", "warn");
    return;
  }
  saving = true;
  try {
    const res = await fetch("/api/rpg/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newItem),
    });
    const data = await res.json();
    if (data.success) {
      toastStore.push(`${newItem.id} added`, "ok");
      showAddModal = false;
      newItem = blankItem();
      await loadItems();
    } else {
      toastStore.push(data.error ?? "add failed", "fail");
    }
  } catch {
    toastStore.push("add failed, retry", "fail");
  } finally {
    saving = false;
  }
}

async function deleteItem(id: string) {
  try {
    const res = await fetch(`/api/rpg/items/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) {
      toastStore.push(`${id} removed`, "ok");
      deleteCandidate = null;
      await loadItems();
    } else {
      toastStore.push(data.error ?? "delete failed", "fail");
    }
  } catch {
    toastStore.push("delete failed, retry", "fail");
  }
}

function openEdit(item: ItemDef) {
  editingItem = { ...item, sources: [...item.sources] };
  editDrawerOpen = true;
}

function autoId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function toggleSource(sources: string[], src: string): string[] {
  return sources.includes(src) ? sources.filter((s) => s !== src) : [...sources, src];
}

onMount(() => {
  void loadItems();
  void loadRecipes();
});
</script>

<svelte:head>
  <title>ashenmoor registry, {items.length} items</title>
</svelte:head>

<div class="page">
  <PageHeader
    title="ashenmoor registry"
    subtitle="items, traits, sources, and crafting recipes for the rpg content layer."
  >
    {#snippet actions()}
      <Button variant="primary" echo onclick={() => (showAddModal = true)}>add item</Button>
    {/snippet}
  </PageHeader>

  <Tabs tabs={mainTabs} active={activeMainTab} onchange={(id) => (activeMainTab = id)} />

  {#if activeMainTab === "registry"}
    <Stack gap="var(--space-lg)">
      <Grid minColWidth="11rem" maxCols={5} gap="var(--space-sm)">
        <div use:surface={{ delay: 0 }}><MetricCard label="total items" value={items.length} /></div>
        {#each RARITIES as r, i (r)}
          <div use:surface={{ delay: (i + 1) * 50 }}>
            <MetricCard label={r} value={rarityCounts[r] ?? 0} />
          </div>
        {/each}
      </Grid>

      <Stack direction="horizontal" gap="var(--space-md)" align="center" wrap>
        <div class="grow"><SearchBar bind:value={searchQuery} placeholder="name, trait, description" /></div>
        <Label color="muted">{filteredItems.length} shown</Label>
      </Stack>

      <Tabs tabs={categoryTabs} active={activeCategory} onchange={(id) => (activeCategory = id)} />

      <Divider />

      {#if loading}
        <Grid minColWidth="18rem" maxCols={3} gap="var(--space-sm)">
          {#each Array(6) as _}
            <Skeleton variant="card" height="180px" />
          {/each}
        </Grid>
      {:else if loadError}
        <ErrorState title="registry unreachable" description={loadError} retry onretry={loadItems} />
      {:else if filteredItems.length === 0}
        <EmptyState title="no items match" description="try a different category or search query." />
      {:else}
        <Grid minColWidth="20rem" maxCols={3} gap="var(--space-sm)">
          {#each filteredItems as item, i (item.id)}
            <div class="lift" use:surface={{ delay: Math.min(i, 8) * 40 }}>
              <Card>
                <Stack gap="var(--space-xs)">
                  <Stack direction="horizontal" gap="var(--space-xs)" align="center">
                    <Badge variant={RARITY_BADGE[item.rarity] ?? "default"}>{item.rarity}</Badge>
                    <Label color="muted">{item.category}</Label>
                  </Stack>

                  <Text variant="heading" as="h3">{item.name.toLowerCase()}</Text>
                  <Label color="muted">#{item.id}</Label>

                  {#if item.description}
                    <p class="desc">{item.description}</p>
                  {/if}

                  <Stack direction="horizontal" gap="var(--space-2xs)" wrap>
                    {#each [item.trait1, item.trait2].filter((t) => t && t !== "none") as trait}
                      <Badge>{trait}</Badge>
                    {/each}
                    {#each item.sources as src}
                      <Badge variant="signal">{src}</Badge>
                    {/each}
                  </Stack>

                  <div class="card-actions">
                    <Button size="sm" onclick={() => openEdit(item)}>edit</Button>
                    <Button size="sm" variant="destructive" onclick={() => (deleteCandidate = item)}>
                      remove
                    </Button>
                  </div>
                </Stack>
              </Card>
            </div>
          {/each}
        </Grid>
      {/if}
    </Stack>
  {:else}
    <Stack gap="var(--space-lg)">
      <Grid minColWidth="11rem" maxCols={4} gap="var(--space-sm)">
        <MetricCard label="total recipes" value={recipes.length} />
      </Grid>

      <Stack direction="horizontal" gap="var(--space-md)" align="center" wrap>
        <div class="grow"><SearchBar bind:value={recipeSearch} placeholder="ingredient or output id" /></div>
        <Label color="muted">{filteredRecipes.length} shown</Label>
      </Stack>

      {#if recipes.length === 0}
        <EmptyState
          title="no recipes parsed"
          description="auto-generated blocks could not be read, or no recipes are defined yet."
        />
      {:else}
        <Grid minColWidth="22rem" maxCols={2} gap="var(--space-sm)">
          {#each filteredRecipes as recipe, i (recipe.id)}
            <div use:surface={{ delay: Math.min(i, 8) * 40 }}>
              <Card>
                <Stack gap="var(--space-xs)">
                  <Stack direction="horizontal" gap="var(--space-xs)" align="center">
                    <Badge variant={recipe.method === "transform" ? "warn" : "accent"}>{recipe.method}</Badge>
                    <Label color="muted">#{recipe.id}</Label>
                  </Stack>

                  <div class="formula">
                    <div class="ingredients">
                      {#each recipe.ingredients as ing, idx}
                        <Badge>{ing}</Badge>
                        {#if idx !== recipe.ingredients.length - 1}<span class="plus">+</span>{/if}
                      {/each}
                    </div>
                    <span class="arrow">→</span>
                    <Badge variant="signal">×{recipe.output.qty} {recipe.output.id}</Badge>
                  </div>
                </Stack>
              </Card>
            </div>
          {/each}
        </Grid>
      {/if}
    </Stack>
  {/if}
</div>

<!-- Edit drawer -->
<Drawer open={editDrawerOpen} side="right" width="420px" onclose={() => (editDrawerOpen = false)}>
  {#if editingItem}
    <div class="drawer-inner">
      <CornerBrackets size={16} />
      <Stack direction="horizontal" gap="var(--space-sm)" align="center">
        <StatusDot status="warn" size={6} />
        <Stack gap="0">
          <Text variant="heading" as="h2">{editingItem.name.toLowerCase()}</Text>
          <Label color="muted">#{editingItem.id}</Label>
        </Stack>
      </Stack>

      <Divider />

      <Stack gap="var(--space-md)">
        <Input label="name" bind:value={editingItem.name} />

        <div class="two-col">
          <Select
            label="category"
            options={CATEGORIES.filter((c) => c !== "all").map((c) => ({ value: c, label: c }))}
            bind:value={editingItem.category}
          />
          <Select
            label="rarity"
            options={RARITIES.map((r) => ({ value: r, label: r }))}
            bind:value={editingItem.rarity}
          />
        </div>

        <div class="two-col">
          <Select
            label="trait 1"
            options={TRAITS.map((t) => ({ value: t, label: t }))}
            bind:value={editingItem.trait1}
          />
          <Select
            label="trait 2"
            options={TRAITS.map((t) => ({ value: t, label: t }))}
            bind:value={editingItem.trait2}
          />
        </div>

        <div>
          <Label color="muted">sources</Label>
          <div class="chip-row">
            {#each SOURCES as src}
              <button
                type="button"
                class="chip"
                class:on={editingItem.sources.includes(src)}
                onclick={() => {
                  if (editingItem) editingItem.sources = toggleSource(editingItem.sources, src);
                }}
              >
                {src}
              </button>
            {/each}
          </div>
        </div>

        <Textarea label="description" rows={3} autoresize bind:value={editingItem.description} />

        <Stack direction="horizontal" gap="var(--space-sm)" justify="flex-end">
          <Button variant="ghost" onclick={() => (editDrawerOpen = false)}>cancel</Button>
          <Button
            variant="primary"
            echo
            loading={saving}
            onclick={() => editingItem && saveItem(editingItem)}
          >
            save
          </Button>
        </Stack>
      </Stack>
    </div>
  {/if}
</Drawer>

<!-- Add modal -->
<Modal open={showAddModal} title="add new item" onclose={() => (showAddModal = false)}>
  <Stack gap="var(--space-md)">
    <Input
      label="name"
      placeholder="cursed artifact"
      bind:value={newItem.name}
      oninput={() => {
        if (!newItem.id || newItem.id === autoId(newItem.name.slice(0, -1))) {
          newItem.id = autoId(newItem.name);
        }
      }}
    />
    <Input label="id (auto generated)" placeholder="cursed_artifact" bind:value={newItem.id} />

    <div class="two-col">
      <Select
        label="category"
        options={CATEGORIES.filter((c) => c !== "all").map((c) => ({ value: c, label: c }))}
        bind:value={newItem.category}
      />
      <Select
        label="rarity"
        options={RARITIES.map((r) => ({ value: r, label: r }))}
        bind:value={newItem.rarity}
      />
    </div>

    <div class="two-col">
      <Select
        label="trait 1"
        options={TRAITS.map((t) => ({ value: t, label: t }))}
        bind:value={newItem.trait1}
      />
      <Select
        label="trait 2"
        options={TRAITS.map((t) => ({ value: t, label: t }))}
        bind:value={newItem.trait2}
      />
    </div>

    <div>
      <Label color="muted">sources</Label>
      <div class="chip-row">
        {#each SOURCES as src}
          <button
            type="button"
            class="chip"
            class:on={newItem.sources.includes(src)}
            onclick={() => (newItem.sources = toggleSource(newItem.sources, src))}
          >
            {src}
          </button>
        {/each}
      </div>
    </div>

    <Textarea
      label="description"
      rows={3}
      autoresize
      placeholder="a grim sentence about what this item is."
      bind:value={newItem.description}
    />
  </Stack>

  {#snippet footer()}
    <Stack direction="horizontal" gap="var(--space-sm)" justify="flex-end">
      <Button variant="ghost" onclick={() => (showAddModal = false)}>cancel</Button>
      <Button variant="primary" echo loading={saving} onclick={addItem}>add item</Button>
    </Stack>
  {/snippet}
</Modal>

<!-- Delete confirm -->
<ConfirmDialog
  open={!!deleteCandidate}
  title={`remove ${deleteCandidate?.id ?? "item"}`}
  description="this clears the entry from the registry. it cannot be undone."
  confirmLabel="remove"
  cancelLabel="keep"
  destructive
  onconfirm={() => deleteCandidate && deleteItem(deleteCandidate.id)}
  oncancel={() => (deleteCandidate = null)}
/>

<style>
  .page {
    max-width: 80rem;
    margin: 0 auto;
    padding: var(--space-lg) var(--space-lg) var(--space-2xl);
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }
  .grow { flex: 1; min-width: 16rem; }

  .desc {
    margin: 0;
    color: var(--text-soft);
    font-size: 0.92rem;
    line-height: 1.45;
    font-style: italic;
  }

  .card-actions {
    display: flex;
    gap: var(--space-xs);
    margin-top: var(--space-xs);
    padding-top: var(--space-xs);
    border-top: 1px solid var(--line);
  }

  .formula {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm);
    border: 1px solid var(--line);
    background: var(--bg-elev-soft);
  }
  .ingredients {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2xs);
    align-items: center;
    flex: 1;
    min-width: 0;
  }
  .plus, .arrow {
    font-family: var(--font-mono);
    color: var(--muted);
  }

  .drawer-inner {
    position: relative;
    padding: var(--space-lg);
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-sm);
  }
  @media (max-width: 40rem) {
    .two-col { grid-template-columns: 1fr; }
  }

  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2xs);
    margin-top: var(--space-2xs);
  }
  .chip {
    padding: var(--space-2xs) var(--space-sm);
    border: 1px solid var(--line);
    background: transparent;
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: 0.78rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted-strong);
    transition: border-color var(--transition-fast), color var(--transition-fast);
  }
  .chip:hover { border-color: var(--accent); color: var(--accent); }
  .chip.on {
    border-color: var(--accent);
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 12%, transparent);
  }
</style>
