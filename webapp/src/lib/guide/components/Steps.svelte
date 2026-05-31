<script lang="ts">
// Numbered, connected step list for "set it up" sequences.
// Each step is plain text; keep them short and lowercase.
interface Props {
  steps: readonly string[];
}
const { steps }: Props = $props();
</script>

<ol class="steps">
  {#each steps as step, i (i)}
    <li>
      <span class="num">{i + 1}</span>
      <span class="text">{step}</span>
    </li>
  {/each}
</ol>

<style>
  .steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-sm); }
  li { display: grid; grid-template-columns: auto 1fr; gap: var(--space-sm); align-items: start; }
  .num {
    display: inline-grid; place-items: center;
    width: 1.5rem; height: 1.5rem;
    border: 1px solid var(--accent); border-radius: 999px;
    color: var(--accent); font-family: var(--font-mono); font-size: 0.82rem;
  }
  .text { font-size: 0.92rem; line-height: 1.5; padding-top: 0.15rem; }
</style>
