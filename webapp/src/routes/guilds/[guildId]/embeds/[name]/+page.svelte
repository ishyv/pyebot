<script lang="ts">
import {
  Button,
  ConfirmDialog,
  Input,
  PageHeader,
  Panel,
  resolve,
  type ResolveStatus,
  Select,
  Stack,
  surface,
  Textarea,
  Toggle,
  toastStore,
} from "@hyvnt/hyvui";
import { EMBED_LIMITS, EmbedDraftInputSchema, embedTotalLength } from "$shared/embed-config";
import { untrack } from "svelte";
import { enhance } from "$app/forms";
import { page } from "$app/state";
import ChannelSelect from "$lib/components/ChannelSelect.svelte";
import EmbedFieldEditor from "$lib/components/EmbedFieldEditor.svelte";
import EmbedPreview from "$lib/components/EmbedPreview.svelte";
import FormField from "$lib/components/FormField.svelte";
import type { PageData } from "./$types";

interface Props {
  data: PageData;
}

const { data }: Props = $props();
const guildId = $derived(page.params.guildId);

const embed = untrack(() => data.embed);

function intToHex(n: number | null): string {
  if (n === null) return "";
  return `#${(n >>> 0).toString(16).padStart(6, "0").slice(-6)}`;
}
function hexToInt(hex: string): number | null {
  const h = hex.replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return Number.parseInt(h, 16);
}
const nn = (v: string): string | null => (v.trim().length > 0 ? v.trim() : null);

// Discord blurple, kept as a number so no raw hex string lives in source.
const DEFAULT_SWATCH = intToHex(0x5865f2);

// --- editable state, seeded once from the loader ---
let title = $state(embed.embedTitle ?? "");
let description = $state(embed.embedDescription ?? "");
let colorHex = $state(intToHex(embed.embedColor));
let url = $state(embed.embedUrl ?? "");
let thumbnail = $state(embed.embedThumbnail ?? "");
let image = $state(embed.embedImage ?? "");
let authorName = $state(embed.embedAuthorName ?? "");
let authorIconUrl = $state(embed.embedAuthorIconUrl ?? "");
let authorUrl = $state(embed.embedAuthorUrl ?? "");
let footerText = $state(embed.embedFooterText ?? "");
let footerIconUrl = $state(embed.embedFooterIconUrl ?? "");
let fields = $state(embed.embedFields.map((f) => ({ name: f.name, value: f.value, inline: f.inline })));
let channelId = $state(embed.channelId ?? "");
let scheduleInterval = $state(
  embed.scheduleEnabled && embed.scheduleIntervalHours ? String(embed.scheduleIntervalHours) : "off",
);
let sticky = $state(embed.stickyEnabled);
let script = $state(embed.script ?? "");
let scriptEnabled = $state(embed.scriptEnabled);

let saving = $state(false);
let dialog = $state<"send" | "delete" | null>(null);
let saveResolve: { trigger: (s: ResolveStatus) => void } | undefined;

const scheduleOptions = [
  { value: "off", label: "off" },
  { value: "1", label: "every hour" },
  { value: "6", label: "every 6h" },
  { value: "12", label: "every 12h" },
  { value: "24", label: "daily" },
  { value: "168", label: "weekly" },
];

const colorInt = $derived(hexToInt(colorHex));
const cleanFields = $derived(
  fields.filter((f) => f.name.trim() !== "" || f.value.trim() !== ""),
);
const fieldsJson = $derived(JSON.stringify(fields));

const totalChars = $derived(
  embedTotalLength({
    embedTitle: nn(title),
    embedDescription: nn(description),
    embedAuthorName: nn(authorName),
    embedFooterText: nn(footerText),
    embedFields: cleanFields,
  }),
);
const overTotal = $derived(totalChars > EMBED_LIMITS.total);

const validation = $derived(
  EmbedDraftInputSchema.safeParse({
    embedTitle: nn(title),
    embedDescription: nn(description),
    embedColor: colorInt,
    embedUrl: nn(url),
    embedThumbnail: nn(thumbnail),
    embedImage: nn(image),
    embedAuthorName: nn(authorName),
    embedAuthorIconUrl: nn(authorIconUrl),
    embedAuthorUrl: nn(authorUrl),
    embedFooterText: nn(footerText),
    embedFooterIconUrl: nn(footerIconUrl),
    embedFields: cleanFields,
  }),
);
const warnings = $derived(validation.success ? [] : validation.error.issues.map((i) => i.message));
</script>

<svelte:head><title>edit embed · {embed.name}</title></svelte:head>

