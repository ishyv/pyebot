/**
 * Utility feature manifest — `/help` and friends.
 */

import { defineFeature } from "@/framework";

export default defineFeature({
  id: "utility",
  name: "Utility",
  description: "Help and other small quality-of-life commands.",
  defaultEnabled: true,
});
