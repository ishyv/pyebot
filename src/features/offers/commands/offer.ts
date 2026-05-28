/**
 * /offer create <title> <description> [requirements] [salary] [contact]
 * /offer withdraw
 * /offer edit <field> <value>
 */

import { assertPanelPermission, openAdminPanel } from "@/features/adminPanels/panels";
import { createOffer, type OfferError, withdrawOffer } from "@/features/offers/service";
import { command, type RunContext } from "@/framework";
import { container, text, v2Message } from "@/ui/v2";

const data = command("offer")
  .description("Manage job/service offers")
  .subcommand("create", "Submit a new offer for review", (s) =>
    s
      .string("title", "Offer title", { required: true, max: 100 })
      .string("description", "Full description", { required: true, max: 1000 })
      .string("requirements", "Requirements (optional)", { max: 500 })
      .string("salary", "Salary or compensation (optional)", { max: 200 })
      .string("contact", "How to contact you (optional)", { max: 200 }),
  )
  .subcommand("withdraw", "Withdraw your active offer")
  .subcommand("panel", "Open the offers configuration panel");

type OfferCtx = RunContext<typeof data>;

async function handleCreate(c: Extract<OfferCtx, { subcommand: "create" }>) {
  await c.ctx.respond.defer({ visibility: "ephemeral" });

  if (!c.guild) {
    return { content: "This command can only be used in a server." };
  }

  const details = {
    title: c.options.title,
    description: c.options.description,
    requirements: c.options.requirements ?? null,
    salary: c.options.salary ?? null,
    contact: c.options.contact ?? null,
  };

  const result = await createOffer(c.guild, c.userId, c.user.username, details);

  if (result.isErr()) {
    const err = result.error as OfferError;
    const msg =
      err.code === "ACTIVE_OFFER_EXISTS"
        ? "You already have an active offer. Withdraw it first before submitting a new one."
        : err.code === "NO_REVIEW_CHANNEL"
          ? "The offers review channel is not configured. Contact an administrator."
          : `Failed to submit offer: ${err.message}`;
    return { content: msg };
  }

  const offer = result.unwrap();
  return v2Message(
    container(
      "warn",
      text(
        `## Offer Submitted\nYour offer **${offer.details.title}** has been submitted for review.\nOffer ID: \`${offer._id}\``,
      ),
    ),
  );
}

async function handleWithdraw(c: Extract<OfferCtx, { subcommand: "withdraw" }>) {
  await c.ctx.respond.defer({ visibility: "ephemeral" });

  if (!c.guildId) {
    return { content: "This command can only be used in a server." };
  }

  const result = await withdrawOffer(c.guildId, c.userId);

  if (result.isErr()) {
    return v2Message(
      container("danger", text(`## Failed\nCould not withdraw offer: ${result.error.message}`)),
    );
  }

  if (!result.unwrap()) {
    return v2Message(
      container(
        "warn",
        text("## Nothing to Withdraw\nYou don't have an active offer to withdraw."),
      ),
    );
  }

  return v2Message(
    container("ok", text("## Offer Withdrawn\nYour offer has been removed from review.")),
  );
}

export default data
  .help({ hints: [] })
  .handle("create", handleCreate)
  .handle("withdraw", handleWithdraw)
  .run(async (c) => {
    if (!(await assertPanelPermission(c.interaction))) return undefined;
    await openAdminPanel(c.interaction, "offers");
  });
