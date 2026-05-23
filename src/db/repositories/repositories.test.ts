import { describe, expect, test } from "bun:test";

const usersRepoPath = "./users.ts?repository-exports-test";
const guildsRepoPath = "./guilds.ts?repository-exports-test";
const rpgRepoPath = "./rpg.ts?repository-exports-test";

describe("repositories (unit — exports)", () => {
  test("users repo exports expected functions", async () => {
    const repo = (await import(usersRepoPath)) as typeof import("./users");
    expect(typeof repo.getUser).toBe("function");
    expect(typeof repo.ensureUser).toBe("function");
    expect(typeof repo.patchUser).toBe("function");
    expect(typeof repo.replaceUserIfMatch).toBe("function");
    expect(typeof repo.updateUserPaths).toBe("function");
    expect(typeof repo.userStore).toBe("object");
  });

  test("guilds repo exports expected functions", async () => {
    const repo = (await import(guildsRepoPath)) as typeof import("./guilds");
    expect(typeof repo.getGuild).toBe("function");
    expect(typeof repo.ensureGuild).toBe("function");
    expect(typeof repo.patchGuild).toBe("function");
    expect(typeof repo.updateGuildPaths).toBe("function");
    expect(typeof repo.guildStore).toBe("object");
  });

  test("rpg repo exports expected functions", async () => {
    const repo = (await import(rpgRepoPath)) as typeof import("./rpg");
    expect(typeof repo.getRpgProfile).toBe("function");
    expect(typeof repo.ensureRpgProfile).toBe("function");
    expect(typeof repo.patchRpgProfile).toBe("function");
    // rpgStore is re-exported from userStore
    expect(repo.rpgStore).toBeDefined();
  });
});
