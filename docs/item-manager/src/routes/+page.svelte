<script lang="ts">
import {
  Badge,
  Button,
  Card,
  Divider,
  Drawer,
  Grid,
  Input,
  Label,
  MetricCard,
  Modal,
  PageHeader,
  Select,
  Stack,
  Tabs,
  Text,
  Textarea,
  toastStore,
} from "@hyvnt/hyvui";
import { onMount } from "svelte";

// ── Types ────────────────────────────────────────────────────────────
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
];

const TRAITS = ["Density", "Sharpness", "Organic", "Toxicity", "Magic", "Liquid", "None"];
const RARITIES = ["common", "uncommon", "rare", "legendary"];
const SOURCES = ["gather", "expedition", "craft", "drop", "quest", "shop"];

// ── Icon maps ────────────────────────────────────────────────────────

/** SVG path data for each category icon */
const CATEGORY_ICONS: Record<string, string> = {
  mineral: `<path d="M19 3H5C3.9 3 3 3.9 3 5v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l7.59-7.59L21 8l-9 9z" fill="currentColor"/>`,
  // better icons
};

/** Emoji-style icon per category */
const CAT_ICON: Record<string, string> = {
  all: "◈",
  mineral: "💎",
  timber: "🪵",
  herb: "🌿",
  animal: "🦴",
  reagent: "⚗️",
  medical: "🩹",
  component: "⚙️",
  tool: "🔧",
  weapon: "⚔️",
  armor: "🛡️",
  artifact: "🔮",
  misc: "📦",
};

/** Color for each category (CSS color string) */
const CAT_COLOR: Record<string, string> = {
  all: "var(--text-soft)",
  mineral: "#7dd3fc", // sky blue
  timber: "#86efac", // sage green
  herb: "#4ade80", // bright green
  animal: "#fb923c", // orange
  reagent: "#a78bfa", // violet
  medical: "#34d399", // teal
  component: "#94a3b8", // slate
  tool: "#fbbf24", // amber
  weapon: "#f87171", // red
  armor: "#60a5fa", // blue
  artifact: "#c084fc", // purple
  misc: "#9ca3af", // grey
};

/** Trait icon (emoji) */
const TRAIT_ICON: Record<string, string> = {
  Density: "⚖️",
  Sharpness: "🗡️",
  Organic: "🌱",
  Toxicity: "☠️",
  Magic: "✨",
  Liquid: "💧",
  None: "—",
};

/** Trait color */
const TRAIT_COLOR: Record<string, string> = {
  Density: "#94a3b8", // slate
  Sharpness: "#f87171", // red
  Organic: "#4ade80", // green
  Toxicity: "#a3e635", // lime-ish
  Magic: "#c084fc", // purple
  Liquid: "#38bdf8", // sky
  None: "#374151", // dark grey
};

/** Rarity metadata */
const RARITY_META: Record<string, { label: string; color: string; glow: string; icon: string }> = {
  common: { label: "Common", color: "#6b7280", glow: "rgba(107,114,128,0.15)", icon: "○" },
  uncommon: { label: "Uncommon", color: "#22c55e", glow: "rgba(34,197,94,0.15)", icon: "◆" },
  rare: { label: "Rare", color: "#3b82f6", glow: "rgba(59,130,246,0.15)", icon: "◈" },
  legendary: { label: "Legendary", color: "#f59e0b", glow: "rgba(245,158,11,0.25)", icon: "★" },
};

// ── State ────────────────────────────────────────────────────────────
let items: ItemDef[] = $state([]);
let loading = $state(true);
let searchQuery = $state("");
let activeCategory = $state("all");
let showAddModal = $state(false);
let editDrawerOpen = $state(false);
let editingItem: ItemDef | null = $state(null);
let saving = $state(false);
let deleteConfirmId: string | null = $state(null);

let newItem: ItemDef = $state({
  id: "",
  name: "",
  category: "mineral",
  rarity: "common",
  trait1: "None",
  trait2: "None",
  sources: [],
  description: "",
});

// -- Recipe State --
let recipes: any[] = $state([]);
let activeTab: "registry" | "recipes" = $state("registry");
let recipeSearch = $state("");

