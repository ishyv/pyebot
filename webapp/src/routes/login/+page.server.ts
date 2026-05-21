import { requireEnv } from "$lib/server/auth";

export function load({ url }) {
  let missing: string[] = [];

  try {
    requireEnv();
  } catch (error) {
    missing =
      error instanceof Error
        ? error.message.replace("Missing dashboard environment: ", "").split(", ")
        : [];
  }

  return {
    missing,
    error: url.searchParams.get("error"),
  };
}
