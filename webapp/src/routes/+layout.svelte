<script lang="ts">
import "../app.css";
import { AppShell, ArcaneVein, GridOverlay, HexGrid, ShimmerCloud, Toast } from "@hyvnt/hyvui";
import { fade } from "svelte/transition";
import { page } from "$app/stores";

interface Props {
  children: import("svelte").Snippet;
}

const { children }: Props = $props();

// Theme register (hextech | arcane) is declared per-route via `+page.server.ts`
// returning `{ register }`. Rendered as a wrapping data-register div so the
// theme is part of SSR output, eliminating first-paint flash.
const themeRegister = $derived<string | null>(
  ($page.data as { register?: string } | undefined)?.register ?? null,
);
</script>

<!-- AppShell sets mission-control weight register on <body> + Vignette overlay.
     loadFonts=false because app.html pre-establishes the IBM Plex Mono link. -->
<AppShell register="mission-control" loadFonts={false}>
  {#if themeRegister === "hextech"}
    <div data-register="hextech" class="theme-scope">
      <div class="ambient" aria-hidden="true"><HexGrid /></div>
      {#key $page.url.pathname}
        <div in:fade={{ duration: 180 }}>{@render children()}</div>
      {/key}
    </div>
  {:else if themeRegister === "arcane"}
    <div data-register="arcane" class="theme-scope">
      <div class="ambient" aria-hidden="true">
        <ShimmerCloud />
        <ArcaneVein x1="4%" y1="18%" x2="96%" y2="22%" />
        <ArcaneVein x1="4%" y1="78%" x2="96%" y2="82%" />
      </div>
      {#key $page.url.pathname}
        <div in:fade={{ duration: 180 }}>{@render children()}</div>
      {/key}
    </div>
  {:else}
    <div class="base-scope">
      <div class="ambient ambient-base" aria-hidden="true"><GridOverlay /></div>
      {#key $page.url.pathname}
        <div in:fade={{ duration: 180 }}>{@render children()}</div>
      {/key}
    </div>
  {/if}
  <Toast />
</AppShell>

<style>
  /* Theme/base scope wraps the page subtree so ambient layers anchor to the
     viewport. position: relative is required by HyvUI's ambient primitives. */
  .theme-scope, .base-scope {
    position: relative;
    min-height: 100dvh;
  }

  /* Ambient layer pinned to the viewport behind page content. pointer-events
     off so it never intercepts clicks. z-index: 0 keeps it behind page chrome. */
  .ambient {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
  }
  /* HyvUI ambient primitives expect position:absolute inside a relative parent.
     The .ambient container is fixed, which serves the same purpose for visual
     anchoring; force absolute on its children so they fill it. */
  .ambient :global(> *) {
    position: absolute;
    inset: 0;
  }

  /* GridOverlay reads --reg-ornament-opacity. Base register has no override
     value so the bumped theme.css value (0.42) drives it. */
  .ambient-base { opacity: 0.55; }
</style>
