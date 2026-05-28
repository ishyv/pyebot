<script lang="ts">
import type { ResolveStatus } from "@hyvnt/hyvui";
import {
  Alert,
  Button,
  Badge,
  ConfirmDialog,
  EmptyState,
  Input,
  PageHeader,
  Panel,
  resolve,
  Select,
  Stack,
  surface,
  Toggle,
  toastStore,
} from "@hyvnt/hyvui";
import { untrack } from "svelte";
import { enhance } from "$app/forms";
import ChannelSelect from "$lib/components/ChannelSelect.svelte";
import FormField from "$lib/components/FormField.svelte";
import { enhanceSave, type FieldError, isDirty } from "$lib/forms";
import RolePicker from "$lib/components/RolePicker.svelte";
import type { BannedImageTestResult } from "$shared/bridge-types";
import type { PageData } from "./$types";

interface Props {
  data: PageData;
}

interface SlowRule {
  enabled: boolean;
  roleId: string;
  cooldownSeconds: number;
  durationSeconds: number;
}

const { data }: Props = $props();

// Snapshot loader values once for field seeding. `untrack` makes the intent
// explicit so Svelte 5 doesn't warn about a missed reactive read.
const initialLink = untrack(() => data.linkSpam);
const initialMention = untrack(() => data.mentionSpam);
const initialSlow = untrack(() => data.perUserSlow);
const initialImage = untrack(() => data.imageDetection);

let linkSpamEnabled = $state(initialLink.enabled);
let linkSpamMaxLinks = $state(String(initialLink.maxLinks));
let linkSpamWindowSeconds = $state(String(initialLink.windowSeconds));
let linkSpamReportChannelId = $state(initialLink.reportChannelId);

let mentionSpamEnabled = $state(initialMention.enabled);
let mentionSpamMaxMentions = $state(String(initialMention.maxMentions));
let mentionSpamWindowSeconds = $state(String(initialMention.windowSeconds));

let perUserSlowEnabled = $state(initialSlow.enabled);
let slowRoleId = $state("");
let slowCooldownSeconds = $state("30");
let slowDurationSeconds = $state("3600");
let slowRules = $state<SlowRule[]>(normalizeSlowRules(initialSlow.rules));
let imageDetectionEnabled = $state(initialImage.enabled);
let imageReportChannelId = $state(initialImage.reportChannelId);
let imageTolerance = $state(initialImage.tolerance);
let addImageLabel = $state("");
let addImageReason = $state("");
let imageDrafts = $state<Record<string, { reason: string; label: string }>>({});

let savingLink = $state(false);
let savingMention = $state(false);
let savingSlow = $state(false);
let savingImageSettings = $state(false);
let addingImage = $state(false);
let testingImage = $state(false);
let testResult = $state<BannedImageTestResult | null>(null);
let removeCandidate = $state<{ id: string; label: string } | null>(null);

// `use:resolve` actions trigger a status flash on the form border.
let linkResolve: { trigger: (s: ResolveStatus) => void } | undefined;
let mentionResolve: { trigger: (s: ResolveStatus) => void } | undefined;
let slowResolve: { trigger: (s: ResolveStatus) => void } | undefined;
let imageResolve: { trigger: (s: ResolveStatus) => void } | undefined;

let linkError = $state<FieldError | null>(null);
let mentionError = $state<FieldError | null>(null);
let slowError = $state<FieldError | null>(null);
let imageError = $state<FieldError | null>(null);

// Dirty against the live loader value so a successful save (which reloads
// `data`) clears the marker automatically.
const linkDirty = $derived(
  isDirty(
    {
      enabled: linkSpamEnabled,
      maxLinks: linkSpamMaxLinks,
      windowSeconds: linkSpamWindowSeconds,
      reportChannelId: linkSpamReportChannelId,
    },
    {
      enabled: data.linkSpam.enabled,
      maxLinks: String(data.linkSpam.maxLinks),
      windowSeconds: String(data.linkSpam.windowSeconds),
      reportChannelId: data.linkSpam.reportChannelId,
    },
  ),
);
const mentionDirty = $derived(
  isDirty(
    {
      enabled: mentionSpamEnabled,
      maxMentions: mentionSpamMaxMentions,
      windowSeconds: mentionSpamWindowSeconds,
    },
    {
      enabled: data.mentionSpam.enabled,
      maxMentions: String(data.mentionSpam.maxMentions),
      windowSeconds: String(data.mentionSpam.windowSeconds),
    },
  ),
);
const slowDirty = $derived(
  isDirty(
    { enabled: perUserSlowEnabled, rules: JSON.stringify(slowRules) },
    {
      enabled: data.perUserSlow.enabled,
      rules: JSON.stringify(normalizeSlowRules(data.perUserSlow.rules)),
    },
  ),
);
const imageDirty = $derived(
  isDirty(
    {
      enabled: imageDetectionEnabled,
      reportChannelId: imageReportChannelId,
      tolerance: imageTolerance,
    },
    {
      enabled: data.imageDetection.enabled,
      reportChannelId: data.imageDetection.reportChannelId,
      tolerance: data.imageDetection.tolerance,
    },
  ),
);

