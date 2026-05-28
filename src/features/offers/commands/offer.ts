/**
 * /offer create   — opens a five-field modal; submission handled by @Handle(OFFER_CREATE_MODAL_ID)
 * /offer withdraw — removes the active offer and marks the review card WITHDRAWN
 * /offer status   — shows the current pending/changes-requested offer
 * /offer panel    — opens the admin config panel (mod-only)
 */

import { assertPanelPermission, openAdminPanel } from "@/features/adminPanels/panels";
import {
  buildCreateModal,
  findActiveByAuthor,
  type OfferStatus,
  withdrawOffer,
} from "@/features/offers/service";
import { command, type RunContext } from "@/framework";
import { container, separator, text, v2Message } from "@/ui/v2";

const data = command("offer")
  .description("Manage job/service offers")
  .subcommand("create", "Submit a new offer for review")
  .subcommand("withdraw", "Withdraw your active offer")
  .subcommand("status", "Check the status of your current offer")
  .subcommand("panel", "Open the offers configuration panel");

type OfferCtx = RunContext<typeof data>;

async function handleCreate(c: Extract<OfferCtx, { subcommand: "create" }>) {
  if (!c.guild) return { content: "This command can only be used in a server." };
  // showModal IS the initial response — no defer before it.
  // The submission is handled by @Handle(OFFER_CREATE_MODAL_ID) in handlers.ts.
  await c.interaction.showModal(buildCreateModal());
  return undefined;
}

async function handleWithdraw(c: Extract<OfferCtx, { subcommand: "withdraw" }>) {
  await c.ctx.respond.defer({ visibility: "ephemeral" });

  if (!c.guild) return { content: "This command can only be used in a server." };

  const result = await withdrawOffer(c.guild, c.userId);

  if (result.isErr()) {
    return v2Message(
      container("danger", text(`## Failed\nCould not withdraw offer: ${result.error.message}`)),
    );
  }

  return v2Message(
    result.unwrap()
      ? container("ok", text("## Offer Withdrawn\nYour offer has been removed from review."))
      : container("warn", text("## Nothing to Withdraw\nYou don't have an active offer.")),
  );
}

const STATUS_ACCENT: Record<OfferStatus, "ok" | "warn" | "danger" | "mute"> = {
  PENDING_REVIEW: "warn",
  APPROVED: "ok",
  REJECTED: "danger",
  CHANGES_REQUESTED: "warn",
  WITHDRAWN: "mute",
};

const STATUS_LABEL: Record<OfferStatus, string> = {
  PENDING_REVIEW: "Pending Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CHANGES_REQUESTED: "Changes Requested",
  WITHDRAWN: "Withdrawn",
};

async function handleStatus(c: Extract<OfferCtx, { subcommand: "status" }>) {
  await c.ctx.respond.defer({ visibility: "ephemeral" });

  if (!c.guildId) return { content: "This command can only be used in a server." };

  const res = await findActiveByAuthor(c.guildId, c.userId);
  if (res.isErr()) {
    return v2Message(container("danger", text(`## Error\n${res.error.message}`)));
  }

  const offer = res.unwrap();
  if (!offer) {
    return v2Message(
      container("mute", text("## No Active Offer\nYou don't have a pending or in-review offer.")),
    );
  }

  const details = [
    offer.details.requirements ? `**Requirements:** ${offer.details.requirements}` : null,
    offer.details.salary ? `**Salary:** ${offer.details.salary}` : null,
    offer.details.contact ? `**Contact:** ${offer.details.contact}` : null,
    offer.changesNote ? `**Changes Requested:** ${offer.changesNote}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return v2Message(
    container(
      STATUS_ACCENT[offer.status],
      text(`## ${offer.details.title}\n${offer.details.description}`),
      separator("sm"),
      text(
        `**Status:** ${STATUS_LABEL[offer.status]}${details ? `\n${details}` : ""}\n-# Offer ID: ${offer._id}`,
      ),
    ),
  );
}

export default data
  .help({ hints: [] })
  .handle("create", handleCreate)
  .handle("withdraw", handleWithdraw)
  .handle("status", handleStatus)
  .run(async (c) => {
    if (!(await assertPanelPermission(c.interaction))) return undefined;
    await openAdminPanel(c.interaction, "offers");
  });
