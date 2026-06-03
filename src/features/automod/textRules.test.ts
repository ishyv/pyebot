import { describe, expect, it } from "bun:test";
import { GuildSchema } from "@/db/schemas/guild";
import { detectMessageContentSignals } from "./service";
import { type AutomodTextRule, findTextRuleMatch } from "./textRules";

const baseRule = {
  id: "badword",
  enabled: true,
  phrases: ["badword"],
  action: "delete",
  timeoutSeconds: 300,
} satisfies AutomodTextRule;

function message(content: string) {
  return {
    id: "message-1",
    content,
    channelId: "channel-1",
    author: { id: "user-1", createdTimestamp: Date.now() - 30 * 24 * 60 * 60 * 1000 },
    guild: { id: "guild-1" },
    stickers: { size: 0 },
    attachments: { size: 0 },
  };
}

describe("automod text rules", () => {
  it("matches plain phrases through repeated same-character separators", () => {
    const rules = [baseRule];

    expect(findTextRuleMatch("badword", rules)?.rule.id).toBe("badword");
    expect(findTextRuleMatch("b.a.d.w.o.r.d", rules)?.rule.id).toBe("badword");
    expect(findTextRuleMatch("b-a-d-w-o-r-d", rules)?.rule.id).toBe("badword");
    expect(findTextRuleMatch("b a d w o r d", rules)?.rule.id).toBe("badword");
    expect(findTextRuleMatch("b\u200ba\u200bd\u200bw\u200bo\u200br\u200bd", rules)?.rule.id).toBe(
      "badword",
    );
    expect(findTextRuleMatch("b.-a_.d w.o-r_d", rules)).toBeNull();
  });

  it("matches common leetspeak substitutions without matching inside larger words", () => {
    const rules = [{ ...baseRule, id: "bad", phrases: ["bad"] }];

    expect(findTextRuleMatch("b@d", rules)?.rule.id).toBe("bad");
    expect(findTextRuleMatch("b4d", rules)?.rule.id).toBe("bad");
    expect(findTextRuleMatch("badminton", rules)).toBeNull();
  });

  it("ignores disabled rules", () => {
    expect(findTextRuleMatch("badword", [{ ...baseRule, enabled: false }])).toBeNull();
  });

  it("matches any phrase configured under the same rule", () => {
    const rules = [{ ...baseRule, id: "blocked", phrases: ["badword", "worse word"] }];

    expect(findTextRuleMatch("badword", rules)?.rule.id).toBe("blocked");
    expect(findTextRuleMatch("worse-word", rules)?.rule.id).toBe("blocked");
  });

  it("normalizes legacy singular phrase config into the phrase list", () => {
    const config = GuildSchema.parse({
      _id: "guild-1",
      automod: {
        textRules: [
          {
            id: "legacy",
            enabled: true,
            phrase: "badword",
            action: "delete",
            timeoutSeconds: 300,
          },
        ],
      },
    }).automod;

    expect(config.textRules).toEqual([
      {
        id: "legacy",
        enabled: true,
        phrases: ["badword"],
        action: "delete",
        timeoutSeconds: 300,
      },
    ]);
  });

  it("emits text-rule signals with per-rule action and timeout evidence", () => {
    const config = GuildSchema.parse({
      _id: "guild-1",
      automod: {
        textRules: [
          {
            id: "badword",
            enabled: true,
            phrases: ["badword"],
            action: "timeout",
            timeoutSeconds: 900,
          },
        ],
      },
    }).automod;

    const signals = detectMessageContentSignals(message("b.a.d.w.o.r.d") as never, config);
    const signal = signals.find((entry) => entry.detectorId === "textRule");

    expect(signal).toMatchObject({
      detectorId: "textRule",
      ruleId: "badword",
      recommendedAction: "timeout",
      punishmentEligible: true,
      severity: "critical",
      evidence: {
        summary: "Text rule match: badword",
        matchedText: "b.a.d.w.o.r.d",
        matchedRule: "badword",
        metadata: { timeoutSeconds: 900 },
      },
    });
  });
});
