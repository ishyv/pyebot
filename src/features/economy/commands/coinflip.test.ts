import { describe, expect, it } from "bun:test";
import { DEFAULT_COINFLIP_CONFIG, MinigameError } from "@/features/economy/minigames";
import { coinflipErrorCopy, data } from "./coinflip";

describe("coinflip command", () => {
  it("advertises the real minimum bet to Discord", () => {
    const json = data.toJSON() as { options?: Array<{ name: string; min_value?: number }> };
    const amount = json.options?.find((option) => option.name === "amount");

    expect(amount?.min_value).toBe(DEFAULT_COINFLIP_CONFIG.minBet);
  });

  it("formats minimum-bet rejection as expected user guidance", () => {
    const copy = coinflipErrorCopy(new MinigameError("BET_TOO_LOW", "Bet must be at least 5"));

    expect(copy.title).toBe("Minimum Bet");
    expect(copy.description).toContain("at least 5 coins");
    expect(copy.description).not.toContain("Error:");
  });
});
