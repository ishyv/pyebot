# Security Policy

## Reporting a vulnerability

**Please do not open public GitHub issues for security bugs.** Email or DM
the maintainer instead so the issue can be fixed before disclosure.

When reporting, include:

- A description of the issue and its impact.
- Steps to reproduce (a minimal proof-of-concept is ideal).
- Affected versions / commit SHAs if known.
- Whether you've shared the report with anyone else.

I aim to respond within a few days. Coordinated disclosure timelines are
negotiable depending on severity.

## Threat model

This dashboard is intended for **self-hosters running their own bot + their
own webapp instance**. It is *not* a multi-tenant SaaS. Assumptions baked
into the design:

- Anyone with a valid OAuth session is in control of every guild they have
  `MANAGE_GUILD` or `Administrator` on. Authorization is delegated to
  Discord — we don't second-guess Discord's permission model per guild.
- The `/rpg` route edits a file on disk in the bot repo. It is gated by an
  allowlist (`BOT_OWNER_IDS`, fail-closed by default). Anyone in the list
  has full write access to the bot's content pack.
- Session cookies use HMAC-signed envelopes. Rotating `SESSION_SECRET`
  invalidates every active session — useful if you suspect compromise.
- The MongoDB connection string contains write credentials to the bot's

## What's in scope

- Session forgery / cookie tampering / replay.
- OAuth flow issues (state validation, scope confusion, redirect_uri).
- Authorization bypass (especially around `BOT_OWNER_IDS` and
  `hasGuildManagementPermission`).
- Injection (SSRF, prototype pollution, anything that lands in the bot's
  Mongo writes).
- DoS against the SSE stream or the bridge.

## What's out of scope

- The bot's own command surface — report those to the bot repo.
- Issues that require an attacker with `MANAGE_GUILD` in a guild they
  legitimately admin (that's "self-rooting", not a vuln).
- Best-practice nits that aren't exploitable (e.g. "could use Argon2
  somewhere"). Open a regular issue / PR for those.

## Secrets in this repo

committed secret, treat it as a vulnerability and report it.
