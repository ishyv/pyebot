// Helper script to test AI item generation with DB CACHING!
// Run this directly via `bun src/features/rpg/crafting/tests/test_ai_alchemy.ts`

import { config } from "dotenv";
config(); // Load .env

import { resolveCrucible, type ItemData } from "@/features/rpg/crafting/alchemy";

const BASE_ITEMS: Record<string, ItemData> = {
  stone: { id: "stone", name: "Stone", trait1: "Density", trait2: "None" },
  iron_ore: { id: "iron_ore", name: "Iron Ore", trait1: "Density", trait2: "Sharpness" },
  copper_ore: { id: "copper_ore", name: "Copper Ore", trait1: "Density", trait2: "None" },
  oak_wood: { id: "oak_wood", name: "Oak Wood", trait1: "Organic", trait2: "Density" },
  spruce_wood: { id: "spruce_wood", name: "Spruce Wood", trait1: "Organic", trait2: "None" },
  red_herb: { id: "red_herb", name: "Red Herb", trait1: "Organic", trait2: "Magic" },
  wolf_tooth: { id: "wolf_tooth", name: "Wolf Tooth", trait1: "Sharpness", trait2: "Organic" },
  ruby: { id: "ruby", name: "Ruby", trait1: "Magic", trait2: "Density" },
  demon_blood: { id: "demon_blood", name: "Demon Blood", trait1: "Toxicity", trait2: "Liquid" },
};

async function runTests() {
  console.log("🔥 IGNITING THE CACHED CRUCIBLE 🔥\n");

  const combos = [
    [BASE_ITEMS.iron_ore, BASE_ITEMS.wolf_tooth, BASE_ITEMS.ruby],
    [BASE_ITEMS.iron_ore, BASE_ITEMS.wolf_tooth, BASE_ITEMS.ruby], // Repeat to test cache!
    [BASE_ITEMS.red_herb, BASE_ITEMS.demon_blood, BASE_ITEMS.oak_wood],
  ];

  let i = 1;
  for (const combo of combos) {
    console.log(`[Test ${i}] 🧪 Mixing: ${combo.map(c => c.name).join(" + ")}`);
    
    const startTime = Date.now();
    const result = await resolveCrucible("test_user_id", combo[0], combo[1], combo[2]);
    const duration = Date.now() - startTime;

    console.log(`   💎 RESULT: "\x1b[35m${result.outputName}\x1b[0m"`);
    console.log(`   ✨ New Discovery?: ${result.isNewDiscovery ? "✅ YES (AI was called)" : "❌ NO (Pulled from DB Cache)"}`);
    console.log(`   ⏱️  Time Taken: ${duration}ms\n`);
    
    i++;
    // Small delay to let DB breath
    await new Promise(r => setTimeout(r, 500));
  }

  console.log("If Test 2 was 'NO' and much faster than Test 1, the caching system is working perfectly.");
  process.exit(0);
}

runTests();