<Stack gap="var(--space-lg)">
  <div class="topline">
    <PageHeader title={`embed: ${embed.name}`} subtitle="edit the embed, then save and send it." />
    <Button variant="ghost" size="sm" href={`/guilds/${guildId}/embeds`}>back to list</Button>
  </div>

  <div class="layout">
    <!-- LEFT: editor form -->
    <form
      method="POST"
      action="?/save"
      use:resolve={(a) => (saveResolve = a)}
      use:enhance={() => {
        saving = true;
        return async ({ result, update }) => {
          saving = false;
          if (result.type === "success") {
            saveResolve?.trigger("ok");
            toastStore.push("embed saved", "ok");
          } else {
            saveResolve?.trigger("fail");
            toastStore.push(
              result.type === "failure" ? String(result.data?.error ?? "save failed") : "save failed",
              "fail",
            );
          }
          await update({ reset: false });
        };
      }}
    >
      <Stack gap="var(--space-md)">
        <div use:surface={{ delay: 0 }}>
          <Panel withInset>
            {#snippet header()}<span class="panel-title">content</span>{/snippet}
            <FormField label="title">
              <Input bind:value={title} placeholder="embed title" />
              <input type="hidden" name="title" value={title} />
            </FormField>
            <FormField label="description" description="supports basic markdown: **bold**, *italic*, `code`, [links](url).">
              <Textarea bind:value={description} rows={5} placeholder="embed description" />
              <input type="hidden" name="description" value={description} />
            </FormField>
            <FormField label="color">
              <div class="color-row">
                <input class="swatch" type="color" value={colorHex || DEFAULT_SWATCH} oninput={(e) => (colorHex = (e.target as HTMLInputElement).value)} />
                <Input bind:value={colorHex} placeholder="#rrggbb" />
                {#if colorHex}
                  <Button type="button" variant="ghost" size="sm" onclick={() => (colorHex = "")}>clear</Button>
                {/if}
              </div>
              <input type="hidden" name="color" value={colorHex} />
            </FormField>
          </Panel>
        </div>

        <div use:surface={{ delay: 40 }}>
          <Panel withInset>
            {#snippet header()}<span class="panel-title">media</span>{/snippet}
            <FormField label="thumbnail url">
              <Input bind:value={thumbnail} placeholder="https://..." />
              <input type="hidden" name="thumbnail" value={thumbnail} />
            </FormField>
            <FormField label="image url">
              <Input bind:value={image} placeholder="https://..." />
              <input type="hidden" name="image" value={image} />
            </FormField>
            <FormField label="title url" description="makes the title a clickable link.">
              <Input bind:value={url} placeholder="https://..." />
              <input type="hidden" name="url" value={url} />
            </FormField>
          </Panel>
        </div>

        <div use:surface={{ delay: 80 }}>
          <Panel withInset>
            {#snippet header()}<span class="panel-title">author</span>{/snippet}
            <FormField label="author name">
              <Input bind:value={authorName} placeholder="author" />
              <input type="hidden" name="authorName" value={authorName} />
            </FormField>
            <FormField label="author icon url">
              <Input bind:value={authorIconUrl} placeholder="https://..." />
              <input type="hidden" name="authorIconUrl" value={authorIconUrl} />
            </FormField>
            <FormField label="author url">
              <Input bind:value={authorUrl} placeholder="https://..." />
              <input type="hidden" name="authorUrl" value={authorUrl} />
            </FormField>
          </Panel>
        </div>

        <div use:surface={{ delay: 120 }}>
          <Panel withInset>
            {#snippet header()}<span class="panel-title">fields</span>{/snippet}
            <EmbedFieldEditor bind:fields />
            <input type="hidden" name="fields" value={fieldsJson} />
          </Panel>
        </div>

        <div use:surface={{ delay: 160 }}>
          <Panel withInset>
            {#snippet header()}<span class="panel-title">footer</span>{/snippet}
            <FormField label="footer text">
              <Input bind:value={footerText} placeholder="footer" />
              <input type="hidden" name="footerText" value={footerText} />
            </FormField>
            <FormField label="footer icon url">
              <Input bind:value={footerIconUrl} placeholder="https://..." />
              <input type="hidden" name="footerIconUrl" value={footerIconUrl} />
            </FormField>
          </Panel>
        </div>

        <div use:surface={{ delay: 200 }}>
          <Panel withInset>
            {#snippet header()}<span class="panel-title">delivery</span>{/snippet}
            <FormField label="target channel" description="where send and schedule post the embed.">
              <ChannelSelect name="channelId" bind:value={channelId} channels={data.channels} types={["text"]} />
              <input type="hidden" name="channelId" value={channelId} />
            </FormField>
            <FormField label="schedule" description="repost automatically on this interval.">
              <Select bind:value={scheduleInterval} options={scheduleOptions} />
              <input type="hidden" name="scheduleInterval" value={scheduleInterval} />
            </FormField>
            <FormField label="sticky" description="re-post to the bottom of the channel as new messages arrive.">
              <Toggle bind:checked={sticky} label={sticky ? "enabled" : "disabled"} />
              <input type="hidden" name="sticky" value={sticky ? "on" : ""} />
            </FormField>
          </Panel>
        </div>

        <div use:surface={{ delay: 240 }}>
          <Panel withInset>
            {#snippet header()}<span class="panel-title">advanced</span>{/snippet}
            <details class="advanced">
              <summary>script (runs at send time)</summary>
              <p class="note">
                a javascript function body that can override title, description, color, footer, and
                append fields when the embed is sent. it runs in the bot, so its output is not shown
                in the preview here.
              </p>
              <FormField label="enable script">
                <Toggle bind:checked={scriptEnabled} label={scriptEnabled ? "enabled" : "disabled"} />
                <input type="hidden" name="scriptEnabled" value={scriptEnabled ? "on" : ""} />
              </FormField>
              <FormField label="script">
                <Textarea bind:value={script} rows={6} placeholder="a function of ctx returning title, description, color, footer, fields" />
                <input type="hidden" name="script" value={script} />
              </FormField>
            </details>
          </Panel>
        </div>
      </Stack>

      <div class="actions">
        <Button type="button" variant="destructive" size="sm" onclick={() => (dialog = "delete")}>
          delete
        </Button>
        <div class="actions-right">
          <Button type="button" variant="ghost" onclick={() => (dialog = "send")}>send now</Button>
          <Button type="submit" variant="primary" disabled={saving || !validation.success} echo>
            {saving ? "saving" : "save"}
          </Button>
        </div>
      </div>
    </form>

    <!-- RIGHT: live preview -->
    <div class="preview-col" use:surface={{ delay: 0 }}>
      <Panel>
        {#snippet header()}<span class="panel-title">preview</span>{/snippet}
        <EmbedPreview
          title={nn(title)}
          description={nn(description)}
          color={colorInt}
          url={nn(url)}
          thumbnail={nn(thumbnail)}
          image={nn(image)}
          authorName={nn(authorName)}
          authorIconUrl={nn(authorIconUrl)}
          authorUrl={nn(authorUrl)}
          footerText={nn(footerText)}
          footerIconUrl={nn(footerIconUrl)}
          fields={cleanFields}
        />
        <div class="meter" class:over={overTotal}>
          total {totalChars}/{EMBED_LIMITS.total} characters
        </div>
        {#if warnings.length > 0}
          <ul class="warnings">
            {#each warnings as w (w)}<li>{w}</li>{/each}
          </ul>
        {/if}
      </Panel>
    </div>
  </div>
</Stack>

<!-- Hidden forms for the confirm dialogs. Send/delete act on the saved version. -->
<form method="POST" action="?/send" id="embed-send-form" use:enhance={() => {
  return async ({ result, update }) => {
    if (result.type === "success") toastStore.push("embed sent", "ok");
    else if (result.type === "failure") toastStore.push(String(result.data?.error ?? "send failed"), "fail");
    dialog = null;
    await update();
  };
}}></form>

<form method="POST" action="?/delete" id="embed-delete-form" use:enhance></form>

<ConfirmDialog
  open={dialog === "send"}
  title={`send ${embed.name}`}
  description="this posts the last saved version to its target channel. save first if you have unsaved changes."
  confirmLabel="send now"
  cancelLabel="cancel"
  onconfirm={() => (document.getElementById("embed-send-form") as HTMLFormElement | null)?.requestSubmit()}
  oncancel={() => (dialog = null)}
/>

<ConfirmDialog
  open={dialog === "delete"}
  title={`delete ${embed.name}`}
  description="this removes the saved embed. it cannot be undone."
  confirmLabel="delete"
  cancelLabel="keep"
  destructive
  onconfirm={() => (document.getElementById("embed-delete-form") as HTMLFormElement | null)?.requestSubmit()}
  oncancel={() => (dialog = null)}
/>

<style>
  .topline {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-md);
  }
  .layout {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-lg);
  }
  @media (min-width: 80rem) {
    .layout {
      grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
      align-items: start;
    }
  }
  .panel-title {
    font-family: var(--font-mono);
    font-size: 0.88rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text);
  }
  .color-row {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }
  .color-row :global(input[type="text"]) {
    flex: 1;
  }
  .swatch {
    width: 2.5rem;
    height: 2.5rem;
    padding: 0;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: none;
    cursor: pointer;
  }
  .advanced summary {
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: 0.82rem;
    letter-spacing: 0.08em;
    color: var(--text-soft);
    margin-bottom: var(--space-sm);
  }
  .note {
    margin: 0 0 var(--space-sm);
    color: var(--text-soft);
    font-family: var(--font-body);
    font-size: 0.9rem;
    line-height: 1.45;
    max-width: 60ch;
  }
  .actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-sm);
    margin-top: var(--space-md);
    padding-top: var(--space-sm);
    border-top: 1px solid var(--line);
  }
  .actions-right {
    display: flex;
    gap: var(--space-xs);
  }
  .preview-col {
    position: sticky;
    top: var(--space-md);
  }
  .meter {
    margin-top: var(--space-sm);
    font-family: var(--font-mono);
    font-size: 0.78rem;
    letter-spacing: 0.08em;
    color: var(--text-soft);
  }
  .meter.over {
    color: var(--status-fail);
  }
  .warnings {
    margin: var(--space-sm) 0 0;
    padding-left: 1.1rem;
    color: var(--status-fail);
    font-family: var(--font-mono);
    font-size: 0.76rem;
    letter-spacing: 0.04em;
    display: grid;
    gap: var(--space-2xs);
  }
</style>
