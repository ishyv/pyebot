import adapter from "@sveltejs/adapter-node";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter(),
    alias: {
      "$shared/bridge-types": "../src/webapp/bridge-types.ts",
      "$shared/embed-config": "../src/db/schemas/embed-config.ts",
    },
  },
};

export default config;
