import { describe, expect, test } from "bun:test";
import { createDoctorReport } from "@/framework/doctor";

describe("createDoctorReport", () => {
  test("fails before startup when Bun is missing", () => {
    const report = createDoctorReport({
      bunVersion: null,
      env: { DISCORD_TOKEN: "token", CLIENT_ID: "client" },
      nodeModulesPresent: true,
      lockfilePresent: true,
    });

    expect(report.ok).toBe(false);
    expect(report.checks).toContainEqual(
      expect.objectContaining({
        id: "bun",
        status: "fail",
      }),
    );
  });

  test("requires DISCORD_TOKEN", () => {
    const report = createDoctorReport({
      bunVersion: "1.1.0",
      env: { DISCORD_TOKEN: "token", CLIENT_ID: "client" },
      nodeModulesPresent: true,
      lockfilePresent: true,
    });

    expect(report.checks.find((check) => check.id === "discord-token")?.status).toBe("pass");
  });

  test("mentions Mongo transaction requirement when Mongo is configured", () => {
    const report = createDoctorReport({
      bunVersion: "1.1.0",
      env: { DISCORD_TOKEN: "token", CLIENT_ID: "client", MONGO_URI: "mongodb://localhost:27017" },
      nodeModulesPresent: true,
      lockfilePresent: true,
    });

    expect(report.checks.find((check) => check.id === "mongo")?.message).toContain(
      "marketplace writes require MongoDB transactions",
    );
  });

  test("does not accept TOKEN as an alias", () => {
    const report = createDoctorReport({
      bunVersion: "1.1.0",
      env: { TOKEN: "token", CLIENT_ID: "client" },
      nodeModulesPresent: true,
      lockfilePresent: true,
    });

    expect(report.checks.find((check) => check.id === "discord-token")?.status).toBe("fail");
  });

  test("warns when Mongo is not configured because dev storage can still run", () => {
    const report = createDoctorReport({
      bunVersion: "1.1.0",
      env: { DISCORD_TOKEN: "token", CLIENT_ID: "client" },
      nodeModulesPresent: true,
      lockfilePresent: true,
    });

    expect(report.checks.find((check) => check.id === "mongo")?.status).toBe("warn");
    expect(report.ok).toBe(true);
  });
});
