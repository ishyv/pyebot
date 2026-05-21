<script lang="ts">
import { Button, Input, Label, Textarea, Toggle } from "@hyvnt/hyvui";
import { EMBED_LIMITS } from "$shared/embed-config";

interface Field {
  name: string;
  value: string;
  inline: boolean;
}

interface Props {
  fields: Field[];
}

let { fields = $bindable([]) }: Props = $props();

const atLimit = $derived(fields.length >= EMBED_LIMITS.fieldCount);

function add(): void {
  if (atLimit) return;
  fields = [...fields, { name: "", value: "", inline: false }];
}

function remove(index: number): void {
  fields = fields.filter((_, i) => i !== index);
}

function duplicate(index: number): void {
  if (atLimit) return;
  const copy = { ...fields[index] };
  fields = [...fields.slice(0, index + 1), copy, ...fields.slice(index + 1)];
}

function move(index: number, delta: number): void {
  const target = index + delta;
  if (target < 0 || target >= fields.length) return;
  const next = [...fields];
  [next[index], next[target]] = [next[target], next[index]];
  fields = next;
}
</script>

<div class="field-editor">
  <div class="head">
    <Label color="muted">fields</Label>
    <span class="count" class:over={atLimit}>{fields.length}/{EMBED_LIMITS.fieldCount}</span>
  </div>

  {#if fields.length === 0}
    <p class="empty">no fields. embeds can have up to {EMBED_LIMITS.fieldCount} fields.</p>
  {/if}

  <ul class="rows">
    {#each fields as field, i (i)}
      <li class="row">
        <div class="row-top">
          <Input bind:value={field.name} placeholder="field name" />
          <div class="row-controls">
            <Toggle bind:checked={field.inline} label="inline" />
            <Button type="button" variant="ghost" size="sm" onclick={() => move(i, -1)} disabled={i === 0}>
              up
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onclick={() => move(i, 1)}
              disabled={i === fields.length - 1}
            >
              down
            </Button>
            <Button type="button" variant="ghost" size="sm" onclick={() => duplicate(i)} disabled={atLimit}>
              copy
            </Button>
            <Button type="button" variant="destructive" size="sm" onclick={() => remove(i)}>remove</Button>
          </div>
        </div>
        <Textarea bind:value={field.value} placeholder="field value" rows={2} />
        <div class="meters">
          <span class:over={field.name.length > EMBED_LIMITS.fieldName}>
            name {field.name.length}/{EMBED_LIMITS.fieldName}
          </span>
          <span class:over={field.value.length > EMBED_LIMITS.fieldValue}>
            value {field.value.length}/{EMBED_LIMITS.fieldValue}
          </span>
        </div>
      </li>
    {/each}
  </ul>

  <Button type="button" variant="ghost" size="sm" onclick={add} disabled={atLimit}>add field</Button>
</div>

<style>
  .field-editor {
    display: grid;
    gap: var(--space-sm);
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .count {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    letter-spacing: 0.08em;
    color: var(--text-soft);
  }
  .count.over,
  .meters .over {
    color: var(--status-fail);
  }
  .empty {
    margin: 0;
    color: var(--text-soft);
    font-family: var(--font-body);
    font-size: 0.92rem;
  }
  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-sm);
  }
  .row {
    display: grid;
    gap: var(--space-2xs);
    padding: var(--space-sm);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
  }
  .row-top {
    display: flex;
    gap: var(--space-sm);
    align-items: center;
    flex-wrap: wrap;
  }
  .row-top :global(input) {
    flex: 1;
    min-width: 12rem;
  }
  .row-controls {
    display: flex;
    gap: var(--space-2xs);
    align-items: center;
    flex-wrap: wrap;
  }
  .meters {
    display: flex;
    gap: var(--space-md);
    font-family: var(--font-mono);
    font-size: 0.72rem;
    letter-spacing: 0.06em;
    color: var(--text-soft);
  }
</style>