function resetLink(): void {
  linkSpamEnabled = data.linkSpam.enabled;
  linkSpamMaxLinks = String(data.linkSpam.maxLinks);
  linkSpamWindowSeconds = String(data.linkSpam.windowSeconds);
  linkSpamReportChannelId = data.linkSpam.reportChannelId;
  linkError = null;
}
function resetMention(): void {
  mentionSpamEnabled = data.mentionSpam.enabled;
  mentionSpamMaxMentions = String(data.mentionSpam.maxMentions);
  mentionSpamWindowSeconds = String(data.mentionSpam.windowSeconds);
  mentionError = null;
}
function resetSlow(): void {
  perUserSlowEnabled = data.perUserSlow.enabled;
  slowRules = normalizeSlowRules(data.perUserSlow.rules);
  slowError = null;
}
function resetImage(): void {
  imageDetectionEnabled = data.imageDetection.enabled;
  imageReportChannelId = data.imageDetection.reportChannelId;
  imageTolerance = data.imageDetection.tolerance;
  imageError = null;
}

const slowRulesJson = $derived(JSON.stringify(slowRules));
const toleranceOptions = [
  { value: "strict", label: "strict" },
  { value: "balanced", label: "balanced" },
  { value: "loose", label: "loose" },
];

function roleNameFor(roleId: string): string {
  return data.roles.find((role) => role.id === roleId)?.name ?? roleId;
}

function normalizeSlowRules(value: unknown): SlowRule[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): SlowRule[] => {
    if (typeof entry !== "object" || entry === null) return [];
    const rule = entry as Record<string, unknown>;
    const roleId = String(rule.roleId ?? "");
    if (!roleId) return [];
    return [
      {
        enabled: Boolean(rule.enabled ?? true),
        roleId,
        cooldownSeconds: Number(rule.cooldownSeconds ?? 30),
        durationSeconds: Number(rule.durationSeconds ?? 3600),
      },
    ];
  });
}

function upsertSlowRule(): void {
  const roleId = slowRoleId.trim();
  const cooldownSeconds = Math.trunc(Number(slowCooldownSeconds));
  const durationSeconds = Math.trunc(Number(slowDurationSeconds));
  if (!roleId || !Number.isFinite(cooldownSeconds) || !Number.isFinite(durationSeconds)) return;
  slowRules = [
    ...slowRules.filter((rule) => rule.roleId !== roleId),
    { enabled: true, roleId, cooldownSeconds, durationSeconds },
  ];
}

function removeSlowRule(roleId: string): void {
  slowRules = slowRules.filter((rule) => rule.roleId !== roleId);
}

function imageLabel(record: PageData["bannedImages"][number]): string {
  return record.label || record.sourceFilename || record.id;
}

function formatAddedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

$effect(() => {
  imageDrafts = Object.fromEntries(
    data.bannedImages.map((record) => [
      record.id,
      { reason: record.reason, label: record.label ?? "" },
    ]),
  );
});
</script>

