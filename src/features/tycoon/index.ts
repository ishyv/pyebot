/**
 * Tycoon feature manifest — "Guild Automated Works".
 *
 * An idle/automation layer over the RPG economy: players charter automated
 * production lines (extractor → refinery → assembler), balance stage throughput
 * around the bottleneck, and collect lazily-accrued output as scrip or as real
 * refined materials.
 *
 * Surface: /tycoon charter|collect|upgrade (more subcommands added per build step).
 * Component routes: tycoon: (dashboard buttons).
 */

import { defineFeature } from "@/framework";

export default defineFeature({
  id: "tycoon",
  name: "Tycoon",
  description: "Automated production lines — build, balance, and collect idle income.",
  defaultEnabled: true,
});
