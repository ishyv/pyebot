# Decision Log

## 2026-05-25 - Single-community scope: global per-user keying is intentional

**Cambio:** tx-v2 es un bot **single-community** (un servidor principal / federación que comparte
estado a propósito). Por tanto el modelo de datos actual es correcto y deliberado:

- **Economía y RPG son globales por usuario** — `UserCurrency`, `UserInventory`, `RpgProfile`,
  `EconomyAccount` (racha diaria), `QuestProgress`, logros: todos con `_id = userId` (sin `guildId`).
  Un usuario tiene **una** identidad de economía/RPG compartida entre servidores. Es intencional, no
  un bug.
- **La moderación es guild-scoped** — sanciones y warns viven en `users.sanction_history.<guildId>[]`
  y el contador de casos es por guild. Esto es forward-compatible si algún día entra un segundo
  servidor.
- Se eliminó el componente **muerto `UserWarns`** (`src/components/user-warns.ts` + su export en el
  barrel): definido pero sin referencias en runtime; los warns persisten vía `service.warn()` en
  `sanction_history`.

**Motivo:** El dueño confirmó el modelo single-community. Cierra la pregunta abierta de alcance
multi-guild (índice de refactors, #2). Evita una migración innecesaria de re-keying.

**Alternativas (rechazadas ahora):** (a) Multi-tenant aislado — re-keyear economía/RPG por
`(guildId, userId)`; sería una migración real y no aplica al despliegue actual. (b) Aplanar
`sanction_history.<guildId>` a un array plano — posible, pero es un cambio de forma persistida y el
mapa por-guild no está roto (es forward-compatible), así que se deja como está. Si en el futuro el
bot se vuelve multi-tenant-aislado, reabrir con la migración de (a).

**Cómo verificar:** `rg "UserWarns|user_warns" src` → vacío; `bun run typecheck`; `bun test`
(691 pass / 0 fail). El keying global se ve en `economy/mutations.ts` (`ctx.get(userId,
UserCurrency)`) y el guild-scoping en `moderation/service.ts` (`sanction_history.${guildId}`).

## 2026-05-25 - Plan 09b (orphan cleanup / TTL indexes) closed as not-applicable

**Cambio:** El plan 09b se cierra sin implementar TTL indexes ni un limpiador de huérfanos en
borrado de usuario. Se documenta aquí la razón tras verificar el modelo de datos real.

**Motivo (evidencia):**
- **TTL no encaja.** Cada campo `expiresAt` persistido alimenta un *barrido con efectos
  secundarios*, no un borrado puro: `automod/handlers.ts:237` y `autoroles/handlers.ts:216`
  consultan `expiresAt <= now` para **quitar el rol de Discord** antes de eliminar el registro. Un
  índice TTL borraría el registro antes de que el barrido corra, dejando el rol asignado para
  siempre (huérfano peor que el que pretendía resolver). Las listings de mercado guardan
  `expiresAt: null` (`market.ts:195`), así que ni siquiera expiran por fecha.
- **El limpiador en borrado de usuario es inaplicable.** No existe ninguna ruta que borre usuarios
  ni sus datos: `purge` borra *mensajes*, y el único `guildMemberRemove` (`webapp/bot-bridge.ts`)
  es un puente SSE para el dashboard, no limpieza de datos. Sin borrado de usuario, las filas
  huérfanas en `questProgress`/`achievementUnlocks`/`marketListings` no se acumulan.

**Alternativas:** Añadir índices TTL "porque el campo existe" se rechazó: es destructivo y rompería
la retirada de roles. Implementar limpieza especulativa se rechazó: resuelve un disparador que no
ocurre y reabre la pregunta de alcance multi-guild sin necesidad.

**Riesgos:** Ninguno por no actuar. Si en el futuro se añade una ruta de borrado de usuario o datos
con historial que crezca sin límite, reabrir con un barrido que respete los efectos secundarios
(no TTL crudo). La pregunta de alcance multi-guild (índice 00, #2) deja de bloquear 09b.

**Cómo verificar:** `rg "createIndex|expireAfterSeconds" src` → vacío (sin índices); `rg
"deleteUser|removeUser" src` → sin ruta de borrado de usuario; los barridos de expiración viven en
`automod/handlers.ts` y `autoroles/handlers.ts`.

## 2026-05-25 - Commands respond through ctx.respond (plan 06 migration completed)

**Cambio:** Todos los `execute` de slash commands (economy, rpg, moderation, ai, autoroles,
offers, tickets, utility) pasaron de `interaction.deferReply/editReply/reply/followUp` crudos a
`ctx.respond.defer/send`. Donde un comando delegaba en helpers (`modset` con 16 handlers,
`modconfig`, `lockdown`, `autorole` con `requireGuild`/`requireManageableRole`), se enhebró `ctx`
por la firma. Los escenarios de `command-smoke-scenarios.ts` se actualizaron de `raw` a `ctx`.

**Excepción deliberada:** `ai/commands/context.ts` se queda en la API cruda. Usa
`interaction.followUp(payload)` para publicar el resumen **público** mientras mantiene el defer
**efímero**; `ctx.respond.send` hace `editReply` cuando está deferred, así que migrarlo cambiaría el
resumen de mensaje público a edición efímera. Además es `executeWithDeps` (exportado e inyectado en
tests). Las ramas `panel` que llaman `openAdminPanel(interaction, …)` también siguen crudas.

**Motivo:** Una sola ruta de respuesta (`ctx.respond`) que rastrea el estado deferred/replied,
devuelve `Result` en vez de lanzar, y valida el payload. Completa el plan 06 tras arreglar el
`Ctx.respond` que faltaba.

**Riesgos:** Medio. `ctx.respond.send` valida el payload (≤5 filas de componentes, ≤2000 chars) y
devuelve `Result` en vez de lanzar — distinto de `editReply` crudo en los bordes. La equivalencia de
comportamiento (efímero/público, orden defer→edit) se preservó con mapeos exactos, pero el render
real en Discord no se pudo verificar localmente (sin UI).

**Cómo verificar:** `bun run typecheck`, `bun test` (677 pass / 0 fail), biome sobre los comandos
tocados, y `rg "interaction\.(deferReply|editReply)\(" src/features/*/commands` → solo `context.ts`.

## 2026-05-25 - ctx.respond is a first-class Ctx member (fixes broken responder commands)

**Cambio:** Se añadió `respond: InteractionResponder` a la interfaz `Ctx`
(`framework/types.ts`) y un getter perezoso en `InteractionCtx` (`framework/world.ts`) que construye
`createInteractionResponder(this.interaction)` la primera vez que se usa. Acceder a `ctx.respond` en
un Ctx sin interacción (jobs offline) lanza un error claro.

**Motivo:** La migración a `ctx.respond` se había hecho del lado de los comandos (`mod`, todos los
subcomandos de `automod`, `handleDbError`) pero el `Ctx` del framework **nunca** expuso `respond`.
`world.forInteraction()` devolvía un `InteractionCtx` sin esa propiedad, así que en runtime
`ctx.respond` era `undefined` y esos comandos lanzaban `TypeError`, tragado por el error boundary
del dispatcher como "An unexpected error occurred". Verificado empíricamente: `typeof ctx.respond
=== "undefined"` antes del cambio. Los tests no lo detectaban porque inyectan un Ctx simulado.

**Alternativas:** Que cada comando construyera su propio responder desde `interaction` se descartó:
duplica el patrón en decenas de sitios y contradice el objetivo de la migración (un único punto de
respuesta). Tipar `Ctx.respond` como opcional se descartó: oculta el contrato real.

**Riesgos:** Bajo. Cambio aditivo. El tipo `Ctx` ahora exige `respond`, lo que obligó a 3 mocks de
test a declararlo (no usan respond). Desbloquea migrar el resto de comandos de
`interaction.deferReply/editReply` a `ctx.respond` de forma incremental (plan 06).

**Cómo verificar:** `bun run typecheck`, `bun test` (670 pass / 1 fail preexistente de aislamiento),
y reproducción: `world.forInteraction(fakeInteraction).respond` expone `defer/send/fail`;
`world.forInteraction(null).respond` lanza.

## 2026-05-25 - Standardize ephemeral replies on MessageFlags.Ephemeral

**Cambio:** Las 29 llamadas que usaban la forma deprecada `{ ephemeral: true }`
(`reply`/`deferReply`/`followUp`) en 15 archivos pasaron a `{ flags: MessageFlags.Ephemeral }`,
alineándose con el resto del código que ya usaba `MessageFlags`. En `framework/panel.ts` el panel V2
combina banderas (`panelPayload.flags | MessageFlags.Ephemeral`) para no pisar `IsComponentsV2`.

**Motivo:** discord.js deprecó `ephemeral: true`. Convivían las dos formas, una inconsistencia
puramente cosmética pero visible en cada comando. Es cambio equivalente en runtime (ambas resuelven
a la misma bandera en el wire).

**Alternativas:** Dejarlo como estaba se descartó: la advertencia de deprecación seguiría y la base
mezclaría dos estilos.

**Riesgos:** Bajo. Sin cambio de comportamiento. El único punto delicado, el merge de banderas V2 en
`panel.ts`, está cubierto por typecheck.

**Cómo verificar:** `bun run typecheck`, biome sobre los 15 archivos tocados, y
`rg "ephemeral: true" src` sin resultados.

## 2026-05-25 - Refactor backlog reconciled with code

**Cambio:** Se re-verificó `docs/refactor/00-INDEX.md` contra el código: los planes 01, 02, 03, 04,
05, 07, 08 y los ítems 9a/9c del plan 09 ya estaban implementados pese a figurar como `Now`/`Later`.
El índice ahora refleja el estado real; los archivos de plan se conservan como registro histórico.

**Motivo:** El índice anunciaba como trabajo pendiente cosas ya hechas (p.ej. dividir un `guild.ts`
de 722 líneas que hoy tiene 190), lo que confunde a cualquier lector nuevo — drift doc/código.

**Riesgos:** Ninguno (solo documentación).

**Cómo verificar:** Contrastar cada fila del índice con el código citado (router.ts, store.ts,
db/schemas/guild/, core/state.ts, framework/command.ts).

## 2026-05-24 - RPG state canonical components

**Cambio:** RPG runtime state no longer uses embedded `users` document fields.
`RpgProfile` owns profile/loadout/fight state, `UserInventory` owns item stacks,
and `UserCurrency` owns RPG coin fees and balances. The legacy RPG repository
and embedded user-schema fields were removed from the runtime model.

**Motivo:** `users` had become a mixed document for moderation, RPG, economy,
tickets, minigames, and voting. That created split-brain state where economy
market code used components while RPG crafting, processing, gathering, hideout,
quests, and combat still read `users.inventory`, `users.currency`, or
`users.rpgProfile`.

**Alternativas:** Runtime dual-read migration and compatibility shims were
rejected. This repo is latest-only; existing stale Mongo fields can remain
physically present until a separate destructive cleanup script is requested, but
runtime code must not model or read them.

**Riesgos:** Existing persisted legacy RPG state is not auto-migrated. Servers
that still only have the old embedded fields need an explicit migration if that
data must be preserved.

**Cómo verificar:** Run `bun test src/db src/features/rpg src/features/economy`,
`bun run typecheck`, targeted Biome on touched files, `git diff --check`, and
`bun run start` to confirm loader, login, webapp bind, and command registration.

## 2026-05-24 - Main-only workflow rule

**Cambio:** Project work should stay on `main` by default. Agents must not create,
switch to, or keep feature branches unless the user explicitly asks for a branch.
Use coherent commits along the way instead of branch ceremony.

**Motivo:** This repo already uses local checkpoints and direct mainline work for
small, scoped changes. Extra branches have caused cleanup noise, especially with
the nested `webapp/` repository boundary.

**Alternativas:** Feature branches remain available only when explicitly
requested. They are not the default workflow.

**Riesgos:** Larger risky rewrites need stricter commit checkpoints and focused
verification because rollback is commit-based, not branch-based.

**Cómo verificar:** Before editing, run `git status --short --branch` and confirm
the current branch is `main`. Do not run `git switch`, `git checkout -b`, or
`git branch` creation commands unless the user requested a branch.

## 2026-05-23 - Money model canonical storage

**Estado:** Superseded by `2026-05-24 - RPG state canonical components`.

**Cambio original:** Economy spendable balances were documented as
`UserCurrency.balances`, bank balances as `UserCurrency.bankBalances`, and
economy status/activity/streak metadata as the `EconomyAccount` component. At
the time, legacy user-doc money fields remained schema-visible because RPG still
used embedded user money.

**Decisión actual:** `UserCurrency` owns all spendable and bank balances,
including RPG coin fees. Legacy `UserSchema.currency`, `UserSchema.bank`, and
embedded `UserSchema.economyAccount` are no longer schema-visible runtime model
fields.

**Motivo:** The follow-up RPG state reset moved hideout and processing fees onto
`UserCurrency`, removing the last runtime reason to keep embedded user money
bags in the schema.

**Cómo verificar:** Use the newer 2026-05-24 verification set for RPG state:
`bun test src/db src/features/rpg src/features/economy`, `bun run typecheck`,
targeted Biome, `git diff --check`, and `bun run start`.

## 2026-05-22 - Framework cleanup: dead router method + storage barrel boundary

**Cambio:** Se eliminó `ComponentRouter.dispatch()` (método muerto; `bootstrap.ts` usa
`router.resolve()` directamente y no había call-sites). Se corrigió `docs/storage.md` para importar
los adapters desde `@/framework/storage` en lugar del barrel `@/framework`.

**Motivo:** `dispatch()` era una segunda forma, no usada, de hacer lo que ya hace `resolve()`. El
doc prometía un import (`@/framework`) que el barrel `src/framework/index.ts` no exporta — drift
doc/código.

**Alternativas:** Exponer los adapters en el barrel `@/framework` para cumplir el doc fue rechazado:
anunciaría una segunda ruta de persistencia junto a `World`, en contra de la política latest-only y
del criterio de mantener mínima la superficie pública (`docs/codebase-audit.md`).

**Riesgos:** Bajo. Borrar código muerto no cambia comportamiento; el cambio de doc no toca runtime.

**Cómo verificar:** `bun test src/framework`, `bun run typecheck`, `bun run check`. Confirmar
`rg "\.dispatch\(" src` sin resultados.

## 2026-05-19 - Market vertical slice boundaries

**Cambio:** `src/features/economy/market.ts` now keeps the command-facing orchestration API, while market result/config/error types, pure listing transitions, and the legacy listing-store adapter live in focused modules.

**Motivo:** Market mixes money movement, inventory escrow, listing CAS, cooldowns, and legacy repository access. Splitting pure decisions from persistence makes the rollback path readable without changing command behavior.

**Alternativas:** A full move into `src/core/economy/market/*` was rejected for this iteration because `market.ts` is still the public import path for commands and tests. Keeping wrappers avoids import churn while the repo is already dirty.

**Riesgos:** The adapter still depends on the legacy `MongoStore` repository, so the persistence boundary is clearer but not fully migrated. Rollback remains best-effort when multiple downstream writes fail.

**Cómo verificar:** Run `bun test src/features/economy/market.test.ts`, `bun test src/features/economy`, `bun run typecheck`, and `biome check` on the touched market files.

## 2026-05-19 - Counting runtime wiring

**Cambio:** `counting` moved from a manual `register(client)` listener under `handlers/messageCreate.ts` to the current feature-loader contract: a top-level `handlers.ts` class with `@Listen("messageCreate")`.

**Motivo:** The active loader only discovers `<feature>/handlers.ts`; the old nested register function was not reachable at runtime. The domain state machine stayed in `processCountingMessage`.

**Alternativas:** Reintroducing a manual registration hook or widening the loader to scan nested handler files was rejected. Both would make the runtime contract less obvious.

**Riesgos:** Raw Discord listeners bypass command feature middleware, so counting still performs its own feature-toggle and configured-channel checks inside the handler.

**Cómo verificar:** Run `bun test src/features/counting`, `bun test src/framework`, and `bun run typecheck`.

## 2026-05-19 - Feature config catalog metadata

**Cambio:** Feature descriptors remain loader-only, while dashboard-editable feature config is attached through the explicit `FEATURE_CONFIGS` registry consumed by `setFeatureCatalog`.

**Motivo:** `listConfigurableFeatures()` needs config metadata for admin/webapp surfaces, but putting config on `defineFeature` would pollute the runtime descriptor and violate the current authoring rules.

**Alternativas:** Dynamic config discovery and descriptor-level config fields were rejected. The first adds loader behavior for one known need; the second weakens the descriptor boundary.

**Riesgos:** The registry must be updated when a new feature adds dashboard config. That explicit step is acceptable because config metadata is rare and admin-facing.

**Cómo verificar:** Run `bun test src/core/featureConfig.test.ts src/core/featureCatalog.test.ts src/features/adminPanels`, `bun test src/framework`, and `bun run typecheck`.

## 2026-05-19 - Legacy event bus boundary

**Cambio:** `src/core/bus.ts` is documented as a legacy dashboard/SSE bridge, not the general feature runtime bus.

**Motivo:** The current runtime already has `framework/event-bus` via `ctx.emit(...)` and `@On(EventClass)`. The string-keyed core bus remains only for live moderation/appeal projections consumed by the embedded webapp.

**Alternativas:** Migrating every core bus event now was rejected because it would pull moderation and webapp behavior into the stabilization slice.

**Riesgos:** Existing events still use a legacy path. The boundary is now explicit so new runtime events do not grow that surface by accident.

**Cómo verificar:** Run `bun test src/webapp/bot-bridge.test.ts`, `bun test src/framework`, and `bun run typecheck`.
