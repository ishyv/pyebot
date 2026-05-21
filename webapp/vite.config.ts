import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  server: {
    fs: {
      allow: [".."],
    },
  },
  resolve: {},
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
  },
});
