import { describe, expect, test } from "bun:test";
import {
  Button,
  compileFeatureClass,
  compileFeatureModules,
  Event,
  Feature,
  SlashCommand,
} from "@/framework";

describe("decorator feature compiler", () => {
  test("compiles a decorated feature class into the existing feature module shape", () => {
    @Feature({ id: "hello", gate: "hello", intents: ["Guilds"] })
    class HelloFeature {
      @SlashCommand({ name: "hello", description: "Say hello" })
      async hello() {}

      @Button({ prefix: "hello:" })
      async button() {}
    }

    const mod = compileFeatureClass(HelloFeature);

    expect(mod.id).toBe("hello");
    expect(mod.featureGate).toBe("hello");
    expect(mod.commands.map((command) => command.data.name)).toEqual(["hello"]);
    expect(mod.components?.[0]?.matches("hello:ok")).toBe(true);
  });

  test("rejects duplicate command names across compiled features", () => {
    @Feature({ id: "one" })
    class OneFeature {
      @SlashCommand({ name: "same", description: "One" })
      async same() {}
    }

    @Feature({ id: "two" })
    class TwoFeature {
      @SlashCommand({ name: "same", description: "Two" })
      async same() {}
    }

    expect(() => compileFeatureModules([OneFeature, TwoFeature])).toThrow(
      'Command "same" is already registered',
    );
  });

  test("rejects duplicate component prefixes across compiled features", () => {
    @Feature({ id: "one" })
    class OneFeature {
      @Button({ prefix: "shared:" })
      async first() {}
    }

    @Feature({ id: "two" })
    class TwoFeature {
      @Button({ prefix: "shared:" })
      async second() {}
    }

    expect(() => compileFeatureModules([OneFeature, TwoFeature])).toThrow(
      'Component prefix "shared:" is already registered',
    );
  });

  test("requires feature intents for event handlers that declare intent requirements", () => {
    @Feature({ id: "messages" })
    class MessageFeature {
      @Event({ name: "messageCreate", intents: ["GuildMessages"] })
      async onMessage() {}
    }

    expect(() => compileFeatureClass(MessageFeature)).toThrow(
      'Feature "messages" handles "messageCreate" but does not declare required intent "GuildMessages"',
    );
  });
});