<Stack gap="var(--space-lg)">
  <PageHeader title="automod" subtitle="block spam patterns and abusive behavior automatically." />

  <div use:surface={{ delay: 0 }}>
    <Panel withInset>
      {#snippet header()}
        <div class="panel-head">
          <span class="panel-title">link spam</span>
          <Toggle bind:checked={linkSpamEnabled} label={linkSpamEnabled ? "enabled" : "disabled"} />
        </div>
      {/snippet}

      <form
        method="POST"
        action="?/saveLinkSpam"
        use:resolve={(a) => (linkResolve = a)}
        use:enhance={enhanceSave({
          setSaving: (v) => (savingLink = v),
          resolve: () => linkResolve,
          okMessage: "link spam saved",
          setError: (e) => (linkError = e),
        })}
      >
        <input type="hidden" name="enabled" value={linkSpamEnabled ? "on" : ""} />

        {#if linkError && !linkError.field}
          <Alert variant="error">{linkError.message}</Alert>
        {/if}

        <FormField
          label="max links per window"
          description="a member posting more than this many links inside the time window triggers action."
          error={linkError?.field === "maxLinks" ? linkError.message : undefined}
        >
          <Input type="number" bind:value={linkSpamMaxLinks} />
          <input type="hidden" name="maxLinks" value={linkSpamMaxLinks} />
        </FormField>

        <FormField
          label="window (seconds)"
          description="how long the counter looks back for spam patterns."
          error={linkError?.field === "windowSeconds" ? linkError.message : undefined}
        >
          <Input type="number" bind:value={linkSpamWindowSeconds} />
          <input type="hidden" name="windowSeconds" value={linkSpamWindowSeconds} />
        </FormField>

        <FormField
          label="report channel"
          description="where automod fires get reported. leave empty to use the global reports channel."
        >
          <ChannelSelect
            name="reportChannelId"
            bind:value={linkSpamReportChannelId}
            channels={data.channels}
            types={["text"]}
          />
          <input type="hidden" name="reportChannelId" value={linkSpamReportChannelId} />
        </FormField>

        <div class="actions">
          {#if linkDirty}<span class="unsaved">unsaved changes</span>{/if}
          {#if linkDirty}
            <Button type="button" variant="ghost" size="sm" onclick={resetLink}>reset</Button>
          {/if}
          <Button type="submit" variant="primary" disabled={savingLink} echo>
            {savingLink ? "saving" : "save link spam"}
          </Button>
        </div>
      </form>
    </Panel>
  </div>

  <div use:surface={{ delay: 60 }}>
    <Panel withInset>
      {#snippet header()}
        <div class="panel-head">
          <span class="panel-title">mention spam</span>
          <Toggle bind:checked={mentionSpamEnabled} label={mentionSpamEnabled ? "enabled" : "disabled"} />
        </div>
      {/snippet}

      <form
        method="POST"
        action="?/saveMentionSpam"
        use:resolve={(a) => (mentionResolve = a)}
        use:enhance={enhanceSave({
          setSaving: (v) => (savingMention = v),
          resolve: () => mentionResolve,
          okMessage: "mention spam saved",
          setError: (e) => (mentionError = e),
        })}
      >
        <input type="hidden" name="enabled" value={mentionSpamEnabled ? "on" : ""} />

        {#if mentionError && !mentionError.field}
          <Alert variant="error">{mentionError.message}</Alert>
        {/if}

        <FormField
          label="max mentions per window"
          description="a member mentioning more people than this in the window triggers action."
          error={mentionError?.field === "maxMentions" ? mentionError.message : undefined}
        >
          <Input type="number" bind:value={mentionSpamMaxMentions} />
          <input type="hidden" name="maxMentions" value={mentionSpamMaxMentions} />
        </FormField>

        <FormField
          label="window (seconds)"
          description="how long the counter looks back."
          error={mentionError?.field === "windowSeconds" ? mentionError.message : undefined}
        >
          <Input type="number" bind:value={mentionSpamWindowSeconds} />
          <input type="hidden" name="windowSeconds" value={mentionSpamWindowSeconds} />
        </FormField>

        <div class="actions">
          {#if mentionDirty}<span class="unsaved">unsaved changes</span>{/if}
          {#if mentionDirty}
            <Button type="button" variant="ghost" size="sm" onclick={resetMention}>reset</Button>
          {/if}
          <Button type="submit" variant="primary" disabled={savingMention} echo>
            {savingMention ? "saving" : "save mention spam"}
          </Button>
        </div>
      </form>
    </Panel>
  </div>

  <div use:surface={{ delay: 120 }}>
    <Panel withInset>
      {#snippet header()}
        <div class="panel-head">
          <span class="panel-title">user slow roles</span>
          <Toggle bind:checked={perUserSlowEnabled} label={perUserSlowEnabled ? "enabled" : "disabled"} />
        </div>
      {/snippet}

      <form
        method="POST"
        action="?/savePerUserSlow"
        use:resolve={(a) => (slowResolve = a)}
        use:enhance={enhanceSave({
          setSaving: (v) => (savingSlow = v),
          resolve: () => slowResolve,
          okMessage: "user slow roles saved",
          setError: (e) => (slowError = e),
        })}
      >
        <input type="hidden" name="enabled" value={perUserSlowEnabled ? "on" : ""} />
        <input type="hidden" name="rules" value={slowRulesJson} />

        {#if slowError}
          <Alert variant="error">{slowError.message}</Alert>
        {/if}

        <div class="slow-builder">
          <FormField label="slow role" description="members with this role get a per-user cooldown.">
            <RolePicker name="roleId" bind:value={slowRoleId} roles={data.roles} placeholder="choose role" />
          </FormField>

          <FormField label="cooldown (seconds)" description="how long the member must wait after a message.">
            <Input type="number" bind:value={slowCooldownSeconds} />
          </FormField>

          <FormField label="effect duration (seconds)" description="how long the bot keeps the slow role.">
            <Input type="number" bind:value={slowDurationSeconds} />
          </FormField>

          <Button type="button" variant="secondary" onclick={upsertSlowRule}>add role</Button>
        </div>

        {#if slowRules.length > 0}
          <div class="slow-list">
            {#each slowRules as rule (rule.roleId)}
              <div class="slow-rule">
                <span>@{roleNameFor(rule.roleId)}</span>
                <span>{rule.cooldownSeconds}s cooldown</span>
                <span>{rule.durationSeconds}s effect</span>
                <Button type="button" size="sm" variant="destructive" onclick={() => removeSlowRule(rule.roleId)}>
                  remove
                </Button>
              </div>
            {/each}
          </div>
        {/if}

        <div class="actions">
          {#if slowDirty}<span class="unsaved">unsaved changes</span>{/if}
          {#if slowDirty}
            <Button type="button" variant="ghost" size="sm" onclick={resetSlow}>reset</Button>
          {/if}
          <Button type="submit" variant="primary" disabled={savingSlow} echo>
            {savingSlow ? "saving" : "save user slow roles"}
          </Button>
        </div>
      </form>
    </Panel>
  </div>

  <div use:surface={{ delay: 180 }}>
    <Panel withInset>
      {#snippet header()}
        <div class="panel-head">
          <span class="panel-title">banned images</span>
          <Toggle
            bind:checked={imageDetectionEnabled}
            label={imageDetectionEnabled ? "enabled" : "disabled"}
          />
        </div>
      {/snippet}

      <form
        method="POST"
        action="?/saveImageDetection"
        use:resolve={(a) => (imageResolve = a)}
        use:enhance={enhanceSave({
          setSaving: (v) => (savingImageSettings = v),
          resolve: () => imageResolve,
          okMessage: "image detection saved",
          setError: (e) => (imageError = e),
        })}
      >
        <input type="hidden" name="enabled" value={imageDetectionEnabled ? "on" : ""} />

        {#if imageError}
          <Alert variant="error">{imageError.message}</Alert>
        {/if}

        <div class="image-settings-grid">
          <FormField label="report channel" description="where banned-image detections get reported first.">
            <ChannelSelect
              name="reportChannelId"
              bind:value={imageReportChannelId}
              channels={data.channels}
              types={["text"]}
            />
            <input type="hidden" name="reportChannelId" value={imageReportChannelId} />
          </FormField>

          <FormField label="tolerance" description="how closely uploads must match a stored fingerprint.">
            <Select bind:value={imageTolerance} options={toleranceOptions} />
            <input type="hidden" name="tolerance" value={imageTolerance} />
          </FormField>
        </div>

        <div class="actions">
          {#if imageDirty}<span class="unsaved">unsaved changes</span>{/if}
          {#if imageDirty}
            <Button type="button" variant="ghost" size="sm" onclick={resetImage}>reset</Button>
          {/if}
          <Button type="submit" variant="primary" disabled={savingImageSettings} echo>
            {savingImageSettings ? "saving" : "save image detection"}
          </Button>
        </div>
      </form>

      <div class="image-tools">
        <form
          method="POST"
          action="?/addBannedImage"
          enctype="multipart/form-data"
          class="image-tool"
          use:enhance={() => {
            addingImage = true;
            return async ({ result, update }) => {
              addingImage = false;
              if (result.type === "success") {
                addImageLabel = "";
                addImageReason = "";
              }
              toastStore.push(
                result.type === "success" ? "banned image added" : "add failed",
                result.type === "success" ? "ok" : "fail",
              );
              await update();
            };
          }}
        >
          <FormField label="add image" description="store a perceptual hash, reason, and review metadata.">
            <input class="file-input" type="file" name="image" accept="image/*" required />
          </FormField>
          <div class="image-form-grid">
            <Input bind:value={addImageLabel} placeholder="label" />
            <Input bind:value={addImageReason} placeholder="required reason" />
            <input type="hidden" name="label" value={addImageLabel} />
            <input type="hidden" name="reason" value={addImageReason} />
            <Button type="submit" variant="primary" disabled={addingImage} echo>
              {addingImage ? "adding" : "add"}
            </Button>
          </div>
        </form>

        <form
          method="POST"
          action="?/testBannedImage"
          enctype="multipart/form-data"
          class="image-tool"
          use:enhance={() => {
            testingImage = true;
            return async ({ result, update }) => {
              testingImage = false;
              if (result.type === "success") {
                const data = result.data as { imageTest?: BannedImageTestResult } | undefined;
                testResult = data?.imageTest ?? null;
                toastStore.push(testResult?.matched ? "image matched" : "no match", "ok");
              } else {
                testResult = null;
                toastStore.push("test failed", "fail");
              }
              await update({ reset: false });
            };
          }}
        >
          <FormField label="test image" description="hash an upload and compare it against active records.">
            <input class="file-input" type="file" name="image" accept="image/*" required />
          </FormField>
          <div class="actions compact">
            <Button type="submit" variant="secondary" disabled={testingImage} echo>
              {testingImage ? "testing" : "test"}
            </Button>
          </div>
          {#if testResult}
            <div class="test-result">
              <Badge variant={testResult.matched ? "warn" : "accent"}>
                {testResult.matched ? "match" : "clear"}
              </Badge>
              {#if testResult.record && testResult.distance}
                <span>{imageLabel(testResult.record)} · total {testResult.distance.total}</span>
              {:else}
                <span>no active record matched this image.</span>
              {/if}
            </div>
          {/if}
        </form>
      </div>

      {#if data.bannedImages.length === 0}
        <EmptyState
          title="no banned images"
          description="upload an image above to start blocking re-posts of it."
        />
      {:else}
        <div class="image-list">
          {#each data.bannedImages as record (record.id)}
            {@const draft = imageDrafts[record.id] ?? { reason: record.reason, label: record.label ?? "" }}
            <div class="image-row">
              <div class="image-preview">
                {#if record.sourceUrl}
                  <img src={record.sourceUrl} alt={imageLabel(record)} loading="lazy" />
                {:else}
                  <span>hash</span>
                {/if}
              </div>
              <div class="image-meta">
                <div class="image-title">
                  <Badge variant="accent">{record.id}</Badge>
                  <span>{imageLabel(record)}</span>
                </div>
                <span>{record.sourceFilename ?? "dashboard upload"} · {formatAddedAt(record.addedAt)}</span>
              </div>
              <form method="POST" action="?/editBannedImage" class="image-edit">
                <input type="hidden" name="id" value={record.id} />
                <Input
                  value={draft.label}
                  placeholder="label"
                  oninput={(e) =>
                    (imageDrafts[record.id] = {
                      ...draft,
                      label: (e.target as HTMLInputElement).value,
                    })}
                />
                <Input
                  value={draft.reason}
                  placeholder="reason"
                  oninput={(e) =>
                    (imageDrafts[record.id] = {
                      ...draft,
                      reason: (e.target as HTMLInputElement).value,
                    })}
                />
                <input type="hidden" name="label" value={draft.label} />
                <input type="hidden" name="reason" value={draft.reason} />
                <div class="row-buttons">
                  <Button type="submit" size="sm">save</Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onclick={() => (removeCandidate = { id: record.id, label: imageLabel(record) })}
                  >
                    remove
                  </Button>
                </div>
              </form>
            </div>
          {/each}
        </div>
      {/if}
    </Panel>
  </div>
</Stack>

<form
  method="POST"
  action="?/removeBannedImage"
  id="banned-image-remove-form"
  use:enhance={() => async ({ result, update }) => {
    toastStore.push(
      result.type === "success" ? "banned image removed" : "remove failed",
      result.type === "success" ? "ok" : "fail",
    );
    removeCandidate = null;
    await update();
  }}
>
  <input type="hidden" name="id" value={removeCandidate?.id ?? ""} />
</form>

<ConfirmDialog
  open={!!removeCandidate}
  title={`remove ${removeCandidate?.label ?? "banned image"}`}
  description="this disables the image record but keeps audit metadata."
  confirmLabel="remove"
  cancelLabel="keep"
  destructive
  onconfirm={() => {
    (document.getElementById("banned-image-remove-form") as HTMLFormElement | null)?.requestSubmit();
  }}
  oncancel={() => (removeCandidate = null)}
/>

<style>
  .panel-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-md);
  }
  .panel-title {
    font-family: var(--font-mono);
    font-size: 0.88rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: var(--space-xs);
    margin-top: var(--space-sm);
    padding-top: var(--space-sm);
    border-top: 1px solid var(--line);
  }
  /* Marker sits left; save/reset stay right-aligned. */
  .unsaved {
    margin-right: auto;
    color: var(--text-soft);
    font-family: var(--font-mono);
    font-size: 0.78rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .slow-builder {
    display: grid;
    grid-template-columns: minmax(12rem, 1.4fr) minmax(8rem, 1fr) minmax(8rem, 1fr) auto;
    gap: var(--space-md);
    align-items: end;
  }
  .slow-list {
    display: grid;
    gap: var(--space-xs);
    margin-top: var(--space-md);
  }
  .slow-rule {
    display: grid;
    grid-template-columns: minmax(10rem, 1fr) auto auto auto;
    gap: var(--space-sm);
    align-items: center;
    padding: var(--space-xs) var(--space-sm);
    border: 1px solid var(--line);
    font-family: var(--font-mono);
    font-size: 0.82rem;
  }
  .image-settings-grid,
  .image-tools,
  .image-form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-md);
    align-items: end;
  }
  .image-tools {
    margin-top: var(--space-md);
    align-items: stretch;
  }
  .image-tool {
    display: grid;
    align-content: start;
    padding: var(--space-sm);
    border: 1px solid var(--line);
  }
  .image-form-grid {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr) auto;
    gap: var(--space-sm);
  }
  .file-input {
    width: 100%;
    min-height: 2.35rem;
    color: var(--text);
    font-family: var(--font-mono);
    font-size: 0.82rem;
  }
  .compact {
    margin-top: 0;
    padding-top: 0;
    border-top: 0;
  }
  .test-result {
    display: flex;
    gap: var(--space-xs);
    align-items: center;
    margin-top: var(--space-sm);
    color: var(--text-soft);
    font-family: var(--font-mono);
    font-size: 0.82rem;
  }
  .image-list {
    display: grid;
    gap: var(--space-xs);
    margin-top: var(--space-md);
  }
  .image-row {
    display: grid;
    grid-template-columns: 4rem minmax(10rem, 0.8fr) minmax(14rem, 1.5fr);
    gap: var(--space-sm);
    align-items: center;
    padding: var(--space-xs) var(--space-sm);
    border: 1px solid var(--line);
  }
  .image-preview {
    display: grid;
    place-items: center;
    width: 4rem;
    aspect-ratio: 1;
    overflow: hidden;
    border: 1px solid var(--line);
    color: var(--text-soft);
    font-family: var(--font-mono);
    font-size: 0.72rem;
    text-transform: uppercase;
  }
  .image-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .image-meta {
    display: grid;
    gap: var(--space-2xs);
    min-width: 0;
    color: var(--text-soft);
    font-family: var(--font-mono);
    font-size: 0.78rem;
  }
  .image-title {
    display: flex;
    gap: var(--space-xs);
    align-items: center;
    min-width: 0;
    color: var(--text);
  }
  .image-title span,
  .image-meta span {
    overflow-wrap: anywhere;
  }
  .image-edit {
    display: grid;
    grid-template-columns: minmax(6rem, 0.7fr) minmax(10rem, 1fr) auto;
    gap: var(--space-xs);
    align-items: center;
  }
  .row-buttons {
    display: inline-flex;
    gap: var(--space-2xs);
  }
  @media (max-width: 48rem) {
    .slow-builder,
    .slow-rule,
    .image-settings-grid,
    .image-tools,
    .image-form-grid,
    .image-row,
    .image-edit {
      grid-template-columns: 1fr;
    }
  }
</style>
