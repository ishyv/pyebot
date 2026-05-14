import { defineFeature } from "@/framework";

export default defineFeature({
  id: "counting",
  name: "Counting",
  description: "Counting game channel.",
  gate: "counting",
  defaultEnabled: false,
});