// ── Derived ──────────────────────────────────────────────────────────
let filteredItems = $derived.by(() => {
  let result = items;
  if (activeCategory !== "all") result = result.filter((i) => i.category === activeCategory);
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
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

let filteredRecipes = $derived.by(() => {
  if (!recipeSearch.trim()) return recipes;
  const q = recipeSearch.toLowerCase();
  return recipes.filter(
    (r) =>
      r.id.toLowerCase().includes(q) ||
      r.output.id.toLowerCase().includes(q) ||
      r.ingredients.some((i: string) => i.toLowerCase().includes(q)),
  );
});

let categoryCounts = $derived.by(() => {
  const counts: Record<string, number> = {};
  for (const cat of CATEGORIES) {
    counts[cat] = cat === "all" ? items.length : items.filter((i) => i.category === cat).length;
  }
  return counts;
});

let rarityCounts = $derived.by(() => {
  const counts: Record<string, number> = {};
  for (const r of RARITIES) counts[r] = items.filter((i) => i.rarity === r).length;
  return counts;
});

// ── API ──────────────────────────────────────────────────────────────
async function loadItems() {
  loading = true;
  try {
    const res = await fetch("/api/items");
    const data = await res.json();

    if (Array.isArray(data.items)) {
      items = data.items;
    } else {
      toastStore.push(data.error ?? "Failed to load items", "fail");
      items = [];
    }
  } catch (err) {
    console.error("Failed to load items", err);
    toastStore.push("Failed to load items: " + err, "fail");
    items = [];
  } finally {
    loading = false;
  }
}

async function loadRecipes() {
  try {
    const res = await fetch("/api/recipes");
    const data = await res.json();
    recipes = Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("Failed to load recipes", err);
  }
}

async function saveItem(item: ItemDef) {
  saving = true;
  try {
    const res = await fetch(`/api/items/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });
    const data = await res.json();
    if (data.success) {
      toastStore.push(`"${item.name}" saved`, "ok");
      await loadItems();
      editDrawerOpen = false;
      editingItem = null;
    } else {
      toastStore.push(data.error, "fail");
    }
  } catch (err) {
    toastStore.push("Save failed: " + err, "fail");
  } finally {
    saving = false;
  }
}

async function addItem() {
  if (!newItem.id || !newItem.name) {
    toastStore.push("ID and Name are required", "warn");
    return;
  }
  saving = true;
  try {
    const res = await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newItem),
    });
    const data = await res.json();
    if (data.success) {
      toastStore.push(`"${newItem.name}" added`, "ok");
      showAddModal = false;
      resetNewItem();
      await loadItems();
    } else {
      toastStore.push(data.error, "fail");
    }
  } catch (err) {
    toastStore.push("Add failed: " + err, "fail");
  } finally {
    saving = false;
  }
}

async function deleteItem(id: string) {
  try {
    const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) {
      toastStore.push(`"${id}" removed`, "ok");
      deleteConfirmId = null;
      await loadItems();
    } else {
      toastStore.push(data.error, "fail");
    }
  } catch (err) {
    toastStore.push("Delete failed: " + err, "fail");
  }
}

function resetNewItem() {
  newItem = {
    id: "",
    name: "",
    category: "mineral",
    rarity: "common",
    trait1: "None",
    trait2: "None",
    sources: [],
    description: "",
  };
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
  loadItems();
  loadRecipes();
});
</script>

<svelte:head>
	<title>Ashenmoor Item Registry — {items.length} items</title>
</svelte:head>

<div class="page-root">
	<!-- ── Tab Switcher ─────────────────────────────────────────────── -->
	<div class="main-tabs">
		<button class="main-tab" class:active={activeTab === 'registry'} onclick={() => activeTab = 'registry'}>
			<span>🗃️</span> Item Registry
		</button>
		<button class="main-tab" class:active={activeTab === 'recipes'} onclick={() => activeTab = 'recipes'}>
			<span>⚒️</span> Crafting Recipes
		</button>
	</div>

	{#if activeTab === 'registry'}
		<!-- ── Rarity Metrics ─────────────────────────────────────────────── -->
		<div class="metrics-row">
			<div class="metric-pill" style="border-color: var(--line);">
				<span class="metric-num">{items.length}</span>
				<span class="metric-lab">total items</span>
			</div>
			{#each RARITIES as r}
				{@const meta = RARITY_META[r]!}
				<div class="metric-pill" style="border-color: {meta.color}33; background: {meta.glow};">
					<span class="metric-icon" style="color: {meta.color};">{meta.icon}</span>
					<span class="metric-num" style="color: {meta.color};">{rarityCounts[r] ?? 0}</span>
					<span class="metric-lab">{meta.label}</span>
				</div>
			{/each}
		</div>

		<!-- ── Search + count ─────────────────────────────────────────────── -->
		<div class="search-row">
			<div style="flex: 1; min-width: 240px;">
				<Input label="search" placeholder="name, trait, description…" bind:value={searchQuery} />
			</div>
			<Label color="muted">{filteredItems.length} shown</Label>
		</div>

		<!-- ── Category tabs ─────────────────────────────────────────────── -->
		<div class="tabs-wrap">
			{#each CATEGORIES as cat}
				{@const active = cat === activeCategory}
				{@const color = CAT_COLOR[cat]!}
				<button
					class="cat-tab"
					class:active
					style="--tab-color: {color};"
					onclick={() => (activeCategory = cat)}
				>
					<span class="cat-icon">{CAT_ICON[cat]}</span>
					<span class="cat-label">{cat}</span>
					<span class="cat-count">{categoryCounts[cat] ?? 0}</span>
				</button>
			{/each}
		</div>

		<Divider />

		<!-- ── Item Grid ──────────────────────────────────────────────────── -->
		{#if loading}
			<div class="empty-state"><Label color="muted">loading registry…</Label></div>
		{:else if filteredItems.length === 0}
			<div class="empty-state"><Label color="muted">no items match</Label></div>
		{:else}
			<div class="item-grid">
				{#each filteredItems as item (item.id)}
					{@const rMeta = RARITY_META[item.rarity] ?? RARITY_META.common!}
					{@const catColor = CAT_COLOR[item.category] ?? 'var(--text-soft)'}
	
					<div
						class="item-card"
						style="--rarity-color: {rMeta.color}; --rarity-glow: {rMeta.glow}; --cat-color: {catColor};"
					>
						<!-- Rarity bar at top -->
						<div class="rarity-bar" style="background: {rMeta.color};"></div>
	
						<!-- Card header -->
						<div class="card-head">
							<div class="cat-badge" style="color: {catColor}; background: {catColor}18;">
								<span>{CAT_ICON[item.category] ?? '📦'}</span>
								<span class="cat-badge-label">{item.category}</span>
							</div>
							<div class="rarity-badge" style="color: {rMeta.color}; background: {rMeta.glow};">
								<span>{rMeta.icon}</span>
								<span>{rMeta.label}</span>
							</div>
						</div>
	
						<!-- Item name -->
						<div class="item-name">{item.name}</div>
						<div class="item-id">#{item.id}</div>
	
						<!-- Traits -->
						<div class="traits-row">
							{#each [item.trait1, item.trait2].filter(t => t && t !== 'None') as trait}
								{@const tc = TRAIT_COLOR[trait] ?? '#6b7280'}
								<span class="trait-chip" style="--tc: {tc};">
									<span class="trait-icon">{TRAIT_ICON[trait] ?? '·'}</span>
									<span>{trait}</span>
								</span>
							{/each}
							{#if item.trait1 === 'None' && item.trait2 === 'None'}
								<span class="trait-chip" style="--tc: #374151;">
									<span>— No Traits</span>
								</span>
							{/if}
						</div>
	
						<!-- Description -->
						<p class="item-desc">{item.description}</p>
	
						<!-- Sources -->
						<div class="sources-row">
							{#each item.sources as src}
								<span class="source-chip">{src}</span>
							{/each}
						</div>
	
						<!-- Actions -->
						<div class="card-actions">
							<button class="action-btn edit-btn" onclick={() => openEdit(item)}>
								<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
								edit
							</button>
							{#if deleteConfirmId === item.id}
								<button class="action-btn danger-btn" onclick={() => deleteItem(item.id)}>confirm</button>
								<button class="action-btn ghost-btn" onclick={() => (deleteConfirmId = null)}>cancel</button>
							{:else}
								<button class="action-btn ghost-btn" aria-label="delete item" onclick={() => (deleteConfirmId = item.id)}>
									<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
								</button>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{:else}
		<!-- ── Recipes View ──────────────────────────────────────────────── -->
		<div class="recipes-view">
			<MetricCard label="total recipes" value={recipes.length} />

			<div class="search-row">
				<div style="flex: 1; min-width: 240px;">
					<Input label="search recipes" placeholder="ingredient or output ID…" bind:value={recipeSearch} />
				</div>
				<Label color="muted">{filteredRecipes.length} shown</Label>
			</div>

			{#if recipes.length === 0}
				<div class="empty-state">
					<Label color="muted">no recipes found or failed to parse auto-gen blocks</Label>
				</div>
			{:else}
				<div class="recipe-grid">
					{#each filteredRecipes as recipe}
						<Card>
							<Stack gap="0.5rem">
								<div class="recipe-head">
									<Badge variant={recipe.method === 'transform' ? 'warn' : 'accent'}>{recipe.method}</Badge>
									<span class="recipe-id">#{recipe.id}</span>
								</div>
								
								<div class="recipe-formula">
									<div class="ingredients">
										{#each recipe.ingredients as ing}
											<div class="ing-pill">
												{CAT_ICON[items.find(i => i.id === ing)?.category || 'misc']} {ing}
											</div>
											{#if ing !== recipe.ingredients[recipe.ingredients.length - 1]}
												<span class="plus">+</span>
											{/if}
										{/each}
									</div>
									<div class="arrow">⮕</div>
									<div class="output">
										<div class="out-pill" style="border-color: {RARITY_META[items.find(i => i.id === recipe.output.id)?.rarity || 'common']?.color}">
											<span class="qty">x{recipe.output.qty}</span>
											{recipe.output.id}
										</div>
									</div>
								</div>
							</Stack>
						</Card>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>


<!-- ── Edit Drawer ─────────────────────────────────────────────────────── -->
<Drawer open={editDrawerOpen} side="right" width="400px" onclose={() => (editDrawerOpen = false)}>
	{#if editingItem}
		{@const rMeta = RARITY_META[editingItem.rarity] ?? RARITY_META.common!}
		<div class="drawer-inner">
			<div class="drawer-head" style="border-color: {rMeta.color}40;">
				<span class="drawer-cat-icon" style="color: {CAT_COLOR[editingItem.category] ?? '#aaa'};">
					{CAT_ICON[editingItem.category] ?? '📦'}
				</span>
				<div>
					<Text variant="heading" as="h2">{editingItem.name}</Text>
					<Label color="muted">{editingItem.id}</Label>
				</div>
			</div>

			<Stack gap="1rem">
				<Input label="name" bind:value={editingItem.name} />

				<div class="two-col">
					<Select label="category"
						options={CATEGORIES.filter(c => c !== 'all').map(c => ({ value: c, label: `${CAT_ICON[c]} ${c}` }))}
						bind:value={editingItem.category} />
					<Select label="rarity"
						options={RARITIES.map(r => ({ value: r, label: `${RARITY_META[r]!.icon} ${RARITY_META[r]!.label}` }))}
						bind:value={editingItem.rarity} />
				</div>

				<div class="two-col">
					<Select label="trait 1"
						options={TRAITS.map(t => ({ value: t, label: t !== 'None' ? `${TRAIT_ICON[t]} ${t}` : '— None' }))}
						bind:value={editingItem.trait1} />
					<Select label="trait 2"
						options={TRAITS.map(t => ({ value: t, label: t !== 'None' ? `${TRAIT_ICON[t]} ${t}` : '— None' }))}
						bind:value={editingItem.trait2} />
				</div>

				<div>
					<Label color="muted">sources</Label>
					<div class="source-toggle-row">
						{#each SOURCES as src}
							<button
								class="source-toggle"
								class:active={editingItem.sources.includes(src)}
								onclick={() => { if (editingItem) editingItem.sources = toggleSource(editingItem.sources, src); }}
							>{src}</button>
						{/each}
					</div>
				</div>

				<Textarea label="description" rows={3} autoresize bind:value={editingItem.description} />

				<Divider />

				<Stack direction="horizontal" gap="0.75rem">
					<Button variant="primary" loading={saving} onclick={() => editingItem && saveItem(editingItem)}>
						save changes
					</Button>
					<Button variant="ghost" onclick={() => (editDrawerOpen = false)}>cancel</Button>
				</Stack>
			</Stack>
		</div>
	{/if}
</Drawer>

<!-- ── Add Modal ───────────────────────────────────────────────────────── -->
<Modal open={showAddModal} title="Add New Item" onclose={() => (showAddModal = false)}>
	<Stack gap="1rem">
		<Input label="name" placeholder="Cursed Artifact"
			bind:value={newItem.name}
			oninput={() => { if (!newItem.id || newItem.id === autoId(newItem.name.slice(0,-1))) newItem.id = autoId(newItem.name); }}
		/>
		<Input label="id (auto-generated)" placeholder="cursed_artifact" bind:value={newItem.id} />

		<div class="two-col">
			<Select label="category"
				options={CATEGORIES.filter(c => c !== 'all').map(c => ({ value: c, label: `${CAT_ICON[c]} ${c}` }))}
				bind:value={newItem.category} />
			<Select label="rarity"
				options={RARITIES.map(r => ({ value: r, label: `${RARITY_META[r]!.icon} ${RARITY_META[r]!.label}` }))}
				bind:value={newItem.rarity} />
		</div>

		<div class="two-col">
			<Select label="trait 1"
				options={TRAITS.map(t => ({ value: t, label: t !== 'None' ? `${TRAIT_ICON[t]} ${t}` : '— None' }))}
				bind:value={newItem.trait1} />
			<Select label="trait 2"
				options={TRAITS.map(t => ({ value: t, label: t !== 'None' ? `${TRAIT_ICON[t]} ${t}` : '— None' }))}
				bind:value={newItem.trait2} />
		</div>

		<div>
			<Label color="muted">sources</Label>
			<div class="source-toggle-row">
				{#each SOURCES as src}
					<button
						class="source-toggle"
						class:active={newItem.sources.includes(src)}
						onclick={() => { newItem.sources = toggleSource(newItem.sources, src); }}
					>{src}</button>
				{/each}
			</div>
		</div>

		<Textarea label="description" rows={3} autoresize
			placeholder="A grim sentence about what this item is."
			bind:value={newItem.description} />
	</Stack>

	{#snippet footer()}
		<Stack direction="horizontal" gap="0.75rem" justify="flex-end">
			<Button variant="ghost" onclick={() => (showAddModal = false)}>cancel</Button>
			<Button variant="primary" loading={saving} onclick={addItem}>add item</Button>
		</Stack>
	{/snippet}
</Modal>

<style>
/* ── Layout ─────────────────────────────────────────────────────────────── */
.page-root {
	max-width: 1280px;
	margin: 0 auto;
	padding: 2rem 1.5rem 4rem;
}

.search-row {
	display: flex;
	align-items: flex-end;
	gap: 1rem;
	flex-wrap: wrap;
	margin: 1.25rem 0 1rem;
}

.empty-state {
	padding: 4rem;
	text-align: center;
}

/* ── Rarity Metrics ─────────────────────────────────────────────────────── */
.metrics-row {
	display: flex;
	gap: 0.6rem;
	flex-wrap: wrap;
	margin: 1.5rem 0;
}

.metric-pill {
	display: flex;
	align-items: center;
	gap: 0.4rem;
	padding: 0.5rem 0.9rem;
	border: 1px solid;
	border-radius: var(--radius-sm);
	background: transparent;
	transition: background 0.2s;
}

.metric-icon {
	font-size: 1rem;
	line-height: 1;
}

.metric-num {
	font-family: var(--font-mono);
	font-size: 1.1rem;
	font-weight: 600;
	color: var(--text);
	line-height: 1;
}

.metric-lab {
	font-family: var(--font-mono);
	font-size: 0.65rem;
	text-transform: uppercase;
	letter-spacing: 0.08em;
	color: var(--text-soft);
}

/* ── Category Tabs ──────────────────────────────────────────────────────── */
.tabs-wrap {
	display: flex;
	gap: 0.35rem;
	flex-wrap: wrap;
	margin-bottom: 1rem;
}

.cat-tab {
	display: inline-flex;
	align-items: center;
	gap: 0.35rem;
	padding: 0.3rem 0.7rem;
	border: 1px solid var(--line);
	border-radius: var(--radius-sm);
	background: transparent;
	cursor: pointer;
	color: var(--text-soft);
	font-family: var(--font-mono);
	font-size: 0.72rem;
	text-transform: uppercase;
	letter-spacing: 0.06em;
	transition: border-color 0.15s, color 0.15s, background 0.15s;
}

.cat-tab:hover {
	border-color: var(--tab-color);
	color: var(--tab-color);
	background: color-mix(in srgb, var(--tab-color) 6%, transparent);
}

.cat-tab.active {
	border-color: var(--tab-color);
	color: var(--tab-color);
	background: color-mix(in srgb, var(--tab-color) 10%, transparent);
}

.cat-icon { font-size: 0.85rem; }
.cat-label { font-weight: 500; }
.cat-count {
	font-weight: 700;
	color: inherit;
	opacity: 0.75;
}

/* ── Item Grid ──────────────────────────────────────────────────────────── */
.item-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
	gap: 0.75rem;
	margin-top: 1rem;
}

.item-card {
	position: relative;
	background: var(--bg-elev);
	border: 1px solid var(--line);
	border-radius: var(--radius-md);
	overflow: hidden;
	display: flex;
	flex-direction: column;
	gap: 0.55rem;
	padding: 0 0.9rem 0.9rem;
	transition: border-color 0.2s, box-shadow 0.2s;
}

.item-card:hover {
	border-color: var(--rarity-color);
	box-shadow: 0 0 0 1px var(--rarity-color), 0 4px 24px var(--rarity-glow);
}

/* Thin rarity color bar across the top */
.rarity-bar {
	height: 2px;
	width: 100%;
	margin: 0 -0.9rem;
	width: calc(100% + 1.8rem);
	margin-bottom: 0.1rem;
	opacity: 0.85;
}

/* ── Card header ─────────────────────────────────────────────────────────── */
.card-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.5rem;
	padding-top: 0.6rem;
}

.cat-badge {
	display: inline-flex;
	align-items: center;
	gap: 0.3rem;
	padding: 0.15rem 0.45rem;
	border-radius: var(--radius-sm);
	font-family: var(--font-mono);
	font-size: 0.65rem;
	text-transform: uppercase;
	letter-spacing: 0.07em;
	font-weight: 600;
}

.cat-badge-label { opacity: 0.85; }

.rarity-badge {
	display: inline-flex;
	align-items: center;
	gap: 0.25rem;
	padding: 0.15rem 0.5rem;
	border-radius: var(--radius-sm);
	font-family: var(--font-mono);
	font-size: 0.65rem;
	text-transform: uppercase;
	letter-spacing: 0.07em;
	font-weight: 700;
}

/* ── Item name ──────────────────────────────────────────────────────────── */
.item-name {
	font-size: 0.95rem;
	font-weight: 700;
	color: var(--text);
	line-height: 1.2;
}

.item-id {
	font-family: var(--font-mono);
	font-size: 0.6rem;
	color: var(--muted);
	margin-top: -0.35rem;
}

/* ── Traits ─────────────────────────────────────────────────────────────── */
.traits-row {
	display: flex;
	gap: 0.35rem;
	flex-wrap: wrap;
}

.trait-chip {
	display: inline-flex;
	align-items: center;
	gap: 0.25rem;
	padding: 0.15rem 0.5rem;
	border-radius: calc(var(--radius-sm) / 1.5);
	background: color-mix(in srgb, var(--tc) 14%, transparent);
	border: 1px solid color-mix(in srgb, var(--tc) 30%, transparent);
	font-family: var(--font-mono);
	font-size: 0.65rem;
	color: var(--tc);
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.05em;
}

.trait-icon { font-size: 0.75rem; line-height: 1; }

/* ── Description ─────────────────────────────────────────────────────────── */
.item-desc {
	font-size: 0.78rem;
	color: var(--text-soft);
	line-height: 1.5;
	margin: 0;
	font-style: italic;
}

/* ── Sources ─────────────────────────────────────────────────────────────── */
.sources-row {
	display: flex;
	gap: 0.25rem;
	flex-wrap: wrap;
}

.source-chip {
	padding: 0.1rem 0.4rem;
	border-radius: var(--radius-sm);
	border: 1px solid var(--line);
	font-family: var(--font-mono);
	font-size: 0.6rem;
	color: var(--muted-strong);
	text-transform: uppercase;
	letter-spacing: 0.06em;
}

/* ── Card actions ────────────────────────────────────────────────────────── */
.card-actions {
	display: flex;
	align-items: center;
	gap: 0.35rem;
	margin-top: 0.25rem;
	padding-top: 0.5rem;
	border-top: 1px solid var(--line);
}

.action-btn {
	display: inline-flex;
	align-items: center;
	gap: 0.3rem;
	padding: 0.25rem 0.6rem;
	border-radius: var(--radius-sm);
	border: 1px solid var(--line);
	background: transparent;
	cursor: pointer;
	font-family: var(--font-mono);
	font-size: 0.65rem;
	text-transform: uppercase;
	letter-spacing: 0.06em;
	transition: all 0.15s;
}

.edit-btn {
	color: var(--text-soft);
}
.edit-btn:hover {
	border-color: var(--accent);
	color: var(--accent);
	background: color-mix(in srgb, var(--accent) 8%, transparent);
}

.ghost-btn {
	color: var(--muted-strong);
	margin-left: auto;
}
.ghost-btn:hover {
	border-color: var(--status-fail);
	color: var(--status-fail);
	background: color-mix(in srgb, var(--status-fail) 8%, transparent);
}

.danger-btn {
	margin-left: auto;
	color: var(--status-fail);
	border-color: var(--status-fail);
	background: color-mix(in srgb, var(--status-fail) 10%, transparent);
}
.danger-btn:hover {
	background: color-mix(in srgb, var(--status-fail) 20%, transparent);
}

/* ── Drawer ──────────────────────────────────────────────────────────────── */
.drawer-inner {
	padding: 1.5rem;
	display: flex;
	flex-direction: column;
	gap: 1rem;
}

.drawer-head {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	padding-bottom: 1rem;
	border-bottom: 1px solid;
}

.drawer-cat-icon {
	font-size: 2rem;
	line-height: 1;
}

/* ── Shared helpers ──────────────────────────────────────────────────────── */
.two-col {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 0.75rem;
}

.source-toggle-row {
	display: flex;
	flex-wrap: wrap;
	gap: 0.35rem;
	margin-top: 0.4rem;
}

.source-toggle {
	padding: 0.25rem 0.65rem;
	border-radius: var(--radius-sm);
	border: 1px solid var(--line);
	background: transparent;
	cursor: pointer;
	font-family: var(--font-mono);
	font-size: 0.65rem;
	text-transform: uppercase;
	letter-spacing: 0.06em;
	color: var(--muted-strong);
	transition: all 0.15s;
}

.source-toggle:hover {
	border-color: var(--accent);
	color: var(--accent);
}

.source-toggle.active {
	border-color: var(--accent);
	color: var(--accent);
	background: color-mix(in srgb, var(--accent) 12%, transparent);
	font-weight: 600;
}

/* ── Main Tab Switcher ──────────────────────────────────────────────────── */
.main-tabs {
	display: flex;
	gap: 1rem;
	margin-top: -1rem;
	margin-bottom: 2rem;
	border-bottom: 1px solid var(--line);
	padding-bottom: 0px;
}

.main-tab {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	padding: 0.75rem 1.25rem;
	border: none;
	background: transparent;
	cursor: pointer;
	font-family: var(--font-mono);
	font-size: 0.85rem;
	text-transform: uppercase;
	letter-spacing: 0.05em;
	color: var(--text-soft);
	border-bottom: 2px solid transparent;
	transition: all 0.2s;
}

.main-tab:hover {
	color: var(--text);
}

.main-tab.active {
	color: var(--accent);
	border-color: var(--accent);
	background: color-mix(in srgb, var(--accent) 5%, transparent);
}

/* ── Recipes View ───────────────────────────────────────────────────────── */
.recipe-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(24rem, 1fr));
	gap: 1rem;
	margin-top: 1.5rem;
}

.recipe-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.recipe-id {
	font-family: var(--font-mono);
	font-size: 0.65rem;
	color: var(--muted);
}

.recipe-formula {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	background: var(--bg-deep);
	padding: 0.75rem;
	border-radius: var(--radius-sm);
	border: 1px solid var(--line);
}

.ingredients {
	display: flex;
	flex-wrap: wrap;
	gap: 0.4rem;
	flex: 1;
}

.ing-pill, .out-pill {
	display: inline-flex;
	align-items: center;
	gap: 0.25rem;
	padding: 0.2rem 0.5rem;
	background: var(--bg-elev);
	border: 1px solid var(--line);
	border-radius: var(--radius-sm);
	font-family: var(--font-mono);
	font-size: 0.7rem;
	color: var(--text-soft);
}

.out-pill {
	border-width: 2px;
	color: var(--text);
	font-weight: 600;
}

.qty {
	color: var(--accent);
	font-weight: 800;
}

.plus {
	color: var(--muted);
	font-weight: 900;
}

.arrow {
	color: var(--accent);
	font-weight: 900;
}
</style>
