/**
 * Command metadata checks for the tycoon slash-command front door.
 */

import { describe, expect, test } from "bun:test";
import tycoonCommand from "./tycoon";

describe("/tycoon command", () => {
  test("uses play, not view, as the dashboard entrypoint", () => {
    const json = tycoonCommand.data.toJSON() as { options?: Array<{ name: string }> };
    const subcommands = (json.options ?? []).map((option) => option.name);

    expect(subcommands).toContain("play");
    expect(subcommands).not.toContain("view");
  });
});
