# Framework Authoring

New bot code should be written as decorated feature classes and passed to `createBot`.

## Feature Classes

```ts
import type { ChatInputCommandInteraction } from "discord.js";
import { Feature, SlashCommand } from "@/framework";

@Feature({ id: "polls", gate: "polls", intents: ["Guilds"] })
export class PollsFeature {
  @SlashCommand({ name: "poll", description: "Create a poll" })
  async poll(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.reply("Poll created.");
  }
}
```

Decorators collect metadata only. Startup compiles feature classes into explicit registry records and validates duplicate feature IDs, duplicate command names, duplicate component prefixes, and event intent declarations.

## Components

```ts
import type { ButtonInteraction } from "discord.js";
import { Button, Feature } from "@/framework";

@Feature({ id: "confirm", intents: ["Guilds"] })
export class ConfirmFeature {
  @Button({
    prefix: "confirm:",
    parse: (customId) => ({ actionId: customId.slice("confirm:".length) }),
  })
  async confirm(interaction: ButtonInteraction, parsed: { actionId: string }): Promise<void> {
    await interaction.reply(`Confirmed ${parsed.actionId}.`);
  }
}
```

The prefix is both documentation and a startup uniqueness key. Do not use one generic prefix for unrelated actions.

## Events And Intents

```ts
@Feature({ id: "counting", intents: ["GuildMessages", "MessageContent"] })
class CountingFeature {
  @Event({ name: "messageCreate", intents: ["GuildMessages"] })
  async onMessage(message: import("discord.js").Message): Promise<void> {
    // ...
  }
}
```

Event decorators can declare required intents. The compiler rejects a feature that handles an event without declaring those intents in `@Feature`.

## Jobs

```ts
@Feature({ id: "maintenance" })
class MaintenanceFeature {
  @Job({ name: "sweep-expired", everyMs: 60_000, runOnReady: true })
  async sweepExpired(): Promise<void> {
    // ...
  }
}
```

Jobs are owned by the framework runtime. Shutdown clears their intervals before calling feature shutdown hooks.

## Compatibility

Legacy `FeatureModule` objects still work and can be mixed with decorated classes:

```ts
createBot({
  name: "mixed-bot",
  features: [LegacyFeatureModule, NewFeatureClass],
});
```

This compatibility exists to make migration safe. New features should use decorated classes.
