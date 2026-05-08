import { defineContentPack } from "@/content/authoring";

/**
 * Canonical built-in RPG content.
 *
 * Add new RPG items, deterministic crafting recipes, locations, and drop tables here.
 * The helpers preserve literal IDs so TypeScript can catch bad references before startup.
 */
export const DEFAULT_CONTENT_PACK = defineContentPack({
  id: "ashenmoor_default",

  items: {
  "stone": {
    "id": "stone",
    "name": "Stone",
    "category": "mineral",
    "rarity": "common",
    "trait1": "Density",
    "trait2": "None",
    "sources": [
      "gather"
    ],
    "description": "Common grey stone. The foundation of everything and the value of nothing."
  },
  "stone_block": {
    "id": "stone_block",
    "name": "Stone Block",
    "category": "component",
    "rarity": "common",
    "trait1": "Density",
    "trait2": "None",
    "sources": [
      "craft"
    ],
    "description": "Squared stone fit for walls, roads, and other stubborn things."
  },
  "copper_ore": {
    "id": "copper_ore",
    "name": "Copper Ore",
    "category": "mineral",
    "rarity": "common",
    "trait1": "Density",
    "trait2": "None",
    "sources": [
      "gather"
    ],
    "description": "Dull green-brown ore. The Accord mints its coins from this. Ironic."
  },
  "iron_ore": {
    "id": "iron_ore",
    "name": "Iron Ore",
    "category": "mineral",
    "rarity": "uncommon",
    "trait1": "Density",
    "trait2": "Sharpness",
    "sources": [
      "gather"
    ],
    "description": "Deep-vein iron with crystalline grain structure. Cuts the hand that mines it."
  },
  "tin_ore": {
    "id": "tin_ore",
    "name": "Tin Ore",
    "category": "mineral",
    "rarity": "common",
    "trait1": "Density",
    "trait2": "None",
    "sources": [
      "gather"
    ],
    "description": "Soft, malleable ore. Worthless alone. Essential in alloys."
  },
  "silver_ore": {
    "id": "silver_ore",
    "name": "Silver Ore",
    "category": "mineral",
    "rarity": "uncommon",
    "trait1": "Density",
    "trait2": "Magic",
    "sources": [
      "gather"
    ],
    "description": "Pale ore that hums faintly under torchlight. Conducts essence better than copper."
  },
  "coal": {
    "id": "coal",
    "name": "Coal",
    "category": "mineral",
    "rarity": "common",
    "trait1": "Density",
    "trait2": "Toxicity",
    "sources": [
      "gather"
    ],
    "description": "Burns hot and dirty. Every forge in every settlement runs on this."
  },
  "sulfur": {
    "id": "sulfur",
    "name": "Sulfur",
    "category": "mineral",
    "rarity": "uncommon",
    "trait1": "Toxicity",
    "trait2": "None",
    "sources": [
      "gather",
      "expedition"
    ],
    "description": "Yellow crystalline powder. Stinks of rotten eggs. Essential for black powder."
  },
  "quartz": {
    "id": "quartz",
    "name": "Quartz",
    "category": "mineral",
    "rarity": "uncommon",
    "trait1": "Magic",
    "trait2": "None",
    "sources": [
      "gather"
    ],
    "description": "Translucent crystal that refracts light into colors that shouldn't exist."
  },
  "obsidian_shard": {
    "id": "obsidian_shard",
    "name": "Obsidian Shard",
    "category": "mineral",
    "rarity": "rare",
    "trait1": "Sharpness",
    "trait2": "Density",
    "sources": [
      "expedition"
    ],
    "description": "Volcanic glass. Fractures into edges sharper than any forged blade."
  },
  "ruby": {
    "id": "ruby",
    "name": "Ruby",
    "category": "mineral",
    "rarity": "rare",
    "trait1": "Magic",
    "trait2": "Density",
    "sources": [
      "gather",
      "expedition"
    ],
    "description": "Deep crimson gemstone from the lowest mine shafts. Natural essence battery."
  },
  "sapphire": {
    "id": "sapphire",
    "name": "Sapphire",
    "category": "mineral",
    "rarity": "rare",
    "trait1": "Magic",
    "trait2": "Liquid",
    "sources": [
      "expedition"
    ],
    "description": "Deep blue stone found near underground water sources. Resonates with liquid essence."
  },
  "raw_essence_crystal": {
    "id": "raw_essence_crystal",
    "name": "Raw Essence Crystal",
    "category": "mineral",
    "rarity": "legendary",
    "trait1": "Magic",
    "trait2": "Magic",
    "sources": [
      "expedition"
    ],
    "description": "Crystallized pure essence. Warm to the touch. Looking at it too long causes headaches."
  },
  "oak_wood": {
    "id": "oak_wood",
    "name": "Oak Wood",
    "category": "timber",
    "rarity": "common",
    "trait1": "Organic",
    "trait2": "Density",
    "sources": [
      "gather"
    ],
    "description": "Dense hardwood from the outer Whispering Woods. Still hums faintly when cut."
  },
  "spruce_wood": {
    "id": "spruce_wood",
    "name": "Spruce Wood",
    "category": "timber",
    "rarity": "common",
    "trait1": "Organic",
    "trait2": "None",
    "sources": [
      "gather"
    ],
    "description": "Light, flexible softwood. Good for handles, arrows, and kindling."
  },
  "palm_wood": {
    "id": "palm_wood",
    "name": "Palm Wood",
    "category": "timber",
    "rarity": "uncommon",
    "trait1": "Organic",
    "trait2": "Liquid",
    "sources": [
      "gather"
    ],
    "description": "Fibrous coastal timber. Retains moisture. Resistant to rot."
  },
  "pine_wood": {
    "id": "pine_wood",
    "name": "Pine Wood",
    "category": "timber",
    "rarity": "uncommon",
    "trait1": "Organic",
    "trait2": "None",
    "sources": [
      "gather"
    ],
    "description": "Resinous northern wood. Burns slow and smells of turpentine."
  },
  "ironwood": {
    "id": "ironwood",
    "name": "Ironwood",
    "category": "timber",
    "rarity": "rare",
    "trait1": "Organic",
    "trait2": "Density",
    "sources": [
      "expedition"
    ],
    "description": "Wood so dense it sinks in water. The deep-forest trees grow in essence-saturated soil."
  },
  "charcoal": {
    "id": "charcoal",
    "name": "Charcoal",
    "category": "timber",
    "rarity": "common",
    "trait1": "Density",
    "trait2": "Toxicity",
    "sources": [
      "craft"
    ],
    "description": "Slow-burned wood. Hotter and cleaner than coal. Every alchemist keeps a supply."
  },
  "resin": {
    "id": "resin",
    "name": "Tree Resin",
    "category": "timber",
    "rarity": "common",
    "trait1": "Organic",
    "trait2": "Liquid",
    "sources": [
      "gather"
    ],
    "description": "Amber sap that hardens on contact with air. Natural adhesive and sealant."
  },
  "rotted_wood": {
    "id": "rotted_wood",
    "name": "Rotted Wood",
    "category": "timber",
    "rarity": "common",
    "trait1": "Organic",
    "trait2": "Toxicity",
    "sources": [
      "gather",
      "expedition"
    ],
    "description": "Decayed timber from deep forest floors. Crawling with fungal life. Handle carefully."
  },
  "red_herb": {
    "id": "red_herb",
    "name": "Red Herb",
    "category": "herb",
    "rarity": "uncommon",
    "trait1": "Organic",
    "trait2": "Magic",
    "sources": [
      "gather",
      "expedition"
    ],
    "description": "Grows in essence-rich clearings. The base ingredient for most healing compounds."
  },
  "blue_moss": {
    "id": "blue_moss",
    "name": "Blue Moss",
    "category": "herb",
    "rarity": "uncommon",
    "trait1": "Organic",
    "trait2": "Liquid",
    "sources": [
      "gather",
      "expedition"
    ],
    "description": "Bioluminescent cave moss. Thrives in wet, dark, essence-dense environments."
  },
  "nightshade": {
    "id": "nightshade",
    "name": "Nightshade",
    "category": "herb",
    "rarity": "rare",
    "trait1": "Organic",
    "trait2": "Toxicity",
    "sources": [
      "expedition"
    ],
    "description": "Deadly purple berries. Everything about this plant wants to kill you."
  },
  "glowcap_mushroom": {
    "id": "glowcap_mushroom",
    "name": "Glowcap Mushroom",
    "category": "herb",
    "rarity": "uncommon",
    "trait1": "Magic",
    "trait2": "Organic",
    "sources": [
      "expedition"
    ],
    "description": "Pale mushroom that emits soft light. Grows on essence-saturated deadwood."
  },
  "thornvine": {
    "id": "thornvine",
    "name": "Thornvine",
    "category": "herb",
    "rarity": "common",
    "trait1": "Sharpness",
    "trait2": "Organic",
    "sources": [
      "gather"
    ],
    "description": "Barbed creeping vine. The thorns are essence-hardened to a razor edge."
  },
  "dried_tobacco": {
    "id": "dried_tobacco",
    "name": "Dried Tobacco",
    "category": "herb",
    "rarity": "common",
    "trait1": "Organic",
    "trait2": "Toxicity",
    "sources": [
      "gather",
      "shop"
    ],
    "description": "Frontier luxury. Calms the nerves. Ruins the lungs. Everyone smokes it anyway."
  },
  "ghost_lily": {
    "id": "ghost_lily",
    "name": "Ghost Lily",
    "category": "herb",
    "rarity": "rare",
    "trait1": "Magic",
    "trait2": "Organic",
    "sources": [
      "expedition"
    ],
    "description": "Translucent white flower found near Blight zones. Wilts within hours of picking."
  },
  "swamp_root": {
    "id": "swamp_root",
    "name": "Swamp Root",
    "category": "herb",
    "rarity": "uncommon",
    "trait1": "Organic",
    "trait2": "Toxicity",
    "sources": [
      "gather",
      "expedition"
    ],
    "description": "Thick, gnarled root pulled from marshland. Bitter but medicinal when prepared."
  },
  "lavender": {
    "id": "lavender",
    "name": "Lavender",
    "category": "herb",
    "rarity": "common",
    "trait1": "Organic",
    "trait2": "Magic",
    "sources": [
      "gather"
    ],
    "description": "Fragrant purple herb. One of the few pleasant things in Ashenmoor."
  },
  "bark_tea_leaves": {
    "id": "bark_tea_leaves",
    "name": "Bark Tea Leaves",
    "category": "herb",
    "rarity": "common",
    "trait1": "Organic",
    "trait2": "None",
    "sources": [
      "gather"
    ],
    "description": "Stripped from the inner bark of young oaks. Makes a bitter, restorative tea."
  },
  "witchgrass": {
    "id": "witchgrass",
    "name": "Witchgrass",
    "category": "herb",
    "rarity": "uncommon",
    "trait1": "Magic",
    "trait2": "Toxicity",
    "sources": [
      "expedition"
    ],
    "description": "Thin black grass that grows in perfect circles. Essence radiates from the roots."
  },
  "corpse_flower": {
    "id": "corpse_flower",
    "name": "Corpse Flower",
    "category": "herb",
    "rarity": "rare",
    "trait1": "Toxicity",
    "trait2": "Magic",
    "sources": [
      "expedition"
    ],
    "description": "Blooms only on ground where something died. Smells exactly like its name."
  },
  "wolf_tooth": {
    "id": "wolf_tooth",
    "name": "Wolf Tooth",
    "category": "animal",
    "rarity": "uncommon",
    "trait1": "Sharpness",
    "trait2": "Organic",
    "sources": [
      "expedition",
      "drop"
    ],
    "description": "Crystalline fang from a Whispering Woods predator. Sharper than it has any right to be."
  },
  "wolf_pelt": {
    "id": "wolf_pelt",
    "name": "Wolf Pelt",
    "category": "animal",
    "rarity": "uncommon",
    "trait1": "Organic",
    "trait2": "Density",
    "sources": [
      "expedition",
      "drop"
    ],
    "description": "Thick, coarse fur. Insulates against cold and minor essence exposure."
  },
  "boar_tusk": {
    "id": "boar_tusk",
    "name": "Boar Tusk",
    "category": "animal",
    "rarity": "uncommon",
    "trait1": "Sharpness",
    "trait2": "Density",
    "sources": [
      "expedition",
      "drop"
    ],
    "description": "Partially calcified tusk from a Stoneback Boar. Dense as horn, sharp as flint."
  },
  "boar_hide": {
    "id": "boar_hide",
    "name": "Boar Hide",
    "category": "animal",
    "rarity": "uncommon",
    "trait1": "Density",
    "trait2": "Organic",
    "sources": [
      "expedition",
      "drop"
    ],
    "description": "Tough, stone-flecked hide. Natural armor that makes tanning a nightmare."
  },
  "veilmoth_wing": {
    "id": "veilmoth_wing",
    "name": "Veilmoth Wing",
    "category": "animal",
    "rarity": "rare",
    "trait1": "Magic",
    "trait2": "Organic",
    "sources": [
      "expedition"
    ],
    "description": "Iridescent wing membrane. Dissolves in sunlight. Must be stored in darkness."
  },
  "cave_lurker_claw": {
    "id": "cave_lurker_claw",
    "name": "Cave Lurker Claw",
    "category": "animal",
    "rarity": "rare",
    "trait1": "Sharpness",
    "trait2": "Toxicity",
    "sources": [
      "expedition",
      "drop"
    ],
    "description": "Retractable talon from the Deep Mine predators. Coated in a numbing secretion."
  },
  "rat_tail": {
    "id": "rat_tail",
    "name": "Rat Tail",
    "category": "animal",
    "rarity": "common",
    "trait1": "Organic",
    "trait2": "Toxicity",
    "sources": [
      "expedition",
      "drop"
    ],
    "description": "From the oversized tunnel rats. Worth almost nothing. Alchemists buy them in bulk."
  },
  "crow_feather": {
    "id": "crow_feather",
    "name": "Crow Feather",
    "category": "animal",
    "rarity": "common",
    "trait1": "Organic",
    "trait2": "None",
    "sources": [
      "gather"
    ],
    "description": "Iridescent black feather. Crows in Ashenmoor are larger than they should be."
  },
  "snake_venom_sac": {
    "id": "snake_venom_sac",
    "name": "Snake Venom Sac",
    "category": "animal",
    "rarity": "rare",
    "trait1": "Toxicity",
    "trait2": "Liquid",
    "sources": [
      "expedition",
      "drop"
    ],
    "description": "Milky, translucent sac of concentrated venom. One puncture and you're dosing yourself."
  },
  "bone_fragment": {
    "id": "bone_fragment",
    "name": "Bone Fragment",
    "category": "animal",
    "rarity": "common",
    "trait1": "Density",
    "trait2": "Organic",
    "sources": [
      "expedition",
      "drop"
    ],
    "description": "Splintered bone of uncertain origin. Could be animal. Could be older."
  },
  "sinew": {
    "id": "sinew",
    "name": "Sinew",
    "category": "animal",
    "rarity": "common",
    "trait1": "Organic",
    "trait2": "Density",
    "sources": [
      "expedition",
      "drop"
    ],
    "description": "Dried tendon fiber. Stronger than rope when properly cured. Smells terrible."
  },
  "animal_fat": {
    "id": "animal_fat",
    "name": "Animal Fat",
    "category": "animal",
    "rarity": "common",
    "trait1": "Organic",
    "trait2": "Liquid",
    "sources": [
      "expedition",
      "drop"
    ],
    "description": "Rendered tallow. Fuel for lamps, base for soaps, lubricant for mechanisms."
  },
  "spider_silk": {
    "id": "spider_silk",
    "name": "Spider Silk",
    "category": "animal",
    "rarity": "rare",
    "trait1": "Organic",
    "trait2": "Magic",
    "sources": [
      "expedition"
    ],
    "description": "Harvested from the web-spinners of the deep forest. Stronger than steel by weight."
  },
  "demon_blood": {
    "id": "demon_blood",
    "name": "Demon Blood",
    "category": "animal",
    "rarity": "legendary",
    "trait1": "Toxicity",
    "trait2": "Liquid",
    "sources": [
      "expedition"
    ],
    "description": "Black ichor from things that live below the deepest mines. Corrodes metal on contact."
  },
  "volatile_ash": {
    "id": "volatile_ash",
    "name": "Volatile Ash",
    "category": "reagent",
    "rarity": "common",
    "trait1": "None",
    "trait2": "None",
    "sources": [
      "craft"
    ],
    "description": "The residue of a failed Crucible synthesis. Grey, inert, worthless. A reminder."
  },
  "essence_dust": {
    "id": "essence_dust",
    "name": "Essence Dust",
    "category": "reagent",
    "rarity": "uncommon",
    "trait1": "Magic",
    "trait2": "None",
    "sources": [
      "craft",
      "expedition"
    ],
    "description": "Fine powder scraped from essence-rich surfaces. Mild arcane charge."
  },
  "grey_salt": {
    "id": "grey_salt",
    "name": "Grey Salt",
    "category": "reagent",
    "rarity": "uncommon",
    "trait1": "Density",
    "trait2": "Magic",
    "sources": [
      "craft"
    ],
    "description": "Crystallized essence residue. Used to stabilize volatile alchemical reactions."
  },
  "black_powder": {
    "id": "black_powder",
    "name": "Black Powder",
    "category": "reagent",
    "rarity": "uncommon",
    "trait1": "Toxicity",
    "trait2": "Density",
    "sources": [
      "craft"
    ],
    "description": "Explosive compound. Coal, sulfur, and careful handling. Or careless — once."
  },
  "quicksilver": {
    "id": "quicksilver",
    "name": "Quicksilver",
    "category": "reagent",
    "rarity": "rare",
    "trait1": "Liquid",
    "trait2": "Toxicity",
    "sources": [
      "expedition",
      "craft"
    ],
    "description": "Liquid metal that pools in deep mine crevices. Fatally toxic if ingested."
  },
  "tallow": {
    "id": "tallow",
    "name": "Tallow",
    "category": "reagent",
    "rarity": "common",
    "trait1": "Organic",
    "trait2": "Liquid",
    "sources": [
      "craft"
    ],
    "description": "Rendered animal fat, purified for alchemical use. Burns clean."
  },
  "phosphite_powder": {
    "id": "phosphite_powder",
    "name": "Phosphite Powder",
    "category": "reagent",
    "rarity": "uncommon",
    "trait1": "Magic",
    "trait2": "Toxicity",
    "sources": [
      "craft"
    ],
    "description": "Glows faintly in the dark. Derived from cave minerals. Extremely irritating to skin."
  },
  "distilled_water": {
    "id": "distilled_water",
    "name": "Distilled Water",
    "category": "reagent",
    "rarity": "common",
    "trait1": "Liquid",
    "trait2": "None",
    "sources": [
      "craft",
      "shop"
    ],
    "description": "Water boiled and condensed to remove essence contamination. Pure. Tasteless."
  },
  "acid_vial": {
    "id": "acid_vial",
    "name": "Acid Vial",
    "category": "reagent",
    "rarity": "rare",
    "trait1": "Toxicity",
    "trait2": "Liquid",
    "sources": [
      "craft"
    ],
    "description": "Corrosive solution in a sealed glass container. Dissolves organic matter on contact."
  },
  "binding_agent": {
    "id": "binding_agent",
    "name": "Binding Agent",
    "category": "reagent",
    "rarity": "uncommon",
    "trait1": "Density",
    "trait2": "Liquid",
    "sources": [
      "craft"
    ],
    "description": "Thick paste made from resin and mineral powder. Holds anything to anything else."
  },
  "bandage": {
    "id": "bandage",
    "name": "Linen Bandage",
    "category": "medical",
    "rarity": "common",
    "trait1": "Organic",
    "trait2": "None",
    "sources": [
      "craft",
      "shop"
    ],
    "description": "Strips of clean cloth. Slows bleeding. Does not cure anything."
  },
  "healing_salve": {
    "id": "healing_salve",
    "name": "Healing Salve",
    "category": "medical",
    "rarity": "uncommon",
    "trait1": "Organic",
    "trait2": "Magic",
    "sources": [
      "craft"
    ],
    "description": "Red Herb-based ointment. Accelerates wound closure. Standard Therapist stock."
  },
  "antidote": {
    "id": "antidote",
    "name": "Antidote",
    "category": "medical",
    "rarity": "uncommon",
    "trait1": "Organic",
    "trait2": "Toxicity",
    "sources": [
      "craft"
    ],
    "description": "Neutralizes most common venoms and poisons. Tastes like chalk and regret."
  },
  "essence_ward": {
    "id": "essence_ward",
    "name": "Essence Ward",
    "category": "medical",
    "rarity": "rare",
    "trait1": "Magic",
    "trait2": "Density",
    "sources": [
      "craft"
    ],
    "description": "Small stone tablet inscribed with stabilizing runes. Slows Greying while carried."
  },
  "ration": {
    "id": "ration",
    "name": "Trail Ration",
    "category": "medical",
    "rarity": "common",
    "trait1": "Organic",
    "trait2": "None",
    "sources": [
      "shop",
      "craft"
    ],
    "description": "Dried meat, hardtack, and a pinch of salt. Keeps you moving. Barely."
  },
  "clean_water": {
    "id": "clean_water",
    "name": "Clean Water",
    "category": "medical",
    "rarity": "common",
    "trait1": "Liquid",
    "trait2": "None",
    "sources": [
      "craft",
      "shop"
    ],
    "description": "Filtered and boiled. The single most valuable thing in the frontier."
  },
  "alcohol": {
    "id": "alcohol",
    "name": "Rotgut Alcohol",
    "category": "medical",
    "rarity": "common",
    "trait1": "Liquid",
    "trait2": "Toxicity",
    "sources": [
      "shop",
      "craft"
    ],
    "description": "Frontier moonshine. Disinfects wounds. Also disinfects your will to live."
  },
  "stimulant_tonic": {
    "id": "stimulant_tonic",
    "name": "Stimulant Tonic",
    "category": "medical",
    "rarity": "uncommon",
    "trait1": "Liquid",
    "trait2": "Magic",
    "sources": [
      "craft"
    ],
    "description": "Bitter green liquid. Temporarily sharpens reflexes. Withdrawal hits like a cart."
  },
  "blood_vial": {
    "id": "blood_vial",
    "name": "Blood Vial",
    "category": "medical",
    "rarity": "rare",
    "trait1": "Organic",
    "trait2": "Liquid",
    "sources": [
      "craft",
      "expedition"
    ],
    "description": "Preserved blood treated with essence stabilizer. Emergency transfusion material."
  },
  "anti_grey_serum": {
    "id": "anti_grey_serum",
    "name": "Anti-Grey Serum",
    "category": "medical",
    "rarity": "legendary",
    "trait1": "Magic",
    "trait2": "Liquid",
    "sources": [
      "craft"
    ],
    "description": "Reverses early-stage Greying. The recipe is worth more than most settlements."
  },
  "iron_ingot": {
    "id": "iron_ingot",
    "name": "Iron Ingot",
    "category": "component",
    "rarity": "uncommon",
    "trait1": "Density",
    "trait2": "Sharpness",
    "sources": [
      "craft"
    ],
    "description": "Smelted iron bar. The building block of civilization's sharp edges."
  },
  "copper_ingot": {
    "id": "copper_ingot",
    "name": "Copper Ingot",
    "category": "component",
    "rarity": "common",
    "trait1": "Density",
    "trait2": "None",
    "sources": [
      "craft"
    ],
    "description": "Refined copper bar. Conducts essence moderately. Used in wiring and coinage."
  },
  "silver_ingot": {
    "id": "silver_ingot",
    "name": "Silver Ingot",
    "category": "component",
    "rarity": "uncommon",
    "trait1": "Density",
    "trait2": "Magic",
    "sources": [
      "craft"
    ],
    "description": "Refined silver bar. Clean, bright, and annoyingly valuable."
  },
  "steel_alloy": {
    "id": "steel_alloy",
    "name": "Steel Alloy",
    "category": "component",
    "rarity": "rare",
    "trait1": "Density",
    "trait2": "Sharpness",
    "sources": [
      "craft"
    ],
    "description": "Iron-carbon composite forged at extreme heat. Harder than iron. Holds an edge."
  },
  "leather_strip": {
    "id": "leather_strip",
    "name": "Leather Strip",
    "category": "component",
    "rarity": "common",
    "trait1": "Organic",
    "trait2": "Density",
    "sources": [
      "craft"
    ],
    "description": "Tanned hide cut into workable strips. Used in everything from armor to book bindings."
  },
  "rope": {
    "id": "rope",
    "name": "Rope",
    "category": "component",
    "rarity": "common",
    "trait1": "Organic",
    "trait2": "None",
    "sources": [
      "craft",
      "shop"
    ],
    "description": "Braided plant fiber. Holds weight, binds cargo, occasionally saves lives."
  },
  "nails": {
    "id": "nails",
    "name": "Iron Nails",
    "category": "component",
    "rarity": "common",
    "trait1": "Sharpness",
    "trait2": "Density",
    "sources": [
      "craft"
    ],
    "description": "Small pointed fasteners. A pocket of these is worth more than a sword in a frontier camp."
  },
  "glass_vial": {
    "id": "glass_vial",
    "name": "Glass Vial",
    "category": "component",
    "rarity": "common",
    "trait1": "Density",
    "trait2": "None",
    "sources": [
      "craft",
      "shop"
    ],
    "description": "Small sealed container. Holds liquids, powders, and things better left sealed."
  },
  "wax": {
    "id": "wax",
    "name": "Sealing Wax",
    "category": "component",
    "rarity": "common",
    "trait1": "Organic",
    "trait2": "Liquid",
    "sources": [
      "craft"
    ],
    "description": "Beeswax and resin blend. Waterproofs, seals, and preserves."
  },
  "cloth": {
    "id": "cloth",
    "name": "Woven Cloth",
    "category": "component",
    "rarity": "common",
    "trait1": "Organic",
    "trait2": "None",
    "sources": [
      "craft",
      "shop"
    ],
    "description": "Rough-spun fabric. Not comfortable. Functional."
  },
  "thread": {
    "id": "thread",
    "name": "Thread",
    "category": "component",
    "rarity": "common",
    "trait1": "Organic",
    "trait2": "None",
    "sources": [
      "craft",
      "shop"
    ],
    "description": "Spun plant fiber or animal sinew. Holds the world together, literally."
  },
  "oil": {
    "id": "oil",
    "name": "Lamp Oil",
    "category": "component",
    "rarity": "common",
    "trait1": "Liquid",
    "trait2": "Organic",
    "sources": [
      "craft",
      "shop"
    ],
    "description": "Rendered from animal fat or pressed from seeds. Burns. That's the point."
  },
  "essence_infused_ingot": {
    "id": "essence_infused_ingot",
    "name": "Essence-Infused Ingot",
    "category": "component",
    "rarity": "rare",
    "trait1": "Density",
    "trait2": "Magic",
    "sources": [
      "craft"
    ],
    "description": "Metal bar saturated with stabilized essence. Glows faintly. Warm to the touch."
  },
  "pickaxe": {
    "id": "pickaxe",
    "name": "Iron Pickaxe",
    "category": "tool",
    "rarity": "common",
    "trait1": "Sharpness",
    "trait2": "Density",
    "sources": [
      "craft",
      "shop"
    ],
    "description": "Standard mining tool. Breaks rock. Eventually breaks itself."
  },
  "hatchet": {
    "id": "hatchet",
    "name": "Hatchet",
    "category": "tool",
    "rarity": "common",
    "trait1": "Sharpness",
    "trait2": "Organic",
    "sources": [
      "craft",
      "shop"
    ],
    "description": "Small axe for timber work. Also adequate for self-defense in a pinch."
  },
  "hunting_knife": {
    "id": "hunting_knife",
    "name": "Hunting Knife",
    "category": "tool",
    "rarity": "common",
    "trait1": "Sharpness",
    "trait2": "None",
    "sources": [
      "craft",
      "shop"
    ],
    "description": "Fixed-blade utility knife. Skins game, cuts rope, opens cans. Every drifter carries one."
  },
  "lockpick": {
    "id": "lockpick",
    "name": "Lockpick Set",
    "category": "tool",
    "rarity": "uncommon",
    "trait1": "Sharpness",
    "trait2": "None",
    "sources": [
      "craft"
    ],
    "description": "Thin metal tools of questionable legality. The Garrison frowns on these."
  },
  "compass": {
    "id": "compass",
    "name": "Compass",
    "category": "tool",
    "rarity": "uncommon",
    "trait1": "Magic",
    "trait2": "Density",
    "sources": [
      "craft",
      "shop"
    ],
    "description": "Magnetized needle in a brass housing. Points north. Usually."
  },
  "lantern": {
    "id": "lantern",
    "name": "Oil Lantern",
    "category": "tool",
    "rarity": "common",
    "trait1": "Density",
    "trait2": "None",
    "sources": [
      "craft",
      "shop"
    ],
    "description": "Tin and glass. Burns oil. The difference between seeing danger and walking into it."
  },
  "flint_and_steel": {
    "id": "flint_and_steel",
    "name": "Flint & Steel",
    "category": "tool",
    "rarity": "common",
    "trait1": "Sharpness",
    "trait2": "Density",
    "sources": [
      "craft",
      "shop"
    ],
    "description": "Fire starter. The most basic survival tool. Lose this and you're in trouble."
  },
  "sewing_kit": {
    "id": "sewing_kit",
    "name": "Sewing Kit",
    "category": "tool",
    "rarity": "common",
    "trait1": "Sharpness",
    "trait2": "Organic",
    "sources": [
      "craft",
      "shop"
    ],
    "description": "Needles, thread, and a thimble. Repairs clothing and armor. Saves coin."
  },
  "iron_sword": {
    "id": "iron_sword",
    "name": "Iron Sword",
    "category": "weapon",
    "rarity": "uncommon",
    "trait1": "Sharpness",
    "trait2": "Density",
    "sources": [
      "craft",
      "shop"
    ],
    "description": "Standard-issue Garrison blade. Nothing fancy. Gets the job done."
  },
  "copper_dagger": {
    "id": "copper_dagger",
    "name": "Copper Dagger",
    "category": "weapon",
    "rarity": "common",
    "trait1": "Sharpness",
    "trait2": "None",
    "sources": [
      "craft",
      "shop"
    ],
    "description": "Cheap, soft-metal blade. Better than bare hands. Not by much."
  },
  "wooden_club": {
    "id": "wooden_club",
    "name": "Wooden Club",
    "category": "weapon",
    "rarity": "common",
    "trait1": "Density",
    "trait2": "Organic",
    "sources": [
      "craft"
    ],
    "description": "A heavy piece of oak shaped for hitting things. Elegance is not the point."
  },
  "longbow": {
    "id": "longbow",
    "name": "Longbow",
    "category": "weapon",
    "rarity": "uncommon",
    "trait1": "Organic",
    "trait2": "Sharpness",
    "sources": [
      "craft"
    ],
    "description": "Spruce-stave bow. Effective at range. Less effective when something is already biting you."
  },
  "spear": {
    "id": "spear",
    "name": "Spear",
    "category": "weapon",
    "rarity": "common",
    "trait1": "Sharpness",
    "trait2": "Organic",
    "sources": [
      "craft"
    ],
    "description": "Pointed stick, refined. Keeps danger at arm's length. The oldest weapon for a reason."
  },
  "war_hammer": {
    "id": "war_hammer",
    "name": "War Hammer",
    "category": "weapon",
    "rarity": "uncommon",
    "trait1": "Density",
    "trait2": "Sharpness",
    "sources": [
      "craft"
    ],
    "description": "Heavy iron head on an oak shaft. Ignores armor. Shatters bone."
  },
  "crossbow": {
    "id": "crossbow",
    "name": "Crossbow",
    "category": "weapon",
    "rarity": "rare",
    "trait1": "Sharpness",
    "trait2": "Density",
    "sources": [
      "craft"
    ],
    "description": "Mechanical bow with a locking mechanism. Requires bolts. Punches through hide armor."
  },
  "serrated_blade": {
    "id": "serrated_blade",
    "name": "Serrated Blade",
    "category": "weapon",
    "rarity": "rare",
    "trait1": "Sharpness",
    "trait2": "Toxicity",
    "sources": [
      "craft"
    ],
    "description": "Jagged-edged knife designed to cause wounds that don't close. Cruel but effective."
  },
  "leather_vest": {
    "id": "leather_vest",
    "name": "Leather Vest",
    "category": "armor",
    "rarity": "common",
    "trait1": "Organic",
    "trait2": "Density",
    "sources": [
      "craft",
      "shop"
    ],
    "description": "Boiled leather chest piece. Stops a glancing blow. Don't expect miracles."
  },
  "iron_helmet": {
    "id": "iron_helmet",
    "name": "Iron Helmet",
    "category": "armor",
    "rarity": "uncommon",
    "trait1": "Density",
    "trait2": "Sharpness",
    "sources": [
      "craft"
    ],
    "description": "Open-face iron helm. Protects the skull. Limits peripheral vision."
  },
  "chainmail": {
    "id": "chainmail",
    "name": "Chainmail Shirt",
    "category": "armor",
    "rarity": "rare",
    "trait1": "Density",
    "trait2": "Sharpness",
    "sources": [
      "craft"
    ],
    "description": "Interlocking iron rings sewn onto leather backing. Heavy. Effective. Expensive."
  },
  "wooden_shield": {
    "id": "wooden_shield",
    "name": "Wooden Shield",
    "category": "armor",
    "rarity": "common",
    "trait1": "Density",
    "trait2": "Organic",
    "sources": [
      "craft"
    ],
    "description": "Ironwood-bound oak shield. Absorbs impacts. Splinters eventually replace it."
  },
  "fur_cloak": {
    "id": "fur_cloak",
    "name": "Fur Cloak",
    "category": "armor",
    "rarity": "uncommon",
    "trait1": "Organic",
    "trait2": "Density",
    "sources": [
      "craft"
    ],
    "description": "Wolf pelt outer layer with cloth lining. Warmth and minor essence shielding."
  },
  "iron_greaves": {
    "id": "iron_greaves",
    "name": "Iron Greaves",
    "category": "armor",
    "rarity": "uncommon",
    "trait1": "Density",
    "trait2": "None",
    "sources": [
      "craft"
    ],
    "description": "Shin guards. Protect the legs. Make you louder when walking. Trade-offs."
  },
  "sharp_stone": {
    "id": "sharp_stone",
    "name": "Sharp Stone",
    "category": "mineral",
    "rarity": "common",
    "trait1": "Sharpness",
    "trait2": "Density",
    "sources": [
      "craft"
    ],
    "description": "A stone shattered into jagged edges. Crude, but dangerous."
  },
  "crushed_copper": {
    "id": "crushed_copper",
    "name": "Crushed Copper",
    "category": "mineral",
    "rarity": "common",
    "trait1": "Density",
    "trait2": "Liquid",
    "sources": [
      "craft"
    ],
    "description": "Copper ore reduced to fine granules. Ready for smelting or alchemical solution."
  },
  "iron_shards": {
    "id": "iron_shards",
    "name": "Iron Shards",
    "category": "mineral",
    "rarity": "uncommon",
    "trait1": "Sharpness",
    "trait2": "Density",
    "sources": [
      "craft"
    ],
    "description": "Fragments of deep-vein iron. Their edges hum with residual essence."
  },
  "tin_dust": {
    "id": "tin_dust",
    "name": "Tin Dust",
    "category": "mineral",
    "rarity": "common",
    "trait1": "Density",
    "trait2": "None",
    "sources": [
      "craft"
    ],
    "description": "Fine grey dust. Essential for low-temperature alloys."
  },
  "silver_dust": {
    "id": "silver_dust",
    "name": "Silver Dust",
    "category": "mineral",
    "rarity": "uncommon",
    "trait1": "Magic",
    "trait2": "Density",
    "sources": [
      "craft"
    ],
    "description": "Shimmering powder that conducts essence with high efficiency."
  },
  "coal_dust": {
    "id": "coal_dust",
    "name": "Coal Dust",
    "category": "mineral",
    "rarity": "common",
    "trait1": "Toxicity",
    "trait2": "Density",
    "sources": [
      "craft"
    ],
    "description": "Highly flammable and filthy. Useful in concentrated amounts."
  },
  "sulfur_powder": {
    "id": "sulfur_powder",
    "name": "Sulfur Powder",
    "category": "mineral",
    "rarity": "uncommon",
    "trait1": "Toxicity",
    "trait2": "None",
    "sources": [
      "craft"
    ],
    "description": "Refined yellow powder. The primary catalyst for chemical violence."
  },
  "quartz_dust": {
    "id": "quartz_dust",
    "name": "Quartz Dust",
    "category": "mineral",
    "rarity": "uncommon",
    "trait1": "Magic",
    "trait2": "None",
    "sources": [
      "craft"
    ],
    "description": "Refractive crystal dust. Used to stabilize magical structures."
  },
  "obsidian_blade": {
    "id": "obsidian_blade",
    "name": "Obsidian Blade",
    "category": "mineral",
    "rarity": "rare",
    "trait1": "Sharpness",
    "trait2": "Magic",
    "sources": [
      "craft"
    ],
    "description": "A volcanic glass shard shaped into a lethal edge. It drinks light."
  },
  "crushed_ruby": {
    "id": "crushed_ruby",
    "name": "Crushed Ruby",
    "category": "mineral",
    "rarity": "rare",
    "trait1": "Magic",
    "trait2": "Density",
    "sources": [
      "craft"
    ],
    "description": "Crimson dust that radiates a constant, low-level warmth."
  },
  "crushed_sapphire": {
    "id": "crushed_sapphire",
    "name": "Crushed Sapphire",
    "category": "mineral",
    "rarity": "rare",
    "trait1": "Magic",
    "trait2": "Liquid",
    "sources": [
      "craft"
    ],
    "description": "Aqueous blue powder that seems to ripple when moved."
  },
  "essence_shards": {
    "id": "essence_shards",
    "name": "Essence Shards",
    "category": "mineral",
    "rarity": "legendary",
    "trait1": "Magic",
    "trait2": "Magic",
    "sources": [
      "craft"
    ],
    "description": "Fragments of pure crystallized essence. Each shard is a potential catastrophe."
  },
  "oak_plank": {
    "id": "oak_plank",
    "name": "Oak Plank",
    "category": "timber",
    "rarity": "common",
    "trait1": "Organic",
    "trait2": "Density",
    "sources": [
      "craft"
    ],
    "description": "Durable board of seasoned oak. The backbone of construction."
  },
  "spruce_plank": {
    "id": "spruce_plank",
    "name": "Spruce Plank",
    "category": "timber",
    "rarity": "common",
    "trait1": "Organic",
    "trait2": "None",
    "sources": [
      "craft"
    ],
    "description": "Light, easy-to-work board. Good for detail work and crates."
  },
  "palm_plank": {
    "id": "palm_plank",
    "name": "Palm Plank",
    "category": "timber",
    "rarity": "uncommon",
    "trait1": "Organic",
    "trait2": "Liquid",
    "sources": [
      "craft"
    ],
    "description": "Wide palm board that keeps a little sea damp in its grain."
  },
  "palm_strips": {
    "id": "palm_strips",
    "name": "Palm Strips",
    "category": "timber",
    "rarity": "uncommon",
    "trait1": "Organic",
    "trait2": "Liquid",
    "sources": [
      "craft"
    ],
    "description": "Flexible, oily strips of palm wood. Excellent for weaving."
  },
  "pine_plank": {
    "id": "pine_plank",
    "name": "Pine Plank",
    "category": "timber",
    "rarity": "uncommon",
    "trait1": "Organic",
    "trait2": "Toxicity",
    "sources": [
      "craft"
    ],
    "description": "Resinous board that resists moisture and rot."
  },
  "ironwood_plank": {
    "id": "ironwood_plank",
    "name": "Ironwood Plank",
    "category": "timber",
    "rarity": "rare",
    "trait1": "Organic",
    "trait2": "Density",
    "sources": [
      "craft"
    ],
    "description": "A board heavy as lead and hard as stone. Requires special tools to cut."
  },
  "charcoal_powder": {
    "id": "charcoal_powder",
    "name": "Charcoal Powder",
    "category": "timber",
    "rarity": "common",
    "trait1": "Density",
    "trait2": "Toxicity",
    "sources": [
      "craft"
    ],
    "description": "Purified carbon dust. Highly absorbent and useful in filtration."
  },
  "thick_resin": {
    "id": "thick_resin",
    "name": "Thick Resin",
    "category": "timber",
    "rarity": "common",
    "trait1": "Organic",
    "trait2": "Liquid",
    "sources": [
      "craft"
    ],
    "description": "Sap boiled down into a potent, slow-setting adhesive."
  },
  "fungal_spores": {
    "id": "fungal_spores",
    "name": "Fungal Spores",
    "category": "timber",
    "rarity": "common",
    "trait1": "Organic",
    "trait2": "Toxicity",
    "sources": [
      "craft"
    ],
    "description": "Fine, irritating dust collected from rotted timber. Potentially bio-hazardous."
  },
  "crushed_red_herb": {
    "id": "crushed_red_herb",
    "name": "Crushed Red Herb",
    "category": "herb",
    "rarity": "uncommon",
    "trait1": "Organic",
    "trait2": "Magic",
    "sources": [
      "craft"
    ],
    "description": "Bruised herb leaves, releasing concentrated healing essence."
  },
  "moss_extract": {
    "id": "moss_extract",
    "name": "Moss Extract",
    "category": "herb",
    "rarity": "uncommon",
    "trait1": "Organic",
    "trait2": "Liquid",
    "sources": [
      "craft"
    ],
    "description": "A luminous, thick liquid distilled from blue cave moss."
  },
  "nightshade_ooze": {
    "id": "nightshade_ooze",
    "name": "Nightshade Ooze",
    "category": "herb",
    "rarity": "rare",
    "trait1": "Organic",
    "trait2": "Toxicity",
    "sources": [
      "craft"
    ],
    "description": "A dark, syrupy concentrate of lethal nightshade berries."
  },
  "mushroom_paste": {
    "id": "mushroom_paste",
    "name": "Mushroom Paste",
    "category": "herb",
    "rarity": "uncommon",
    "trait1": "Magic",
    "trait2": "Organic",
    "sources": [
      "craft"
    ],
    "description": "A glowing pulp of glowcap mushrooms. Humid and faintly vibrating."
  },
  "thorn_point": {
    "id": "thorn_point",
    "name": "Thorn Point",
    "category": "herb",
    "rarity": "common",
    "trait1": "Sharpness",
    "trait2": "None",
    "sources": [
      "craft"
    ],
    "description": "A single, essence-hardened thorn removed from a vine."
  },
  "shredded_tobacco": {
    "id": "shredded_tobacco",
    "name": "Shredded Tobacco",
    "category": "herb",
    "rarity": "common",
    "trait1": "Organic",
    "trait2": "Toxicity",
    "sources": [
      "craft"
    ],
    "description": "Dried tobacco leaves cut for smoking or medicinal poultices."
  },
  "lily_extract": {
    "id": "lily_extract",
    "name": "Lily Extract",
    "category": "herb",
    "rarity": "rare",
    "trait1": "Magic",
    "trait2": "Liquid",
    "sources": [
      "craft"
    ],
    "description": "A clear, ethereal liquid that smells of cold metal and white flowers."
  },
  "swamp_pulp": {
    "id": "swamp_pulp",
    "name": "Swamp Pulp",
    "category": "herb",
    "rarity": "uncommon",
    "trait1": "Organic",
    "trait2": "Toxicity",
    "sources": [
      "craft"
    ],
    "description": "Fibrous swamp root mashed into a bitter, cleansing paste."
  },
  "lavender_oil": {
    "id": "lavender_oil",
    "name": "Lavender Oil",
    "category": "herb",
    "rarity": "common",
    "trait1": "Organic",
    "trait2": "Liquid",
    "sources": [
      "craft"
    ],
    "description": "Sweet-smelling oil used for calming and masking decay."
  },
  "bark_pulp": {
    "id": "bark_pulp",
    "name": "Bark Pulp",
    "category": "herb",
    "rarity": "common",
    "trait1": "Organic",
    "trait2": "None",
    "sources": [
      "craft"
    ],
    "description": "Macerated inner bark. Used for tea or as a base for salves."
  },
  "witchgrass_extract": {
    "id": "witchgrass_extract",
    "name": "Witchgrass Extract",
    "category": "herb",
    "rarity": "uncommon",
    "trait1": "Magic",
    "trait2": "Toxicity",
    "sources": [
      "craft"
    ],
    "description": "Black liquid that seems to pull slightly towards essence-rich areas."
  },
  "corpse_essence": {
    "id": "corpse_essence",
    "name": "Corpse Essence",
    "category": "herb",
    "rarity": "rare",
    "trait1": "Toxicity",
    "trait2": "Magic",
    "sources": [
      "craft"
    ],
    "description": "A concentrated oil that carries the heavy scent of death and magic."
  },
  "ground_tooth": {
    "id": "ground_tooth",
    "name": "Ground Wolf Tooth",
    "category": "animal",
    "rarity": "uncommon",
    "trait1": "Sharpness",
    "trait2": "None",
    "sources": [
      "craft"
    ],
    "description": "A sharp, abrasive powder made from crystalline predator teeth."
  },
  "fur_scraps": {
    "id": "fur_scraps",
    "name": "Fur Scraps",
    "category": "animal",
    "rarity": "uncommon",
    "trait1": "Organic",
    "trait2": "Density",
    "sources": [
      "craft"
    ],
    "description": "Sections of wolf pelt prepared for lining or insulation."
  },
  "tusk_shards": {
    "id": "tusk_shards",
    "name": "Tusk Shards",
    "category": "animal",
    "rarity": "uncommon",
    "trait1": "Sharpness",
    "trait2": "Density",
    "sources": [
      "craft"
    ],
    "description": "Splinters of boar tusk. Extremely hard and resistant to heat."
  },
  "leather_scraps": {
    "id": "leather_scraps",
    "name": "Leather Scraps",
    "category": "animal",
    "rarity": "uncommon",
    "trait1": "Density",
    "trait2": "Organic",
    "sources": [
      "craft"
    ],
    "description": "Trimmings of boar hide, too small for large garments but useful for repairs."
  },
  "wing_powder": {
    "id": "wing_powder",
    "name": "Wing Powder",
    "category": "animal",
    "rarity": "rare",
    "trait1": "Magic",
    "trait2": "Organic",
    "sources": [
      "craft"
    ],
    "description": "Iridescent dust collected from Veilmoth wings. Flickers out of existence briefly."
  },
  "lurker_venom": {
    "id": "lurker_venom",
    "name": "Lurker Venom",
    "category": "animal",
    "rarity": "rare",
    "trait1": "Sharpness",
    "trait2": "Toxicity",
    "sources": [
      "craft"
    ],
    "description": "Numbing liquid extracted from Cave Lurker claws."
  },
  "rat_sinew": {
    "id": "rat_sinew",
    "name": "Rat Sinew",
    "category": "animal",
    "rarity": "common",
    "trait1": "Organic",
    "trait2": "None",
    "sources": [
      "craft"
    ],
    "description": "Short, thin strands of tendon from tunnel rats."
  },
  "feather_quill": {
    "id": "feather_quill",
    "name": "Feather Quill",
    "category": "animal",
    "rarity": "common",
    "trait1": "Organic",
    "trait2": "Sharpness",
    "sources": [
      "craft"
    ],
    "description": "A crow feather stripped of its barbs, leaving only the hard quill."
  },
  "venom_extract": {
    "id": "venom_extract",
    "name": "Venom Extract",
    "category": "animal",
    "rarity": "rare",
    "trait1": "Toxicity",
    "trait2": "Liquid",
    "sources": [
      "craft"
    ],
    "description": "Concentrated snake venom. Lethal in even minute quantities."
  },
  "bone_dust": {
    "id": "bone_dust",
    "name": "Bone Dust",
    "category": "animal",
    "rarity": "common",
    "trait1": "Density",
    "trait2": "None",
    "sources": [
      "craft"
    ],
    "description": "Finely ground bone. Used as a binder or alchemical substrate."
  },
  "cured_sinew": {
    "id": "cured_sinew",
    "name": "Cured Sinew",
    "category": "animal",
    "rarity": "common",
    "trait1": "Organic",
    "trait2": "Density",
    "sources": [
      "craft"
    ],
    "description": "Animal sinew treated and stretched into a high-tensile cord."
  },
  "purified_fat": {
    "id": "purified_fat",
    "name": "Purified Fat",
    "category": "animal",
    "rarity": "common",
    "trait1": "Organic",
    "trait2": "Liquid",
    "sources": [
      "craft"
    ],
    "description": "Rendered animal fat, cleared of impurities and odors."
  },
  "silk_thread": {
    "id": "silk_thread",
    "name": "Silk Thread",
    "category": "animal",
    "rarity": "rare",
    "trait1": "Organic",
    "trait2": "Magic",
    "sources": [
      "craft"
    ],
    "description": "Spider silk spun into a thread that can carry a magical charge."
  },
  "demon_ichor": {
    "id": "demon_ichor",
    "name": "Demon Ichor",
    "category": "animal",
    "rarity": "legendary",
    "trait1": "Toxicity",
    "trait2": "Liquid",
    "sources": [
      "craft"
    ],
    "description": "Pure, undiluted black blood from the deeps. It seems to watch you."
  },
  "ash_concentrate": {
    "id": "ash_concentrate",
    "name": "Ash Concentrate",
    "category": "reagent",
    "rarity": "common",
    "trait1": "None",
    "trait2": "None",
    "sources": [
      "craft"
    ],
    "description": "Volatile ash refined into a stable alchemical base. Still mostly useless."
  },
  "essence_slurry": {
    "id": "essence_slurry",
    "name": "Essence Slurry",
    "category": "reagent",
    "rarity": "uncommon",
    "trait1": "Magic",
    "trait2": "Liquid",
    "sources": [
      "craft"
    ],
    "description": "Essence dust suspended in distilled water. Highly reactive."
  },
  "stabilized_salt": {
    "id": "stabilized_salt",
    "name": "Stabilized Salt",
    "category": "reagent",
    "rarity": "uncommon",
    "trait1": "Density",
    "trait2": "Magic",
    "sources": [
      "craft"
    ],
    "description": "Grey salt treated with essence dust to enhance its stabilizing properties."
  },
  "unstable_powder": {
    "id": "unstable_powder",
    "name": "Unstable Powder",
    "category": "reagent",
    "rarity": "uncommon",
    "trait1": "Toxicity",
    "trait2": "Magic",
    "sources": [
      "craft"
    ],
    "description": "A precursor to black powder, lacking its explosive force but highly volatile."
  },
  "purified_quicksilver": {
    "id": "purified_quicksilver",
    "name": "Purified Quicksilver",
    "category": "reagent",
    "rarity": "rare",
    "trait1": "Liquid",
    "trait2": "Magic",
    "sources": [
      "craft"
    ],
    "description": "Mercury from which the most deadly toxins have been removed, leaving pure conductant."
  },
  "tallow_block": {
    "id": "tallow_block",
    "name": "Tallow Block",
    "category": "reagent",
    "rarity": "common",
    "trait1": "Organic",
    "trait2": "Density",
    "sources": [
      "craft"
    ],
    "description": "Rendered fat cast into a solid block for easy transport and storage."
  },
  "phosphite_sludge": {
    "id": "phosphite_sludge",
    "name": "Phosphite Sludge",
    "category": "reagent",
    "rarity": "uncommon",
    "trait1": "Toxicity",
    "trait2": "Liquid",
    "sources": [
      "craft"
    ],
    "description": "A glowing, caustic mud-like substance that burns to the touch."
  },
  "infused_water": {
    "id": "infused_water",
    "name": "Infused Water",
    "category": "reagent",
    "rarity": "uncommon",
    "trait1": "Liquid",
    "trait2": "Magic",
    "sources": [
      "craft"
    ],
    "description": "Distilled water that has absorbed residual essence from nearby crystals."
  },
  "concentrated_acid": {
    "id": "concentrated_acid",
    "name": "Concentrated Acid",
    "category": "reagent",
    "rarity": "rare",
    "trait1": "Toxicity",
    "trait2": "Density",
    "sources": [
      "craft"
    ],
    "description": "Acid vial content refined into a much more stable and powerful corrosive."
  },
  "sticky_binding_agent": {
    "id": "sticky_binding_agent",
    "name": "Sticky Binding Agent",
    "category": "reagent",
    "rarity": "uncommon",
    "trait1": "Density",
    "trait2": "Liquid",
    "sources": [
      "craft"
    ],
    "description": "Binding agent reinforced with wood resin for maximum adherence."
  },
  "medical_cloth": {
    "id": "medical_cloth",
    "name": "Medical Cloth",
    "category": "medical",
    "rarity": "common",
    "trait1": "Organic",
    "trait2": "None",
    "sources": [
      "craft"
    ],
    "description": "Bandages treated with mild disinfectants."
  },
  "salve_base": {
    "id": "salve_base",
    "name": "Salve Base",
    "category": "medical",
    "rarity": "uncommon",
    "trait1": "Liquid",
    "trait2": "Organic",
    "sources": [
      "craft"
    ],
    "description": "A neutral ointment prepared to receive active herbal ingredients."
  },
  "antitoxin_base": {
    "id": "antitoxin_base",
    "name": "Antitoxin Base",
    "category": "medical",
    "rarity": "uncommon",
    "trait1": "Toxicity",
    "trait2": "Organic",
    "sources": [
      "craft"
    ],
    "description": "A compound designed to absorb and neutralize common toxins."
  },
  "ward_fragment": {
    "id": "ward_fragment",
    "name": "Ward Fragment",
    "category": "medical",
    "rarity": "rare",
    "trait1": "Magic",
    "trait2": "None",
    "sources": [
      "craft"
    ],
    "description": "A shard of an essence ward, still containing faint protective energy."
  },
  "packed_ration": {
    "id": "packed_ration",
    "name": "Packed Ration",
    "category": "medical",
    "rarity": "common",
    "trait1": "Organic",
    "trait2": "Density",
    "sources": [
      "craft"
    ],
    "description": "Rations compressed and sealed for maximum shelf life."
  },
  "purified_liquid": {
    "id": "purified_liquid",
    "name": "Purified Liquid",
    "category": "medical",
    "rarity": "common",
    "trait1": "Liquid",
    "trait2": "None",
    "sources": [
      "craft"
    ],
    "description": "Water that has undergone triple-distillation to ensure zero essence taint."
  },
  "potent_spirit": {
    "id": "potent_spirit",
    "name": "Potent Spirit",
    "category": "medical",
    "rarity": "common",
    "trait1": "Liquid",
    "trait2": "Toxicity",
    "sources": [
      "craft"
    ],
    "description": "Alcohol distilled to the threshold of palatability."
  },
  "stimulant_base": {
    "id": "stimulant_base",
    "name": "Stimulant Base",
    "category": "medical",
    "rarity": "uncommon",
    "trait1": "Magic",
    "trait2": "Liquid",
    "sources": [
      "craft"
    ],
    "description": "An aqueous solution primed for stimulant herbs."
  },
  "transfusable_blood": {
    "id": "transfusable_blood",
    "name": "Transfusable Blood",
    "category": "medical",
    "rarity": "rare",
    "trait1": "Organic",
    "trait2": "Liquid",
    "sources": [
      "craft"
    ],
    "description": "Stabilized blood ready for immediate use in medical procedures."
  },
  "serum_component": {
    "id": "serum_component",
    "name": "Serum Component",
    "category": "medical",
    "rarity": "legendary",
    "trait1": "Magic",
    "trait2": "Liquid",
    "sources": [
      "craft"
    ],
    "description": "One of the complex ingredients required for the anti-grey serum."
  },
  "iron_filings": {
    "id": "iron_filings",
    "name": "Iron Filings",
    "category": "component",
    "rarity": "uncommon",
    "trait1": "Density",
    "trait2": "Sharpness",
    "sources": [
      "craft"
    ],
    "description": "Fine shavings of iron. Useful for magnetic and alchemical experiments."
  },
  "copper_filings": {
    "id": "copper_filings",
    "name": "Copper Filings",
    "category": "component",
    "rarity": "common",
    "trait1": "Density",
    "trait2": "None",
    "sources": [
      "craft"
    ],
    "description": "Small shavings of copper ore. Conducts essence well in powder form."
  },
  "steel_shards": {
    "id": "steel_shards",
    "name": "Steel Shards",
    "category": "component",
    "rarity": "rare",
    "trait1": "Density",
    "trait2": "Sharpness",
    "sources": [
      "craft"
    ],
    "description": "Fragments of high-grade steel. Retain their edge even when broken."
  },
  "tanned_hide": {
    "id": "tanned_hide",
    "name": "Tanned Hide",
    "category": "component",
    "rarity": "common",
    "trait1": "Organic",
    "trait2": "Density",
    "sources": [
      "craft"
    ],
    "description": "Animal hide that has been cleaned and treated, ready for cutting."
  },
  "hemp_fiber": {
    "id": "hemp_fiber",
    "name": "Hemp Fiber",
    "category": "component",
    "rarity": "common",
    "trait1": "Organic",
    "trait2": "None",
    "sources": [
      "craft"
    ],
    "description": "Plant fibers stripped and prepared for spinning into rope or cloth."
  },
  "iron_pins": {
    "id": "iron_pins",
    "name": "Iron Pins",
    "category": "component",
    "rarity": "common",
    "trait1": "Sharpness",
    "trait2": "Density",
    "sources": [
      "craft"
    ],
    "description": "Tiny, sharp iron fasteners. Useful for delicate mechanical work."
  },
  "glass_shards": {
    "id": "glass_shards",
    "name": "Glass Shards",
    "category": "component",
    "rarity": "common",
    "trait1": "Density",
    "trait2": "Sharpness",
    "sources": [
      "craft"
    ],
    "description": "Broken glass. Dangerous to handle, but useful for optics or as a cheap abrasive."
  },
  "processed_wax": {
    "id": "processed_wax",
    "name": "Processed Wax",
    "category": "component",
    "rarity": "common",
    "trait1": "Organic",
    "trait2": "None",
    "sources": [
      "craft"
    ],
    "description": "Wax that has been melted and cleared of impurities."
  },
  "raw_fabric": {
    "id": "raw_fabric",
    "name": "Raw Fabric",
    "category": "component",
    "rarity": "common",
    "trait1": "Organic",
    "trait2": "None",
    "sources": [
      "craft"
    ],
    "description": "Bolts of uncolored, rough-woven material."
  },
  "loose_thread": {
    "id": "loose_thread",
    "name": "Loose Thread",
    "category": "component",
    "rarity": "common",
    "trait1": "Organic",
    "trait2": "None",
    "sources": [
      "craft"
    ],
    "description": "Small spools of thread for minor repairs."
  },
  "heavy_oil": {
    "id": "heavy_oil",
    "name": "Heavy Oil",
    "category": "component",
    "rarity": "common",
    "trait1": "Liquid",
    "trait2": "Organic",
    "sources": [
      "craft"
    ],
    "description": "Oils that have been thickened for use in industrial lighting or lubrication."
  },
  "magic_dust": {
    "id": "magic_dust",
    "name": "Magic Dust",
    "category": "component",
    "rarity": "rare",
    "trait1": "Magic",
    "trait2": "None",
    "sources": [
      "craft"
    ],
    "description": "Concentrated essence particles extracted from infused materials."
  },
  "broken_pickaxe": {
    "id": "broken_pickaxe",
    "name": "Broken Pickaxe",
    "category": "tool",
    "rarity": "common",
    "trait1": "Density",
    "trait2": "None",
    "sources": [
      "craft"
    ],
    "description": "A snap in the handle or a crack in the head has rendered this tool useless."
  },
  "broken_hatchet": {
    "id": "broken_hatchet",
    "name": "Broken Hatchet",
    "category": "tool",
    "rarity": "common",
    "trait1": "Organic",
    "trait2": "None",
    "sources": [
      "craft"
    ],
    "description": "The blade is chipped beyond use or the handle has splintered."
  },
  "dull_knife": {
    "id": "dull_knife",
    "name": "Dull Knife",
    "category": "tool",
    "rarity": "common",
    "trait1": "Sharpness",
    "trait2": "None",
    "sources": [
      "craft"
    ],
    "description": "The edge is gone. It can barely cut bread, let alone leather."
  },
  "bent_lockpick": {
    "id": "bent_lockpick",
    "name": "Bent Lockpick",
    "category": "tool",
    "rarity": "uncommon",
    "trait1": "Sharpness",
    "trait2": "None",
    "sources": [
      "craft"
    ],
    "description": "A failed attempt has warped the metal. It's useless for picking now."
  },
  "shattered_compass": {
    "id": "shattered_compass",
    "name": "Shattered Compass",
    "category": "tool",
    "rarity": "uncommon",
    "trait1": "Magic",
    "trait2": "None",
    "sources": [
      "craft"
    ],
    "description": "The glass is broken and the needle is stuck. It points nowhere."
  },
  "smashed_lantern": {
    "id": "smashed_lantern",
    "name": "Smashed Lantern",
    "category": "tool",
    "rarity": "common",
    "trait1": "Density",
    "trait2": "None",
    "sources": [
      "craft"
    ],
    "description": "Cracked glass and a leaking fuel tank. A fire hazard, nothing more."
  },
  "dull_flint": {
    "id": "dull_flint",
    "name": "Dull Flint",
    "category": "tool",
    "rarity": "common",
    "trait1": "Sharpness",
    "trait2": "None",
    "sources": [
      "craft"
    ],
    "description": "The sparking edge has been worn smooth. It won't start a fire."
  },
  "broken_needle": {
    "id": "broken_needle",
    "name": "Broken Needle",
    "category": "tool",
    "rarity": "common",
    "trait1": "Sharpness",
    "trait2": "None",
    "sources": [
      "craft"
    ],
    "description": "The eye has snapped or the point has blunted."
  },
  "notched_sword": {
    "id": "notched_sword",
    "name": "Notched Sword",
    "category": "weapon",
    "rarity": "uncommon",
    "trait1": "Sharpness",
    "trait2": "None",
    "sources": [
      "craft"
    ],
    "description": "Impacts have left the edge jagged and unreliable."
  },
  "chipped_dagger": {
    "id": "chipped_dagger",
    "name": "Chipped Dagger",
    "category": "weapon",
    "rarity": "common",
    "trait1": "Sharpness",
    "trait2": "None",
    "sources": [
      "craft"
    ],
    "description": "A small piece of the blade is missing near the tip."
  },
  "splintered_club": {
    "id": "splintered_club",
    "name": "Splintered Club",
    "category": "weapon",
    "rarity": "common",
    "trait1": "Density",
    "trait2": "None",
    "sources": [
      "craft"
    ],
    "description": "The wood is fraying. One more hard hit and it will fall apart."
  },
  "snapped_bow": {
    "id": "snapped_bow",
    "name": "Snapped Bow",
    "category": "weapon",
    "rarity": "uncommon",
    "trait1": "Organic",
    "trait2": "None",
    "sources": [
      "craft"
    ],
    "description": "The stave has fractured under tension."
  },
  "broken_spear": {
    "id": "broken_spear",
    "name": "Broken Spear",
    "category": "weapon",
    "rarity": "common",
    "trait1": "Sharpness",
    "trait2": "None",
    "sources": [
      "craft"
    ],
    "description": "The shaft is snapped or the head has come loose."
  },
  "cracked_hammer": {
    "id": "cracked_hammer",
    "name": "Cracked Hammer",
    "category": "weapon",
    "rarity": "uncommon",
    "trait1": "Density",
    "trait2": "None",
    "sources": [
      "craft"
    ],
    "description": "A stress fracture through the iron head makes it dangerous to swing."
  },
  "broken_crossbow": {
    "id": "broken_crossbow",
    "name": "Broken Crossbow",
    "category": "weapon",
    "rarity": "rare",
    "trait1": "Sharpness",
    "trait2": "None",
    "sources": [
      "craft"
    ],
    "description": "The trigger mechanism or the limbs have failed."
  },
  "dull_serrated_blade": {
    "id": "dull_serrated_blade",
    "name": "Dull Serrated Blade",
    "category": "weapon",
    "rarity": "rare",
    "trait1": "Sharpness",
    "trait2": "None",
    "sources": [
      "craft"
    ],
    "description": "The teeth are worn down, losing their ability to tear."
  },
  "torn_leather_vest": {
    "id": "torn_leather_vest",
    "name": "Torn Leather Vest",
    "category": "armor",
    "rarity": "common",
    "trait1": "Organic",
    "trait2": "None",
    "sources": [
      "craft"
    ],
    "description": "Rips and punctures have compromised its protective value."
  },
  "dented_iron_helmet": {
    "id": "dented_iron_helmet",
    "name": "Dented Iron Helmet",
    "category": "armor",
    "rarity": "uncommon",
    "trait1": "Density",
    "trait2": "None",
    "sources": [
      "craft"
    ],
    "description": "A heavy impact has deformed the metal, making it uncomfortable and weak."
  },
  "rusted_chainmail": {
    "id": "rusted_chainmail",
    "name": "Rusted Chainmail",
    "category": "armor",
    "rarity": "rare",
    "trait1": "Density",
    "trait2": "None",
    "sources": [
      "craft"
    ],
    "description": "Neglect and dampness have turned the rings into a crumbling mess."
  },
  "broken_wooden_shield": {
    "id": "broken_wooden_shield",
    "name": "Broken Wooden Shield",
    "category": "armor",
    "rarity": "common",
    "trait1": "Density",
    "trait2": "None",
    "sources": [
      "craft"
    ],
    "description": "Split boards and a loose handle."
  },
  "shabby_fur_cloak": {
    "id": "shabby_fur_cloak",
    "name": "Shabby Fur Cloak",
    "category": "armor",
    "rarity": "uncommon",
    "trait1": "Organic",
    "trait2": "None",
    "sources": [
      "craft"
    ],
    "description": "Matted fur and holes. It protects from neither cold nor essence."
  },
  "dented_iron_greaves": {
    "id": "dented_iron_greaves",
    "name": "Dented Iron Greaves",
    "category": "armor",
    "rarity": "uncommon",
    "trait1": "Density",
    "trait2": "None",
    "sources": [
      "craft"
    ],
    "description": "Bent plates that pinch the legs and offer little protection."
  },
  "essence_vial": {
    "id": "essence_vial",
    "name": "Essence Vial",
    "category": "reagent",
    "rarity": "rare",
    "trait1": "Magic",
    "trait2": "Liquid",
    "sources": [
      "craft"
    ],
    "description": "A glass vial pulsing with raw, stabilized essence. Dangerous to open."
  },
  "bronze_ingot": {
    "id": "bronze_ingot",
    "name": "Bronze Ingot",
    "category": "component",
    "rarity": "uncommon",
    "trait1": "Density",
    "trait2": "None",
    "sources": [
      "craft"
    ],
    "description": "An alloy of copper and tin. Stronger than copper, easier to work than iron."
  },
  "sharpening_stone": {
    "id": "sharpening_stone",
    "name": "Sharpening Stone",
    "category": "tool",
    "rarity": "common",
    "trait1": "Sharpness",
    "trait2": "Density",
    "sources": [
      "craft",
      "shop"
    ],
    "description": "A hunk of abrasive rock used to keep edges keen."
  },
  "refined_oil": {
    "id": "refined_oil",
    "name": "Refined Oil",
    "category": "component",
    "rarity": "uncommon",
    "trait1": "Liquid",
    "trait2": "Organic",
    "sources": [
      "craft"
    ],
    "description": "Clean-burning oil used for high-end lanterns and explosives."
  },
  "mana_paste": {
    "id": "mana_paste",
    "name": "Mana Paste",
    "category": "reagent",
    "rarity": "rare",
    "trait1": "Magic",
    "trait2": "Organic",
    "sources": [
      "craft"
    ],
    "description": "A thick, glowing ointment that restores magical circulation."
  }
},

  locations: {
  "stone_mine": {
    "id": "stone_mine",
    "name": "Stone Mine",
    "action": "mine",
    "profession": "miner",
    "requiredTier": 1,
    "materials": [
      "stone"
    ],
    "dropTableId": "stone_mine_drops"
  },
  "copper_mine": {
    "id": "copper_mine",
    "name": "Copper Mine",
    "action": "mine",
    "profession": "miner",
    "requiredTier": 2,
    "materials": [
      "copper_ore"
    ],
    "dropTableId": "copper_mine_drops"
  },
  "iron_mine": {
    "id": "iron_mine",
    "name": "Iron Mine",
    "action": "mine",
    "profession": "miner",
    "requiredTier": 3,
    "materials": [
      "iron_ore"
    ],
    "dropTableId": "iron_mine_drops"
  },
  "silver_mine": {
    "id": "silver_mine",
    "name": "Silver Mine",
    "action": "mine",
    "profession": "miner",
    "requiredTier": 4,
    "materials": [
      "silver_ore"
    ],
    "dropTableId": "silver_mine_drops"
  },
  "oak_forest": {
    "id": "oak_forest",
    "name": "Oak Forest",
    "action": "forest",
    "profession": "lumber",
    "requiredTier": 1,
    "materials": [
      "oak_wood"
    ],
    "dropTableId": "oak_forest_drops"
  },
  "spruce_forest": {
    "id": "spruce_forest",
    "name": "Spruce Forest",
    "action": "forest",
    "profession": "lumber",
    "requiredTier": 2,
    "materials": [
      "spruce_wood"
    ],
    "dropTableId": "spruce_forest_drops"
  },
  "palm_forest": {
    "id": "palm_forest",
    "name": "Palm Forest",
    "action": "forest",
    "profession": "lumber",
    "requiredTier": 3,
    "materials": [
      "palm_wood"
    ],
    "dropTableId": "palm_forest_drops"
  },
  "pine_forest": {
    "id": "pine_forest",
    "name": "Pine Forest",
    "action": "forest",
    "profession": "lumber",
    "requiredTier": 4,
    "materials": [
      "pine_wood"
    ],
    "dropTableId": "pine_forest_drops"
  }
},

  dropTables: {
  "stone_mine_drops": {
    "id": "stone_mine_drops",
    "action": "mine",
    "profession": "miner",
    "tier": 1,
    "locationId": "stone_mine",
    "entries": [
      {
        "itemId": "stone",
        "chance": 1,
        "weight": 1,
        "minQty": 2,
        "maxQty": 5
      }
    ]
  },
  "copper_mine_drops": {
    "id": "copper_mine_drops",
    "action": "mine",
    "profession": "miner",
    "tier": 2,
    "locationId": "copper_mine",
    "entries": [
      {
        "itemId": "copper_ore",
        "chance": 1,
        "weight": 1,
        "minQty": 2,
        "maxQty": 5
      }
    ]
  },
  "iron_mine_drops": {
    "id": "iron_mine_drops",
    "action": "mine",
    "profession": "miner",
    "tier": 3,
    "locationId": "iron_mine",
    "entries": [
      {
        "itemId": "iron_ore",
        "chance": 1,
        "weight": 1,
        "minQty": 2,
        "maxQty": 5
      }
    ]
  },
  "silver_mine_drops": {
    "id": "silver_mine_drops",
    "action": "mine",
    "profession": "miner",
    "tier": 4,
    "locationId": "silver_mine",
    "entries": [
      {
        "itemId": "silver_ore",
        "chance": 1,
        "weight": 1,
        "minQty": 2,
        "maxQty": 5
      }
    ]
  },
  "oak_forest_drops": {
    "id": "oak_forest_drops",
    "action": "forest",
    "profession": "lumber",
    "tier": 1,
    "locationId": "oak_forest",
    "entries": [
      {
        "itemId": "oak_wood",
        "chance": 1,
        "weight": 1,
        "minQty": 2,
        "maxQty": 5
      }
    ]
  },
  "spruce_forest_drops": {
    "id": "spruce_forest_drops",
    "action": "forest",
    "profession": "lumber",
    "tier": 2,
    "locationId": "spruce_forest",
    "entries": [
      {
        "itemId": "spruce_wood",
        "chance": 1,
        "weight": 1,
        "minQty": 2,
        "maxQty": 5
      }
    ]
  },
  "palm_forest_drops": {
    "id": "palm_forest_drops",
    "action": "forest",
    "profession": "lumber",
    "tier": 3,
    "locationId": "palm_forest",
    "entries": [
      {
        "itemId": "palm_wood",
        "chance": 1,
        "weight": 1,
        "minQty": 2,
        "maxQty": 5
      }
    ]
  },
  "pine_forest_drops": {
    "id": "pine_forest_drops",
    "action": "forest",
    "profession": "lumber",
    "tier": 4,
    "locationId": "pine_forest",
    "entries": [
      {
        "itemId": "pine_wood",
        "chance": 1,
        "weight": 1,
        "minQty": 2,
        "maxQty": 5
      }
    ]
  }
},

  recipes: {
  "process_stone_block": {
    "id": "process_stone_block",
    "name": "Process Stone Block",
    "description": "Process 2 stone into 1 stone_block.",
    "type": "processing",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 2
      }
    ],
    "itemOutputs": [
      {
        "itemId": "stone_block",
        "quantity": 1
      }
    ],
    "tierRequirement": 1,
    "xpReward": 0,
    "enabled": true
  },
  "process_copper_ingot": {
    "id": "process_copper_ingot",
    "name": "Process Copper Ingot",
    "description": "Process 2 copper_ore into 1 copper_ingot.",
    "type": "processing",
    "itemInputs": [
      {
        "itemId": "copper_ore",
        "quantity": 2
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "tierRequirement": 2,
    "xpReward": 0,
    "enabled": true
  },
  "process_iron_ingot": {
    "id": "process_iron_ingot",
    "name": "Process Iron Ingot",
    "description": "Process 2 iron_ore into 1 iron_ingot.",
    "type": "processing",
    "itemInputs": [
      {
        "itemId": "iron_ore",
        "quantity": 2
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "tierRequirement": 3,
    "xpReward": 0,
    "enabled": true
  },
  "process_silver_ingot": {
    "id": "process_silver_ingot",
    "name": "Process Silver Ingot",
    "description": "Process 2 silver_ore into 1 silver_ingot.",
    "type": "processing",
    "itemInputs": [
      {
        "itemId": "silver_ore",
        "quantity": 2
      }
    ],
    "itemOutputs": [
      {
        "itemId": "silver_ingot",
        "quantity": 1
      }
    ],
    "tierRequirement": 4,
    "xpReward": 0,
    "enabled": true
  },
  "process_oak_plank": {
    "id": "process_oak_plank",
    "name": "Process Oak Plank",
    "description": "Process 2 oak_wood into 1 oak_plank.",
    "type": "processing",
    "itemInputs": [
      {
        "itemId": "oak_wood",
        "quantity": 2
      }
    ],
    "itemOutputs": [
      {
        "itemId": "oak_plank",
        "quantity": 1
      }
    ],
    "tierRequirement": 1,
    "xpReward": 0,
    "enabled": true
  },
  "process_spruce_plank": {
    "id": "process_spruce_plank",
    "name": "Process Spruce Plank",
    "description": "Process 2 spruce_wood into 1 spruce_plank.",
    "type": "processing",
    "itemInputs": [
      {
        "itemId": "spruce_wood",
        "quantity": 2
      }
    ],
    "itemOutputs": [
      {
        "itemId": "spruce_plank",
        "quantity": 1
      }
    ],
    "tierRequirement": 2,
    "xpReward": 0,
    "enabled": true
  },
  "process_palm_plank": {
    "id": "process_palm_plank",
    "name": "Process Palm Plank",
    "description": "Process 2 palm_wood into 1 palm_plank.",
    "type": "processing",
    "itemInputs": [
      {
        "itemId": "palm_wood",
        "quantity": 2
      }
    ],
    "itemOutputs": [
      {
        "itemId": "palm_plank",
        "quantity": 1
      }
    ],
    "tierRequirement": 3,
    "xpReward": 0,
    "enabled": true
  },
  "process_pine_plank": {
    "id": "process_pine_plank",
    "name": "Process Pine Plank",
    "description": "Process 2 pine_wood into 1 pine_plank.",
    "type": "processing",
    "itemInputs": [
      {
        "itemId": "pine_wood",
        "quantity": 2
      }
    ],
    "itemOutputs": [
      {
        "itemId": "pine_plank",
        "quantity": 1
      }
    ],
    "tierRequirement": 4,
    "xpReward": 0,
    "enabled": true
  },
  "stone_to_sharp": {
    "id": "stone_to_sharp",
    "name": "Stone To Sharp",
    "description": "Craft 1 sharp_stone from stone.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "sharp_stone",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "copper_to_crushed": {
    "id": "copper_to_crushed",
    "name": "Copper To Crushed",
    "description": "Craft 1 crushed_copper from copper_ore.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "crushed_copper",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "iron_to_shards": {
    "id": "iron_to_shards",
    "name": "Iron To Shards",
    "description": "Craft 1 iron_shards from iron_ore.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_shards",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "tin_to_dust": {
    "id": "tin_to_dust",
    "name": "Tin To Dust",
    "description": "Craft 1 tin_dust from tin_ore.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "tin_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "tin_dust",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "silver_to_dust": {
    "id": "silver_to_dust",
    "name": "Silver To Dust",
    "description": "Craft 1 silver_dust from silver_ore.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "silver_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "silver_dust",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "coal_to_dust": {
    "id": "coal_to_dust",
    "name": "Coal To Dust",
    "description": "Craft 1 coal_dust from coal.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "coal",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "coal_dust",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "sulfur_to_powder": {
    "id": "sulfur_to_powder",
    "name": "Sulfur To Powder",
    "description": "Craft 1 sulfur_powder from sulfur.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "sulfur",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "sulfur_powder",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "quartz_to_dust": {
    "id": "quartz_to_dust",
    "name": "Quartz To Dust",
    "description": "Craft 1 quartz_dust from quartz.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "quartz",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "quartz_dust",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "obsidian_to_blade": {
    "id": "obsidian_to_blade",
    "name": "Obsidian To Blade",
    "description": "Craft 1 obsidian_blade from obsidian_shard.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "obsidian_shard",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "obsidian_blade",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "ruby_to_crushed": {
    "id": "ruby_to_crushed",
    "name": "Ruby To Crushed",
    "description": "Craft 1 crushed_ruby from ruby.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "ruby",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "crushed_ruby",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "sapphire_to_crushed": {
    "id": "sapphire_to_crushed",
    "name": "Sapphire To Crushed",
    "description": "Craft 1 crushed_sapphire from sapphire.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "sapphire",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "crushed_sapphire",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "essence_to_shards": {
    "id": "essence_to_shards",
    "name": "Essence To Shards",
    "description": "Craft 4 essence_shards from raw_essence_crystal.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "raw_essence_crystal",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "essence_shards",
        "quantity": 4
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "oak_to_plank": {
    "id": "oak_to_plank",
    "name": "Oak To Plank",
    "description": "Craft 2 oak_plank from oak_wood.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "oak_wood",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "oak_plank",
        "quantity": 2
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "spruce_to_plank": {
    "id": "spruce_to_plank",
    "name": "Spruce To Plank",
    "description": "Craft 2 spruce_plank from spruce_wood.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "spruce_wood",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "spruce_plank",
        "quantity": 2
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "palm_to_strips": {
    "id": "palm_to_strips",
    "name": "Palm To Strips",
    "description": "Craft 3 palm_strips from palm_wood.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "palm_wood",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "palm_strips",
        "quantity": 3
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "pine_to_plank": {
    "id": "pine_to_plank",
    "name": "Pine To Plank",
    "description": "Craft 2 pine_plank from pine_wood.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "pine_wood",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "pine_plank",
        "quantity": 2
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "ironwood_to_plank": {
    "id": "ironwood_to_plank",
    "name": "Ironwood To Plank",
    "description": "Craft 1 ironwood_plank from ironwood.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "ironwood",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "ironwood_plank",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "charcoal_to_powder": {
    "id": "charcoal_to_powder",
    "name": "Charcoal To Powder",
    "description": "Craft 1 charcoal_powder from charcoal.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "charcoal",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "charcoal_powder",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "resin_to_thick": {
    "id": "resin_to_thick",
    "name": "Resin To Thick",
    "description": "Craft 1 thick_resin from resin.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "resin",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "thick_resin",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "rotted_to_spores": {
    "id": "rotted_to_spores",
    "name": "Rotted To Spores",
    "description": "Craft 1 fungal_spores from rotted_wood.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "rotted_wood",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "fungal_spores",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "red_to_crushed": {
    "id": "red_to_crushed",
    "name": "Red To Crushed",
    "description": "Craft 1 crushed_red_herb from red_herb.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "red_herb",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "crushed_red_herb",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "moss_to_extract": {
    "id": "moss_to_extract",
    "name": "Moss To Extract",
    "description": "Craft 1 moss_extract from blue_moss.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "blue_moss",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "moss_extract",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "nightshade_to_ooze": {
    "id": "nightshade_to_ooze",
    "name": "Nightshade To Ooze",
    "description": "Craft 1 nightshade_ooze from nightshade.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "nightshade",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "nightshade_ooze",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "mushroom_to_paste": {
    "id": "mushroom_to_paste",
    "name": "Mushroom To Paste",
    "description": "Craft 1 mushroom_paste from glowcap_mushroom.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "glowcap_mushroom",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "mushroom_paste",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "thornvine_to_point": {
    "id": "thornvine_to_point",
    "name": "Thornvine To Point",
    "description": "Craft 4 thorn_point from thornvine.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "thornvine",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "thorn_point",
        "quantity": 4
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "tobacco_to_shredded": {
    "id": "tobacco_to_shredded",
    "name": "Tobacco To Shredded",
    "description": "Craft 1 shredded_tobacco from dried_tobacco.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "dried_tobacco",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "shredded_tobacco",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "lily_to_extract": {
    "id": "lily_to_extract",
    "name": "Lily To Extract",
    "description": "Craft 1 lily_extract from ghost_lily.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "ghost_lily",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "lily_extract",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "swamp_to_pulp": {
    "id": "swamp_to_pulp",
    "name": "Swamp To Pulp",
    "description": "Craft 1 swamp_pulp from swamp_root.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "swamp_root",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "swamp_pulp",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "lavender_to_oil": {
    "id": "lavender_to_oil",
    "name": "Lavender To Oil",
    "description": "Craft 1 lavender_oil from lavender.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "lavender",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "lavender_oil",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "bark_to_pulp": {
    "id": "bark_to_pulp",
    "name": "Bark To Pulp",
    "description": "Craft 1 bark_pulp from bark_tea_leaves.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "bark_tea_leaves",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "bark_pulp",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "witchgrass_to_extract": {
    "id": "witchgrass_to_extract",
    "name": "Witchgrass To Extract",
    "description": "Craft 1 witchgrass_extract from witchgrass.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "witchgrass",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "witchgrass_extract",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "corpse_to_essence": {
    "id": "corpse_to_essence",
    "name": "Corpse To Essence",
    "description": "Craft 1 corpse_essence from corpse_flower.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "corpse_flower",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "corpse_essence",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "tooth_to_ground": {
    "id": "tooth_to_ground",
    "name": "Tooth To Ground",
    "description": "Craft 1 ground_tooth from wolf_tooth.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "wolf_tooth",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "ground_tooth",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "pelt_to_scraps": {
    "id": "pelt_to_scraps",
    "name": "Pelt To Scraps",
    "description": "Craft 4 fur_scraps from wolf_pelt.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "wolf_pelt",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "fur_scraps",
        "quantity": 4
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "tusk_to_shards": {
    "id": "tusk_to_shards",
    "name": "Tusk To Shards",
    "description": "Craft 2 tusk_shards from boar_tusk.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "boar_tusk",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "tusk_shards",
        "quantity": 2
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "hide_to_scraps": {
    "id": "hide_to_scraps",
    "name": "Hide To Scraps",
    "description": "Craft 4 leather_scraps from boar_hide.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "boar_hide",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "leather_scraps",
        "quantity": 4
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "wing_to_powder": {
    "id": "wing_to_powder",
    "name": "Wing To Powder",
    "description": "Craft 1 wing_powder from veilmoth_wing.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "veilmoth_wing",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "wing_powder",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "claw_to_venom": {
    "id": "claw_to_venom",
    "name": "Claw To Venom",
    "description": "Craft 1 lurker_venom from cave_lurker_claw.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "cave_lurker_claw",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "lurker_venom",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "tail_to_sinew": {
    "id": "tail_to_sinew",
    "name": "Tail To Sinew",
    "description": "Craft 1 rat_sinew from rat_tail.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "rat_tail",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "rat_sinew",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "feather_to_quill": {
    "id": "feather_to_quill",
    "name": "Feather To Quill",
    "description": "Craft 1 feather_quill from crow_feather.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "crow_feather",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "feather_quill",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "sac_to_extract": {
    "id": "sac_to_extract",
    "name": "Sac To Extract",
    "description": "Craft 1 venom_extract from snake_venom_sac.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "snake_venom_sac",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "venom_extract",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "bone_to_dust": {
    "id": "bone_to_dust",
    "name": "Bone To Dust",
    "description": "Craft 2 bone_dust from bone_fragment.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "bone_fragment",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "bone_dust",
        "quantity": 2
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "sinew_to_cured": {
    "id": "sinew_to_cured",
    "name": "Sinew To Cured",
    "description": "Craft 1 cured_sinew from sinew.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "sinew",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "cured_sinew",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "fat_to_purified": {
    "id": "fat_to_purified",
    "name": "Fat To Purified",
    "description": "Craft 1 purified_fat from animal_fat.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "animal_fat",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "purified_fat",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "silk_to_thread": {
    "id": "silk_to_thread",
    "name": "Silk To Thread",
    "description": "Craft 1 silk_thread from spider_silk.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "spider_silk",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "silk_thread",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "blood_to_ichor": {
    "id": "blood_to_ichor",
    "name": "Blood To Ichor",
    "description": "Craft 1 demon_ichor from demon_blood.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "demon_blood",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "demon_ichor",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "bandage_to_cloth": {
    "id": "bandage_to_cloth",
    "name": "Bandage To Cloth",
    "description": "Craft 1 medical_cloth from bandage.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "bandage",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "medical_cloth",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "salve_to_base": {
    "id": "salve_to_base",
    "name": "Salve To Base",
    "description": "Craft 1 salve_base from healing_salve.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "healing_salve",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "salve_base",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "antidote_to_base": {
    "id": "antidote_to_base",
    "name": "Antidote To Base",
    "description": "Craft 1 antitoxin_base from antidote.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "antidote",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "antitoxin_base",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "ward_to_fragment": {
    "id": "ward_to_fragment",
    "name": "Ward To Fragment",
    "description": "Craft 3 ward_fragment from essence_ward.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "essence_ward",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "ward_fragment",
        "quantity": 3
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "ration_to_packed": {
    "id": "ration_to_packed",
    "name": "Ration To Packed",
    "description": "Craft 1 packed_ration from ration.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "ration",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "packed_ration",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "clean_water_to_purified": {
    "id": "clean_water_to_purified",
    "name": "Clean Water To Purified",
    "description": "Craft 1 purified_liquid from clean_water.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "clean_water",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "purified_liquid",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "alcohol_to_spirit": {
    "id": "alcohol_to_spirit",
    "name": "Alcohol To Spirit",
    "description": "Craft 1 potent_spirit from alcohol.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "alcohol",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "potent_spirit",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "stimulant_to_base": {
    "id": "stimulant_to_base",
    "name": "Stimulant To Base",
    "description": "Craft 1 stimulant_base from stimulant_tonic.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "stimulant_tonic",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "stimulant_base",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "blood_vial_to_transfusion": {
    "id": "blood_vial_to_transfusion",
    "name": "Blood Vial To Transfusion",
    "description": "Craft 1 transfusable_blood from blood_vial.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "blood_vial",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "transfusable_blood",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "anti_grey_to_serum": {
    "id": "anti_grey_to_serum",
    "name": "Anti Grey To Serum",
    "description": "Craft 4 serum_component from anti_grey_serum.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "anti_grey_serum",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "serum_component",
        "quantity": 4
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "iron_ingot_to_filings": {
    "id": "iron_ingot_to_filings",
    "name": "Iron Ingot To Filings",
    "description": "Craft 1 iron_filings from iron_ingot.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_filings",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "copper_ingot_to_filings": {
    "id": "copper_ingot_to_filings",
    "name": "Copper Ingot To Filings",
    "description": "Craft 1 copper_filings from copper_ingot.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_filings",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "steel_alloy_to_shards": {
    "id": "steel_alloy_to_shards",
    "name": "Steel Alloy To Shards",
    "description": "Craft 2 steel_shards from steel_alloy.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "steel_alloy",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "steel_shards",
        "quantity": 2
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "leather_strip_to_scraps": {
    "id": "leather_strip_to_scraps",
    "name": "Leather Strip To Scraps",
    "description": "Craft 4 leather_scraps from leather_strip.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "leather_strip",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "leather_scraps",
        "quantity": 4
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "rope_to_hemp": {
    "id": "rope_to_hemp",
    "name": "Rope To Hemp",
    "description": "Craft 4 hemp_fiber from rope.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "rope",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "hemp_fiber",
        "quantity": 4
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "nails_to_pins": {
    "id": "nails_to_pins",
    "name": "Nails To Pins",
    "description": "Craft 4 iron_pins from nails.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "nails",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_pins",
        "quantity": 4
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "glass_vial_to_shards": {
    "id": "glass_vial_to_shards",
    "name": "Glass Vial To Shards",
    "description": "Craft 1 glass_shards from glass_vial.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "glass_vial",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "glass_shards",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "wax_to_processed": {
    "id": "wax_to_processed",
    "name": "Wax To Processed",
    "description": "Craft 1 processed_wax from wax.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "wax",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "processed_wax",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "cloth_to_raw": {
    "id": "cloth_to_raw",
    "name": "Cloth To Raw",
    "description": "Craft 1 raw_fabric from cloth.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "cloth",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "raw_fabric",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "thread_to_loose": {
    "id": "thread_to_loose",
    "name": "Thread To Loose",
    "description": "Craft 1 loose_thread from thread.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "thread",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "loose_thread",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "oil_to_heavy": {
    "id": "oil_to_heavy",
    "name": "Oil To Heavy",
    "description": "Craft 1 heavy_oil from oil.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "oil",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "heavy_oil",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "essence_infused_to_dust": {
    "id": "essence_infused_to_dust",
    "name": "Essence Infused To Dust",
    "description": "Craft 2 magic_dust from essence_infused_ingot.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "essence_infused_ingot",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "magic_dust",
        "quantity": 2
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "pickaxe_to_broken": {
    "id": "pickaxe_to_broken",
    "name": "Pickaxe To Broken",
    "description": "Craft 1 broken_pickaxe from pickaxe.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "pickaxe",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "broken_pickaxe",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "hatchet_to_broken": {
    "id": "hatchet_to_broken",
    "name": "Hatchet To Broken",
    "description": "Craft 1 broken_hatchet from hatchet.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "hatchet",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "broken_hatchet",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "knife_to_dull": {
    "id": "knife_to_dull",
    "name": "Knife To Dull",
    "description": "Craft 1 dull_knife from hunting_knife.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "hunting_knife",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "dull_knife",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "lockpick_to_bent": {
    "id": "lockpick_to_bent",
    "name": "Lockpick To Bent",
    "description": "Craft 1 bent_lockpick from lockpick.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "lockpick",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "bent_lockpick",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "compass_to_shattered": {
    "id": "compass_to_shattered",
    "name": "Compass To Shattered",
    "description": "Craft 1 shattered_compass from compass.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "compass",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "shattered_compass",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "lantern_to_smashed": {
    "id": "lantern_to_smashed",
    "name": "Lantern To Smashed",
    "description": "Craft 1 smashed_lantern from lantern.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "lantern",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "smashed_lantern",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "flint_to_dull": {
    "id": "flint_to_dull",
    "name": "Flint To Dull",
    "description": "Craft 1 dull_flint from flint_and_steel.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "flint_and_steel",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "dull_flint",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "sewing_to_broken": {
    "id": "sewing_to_broken",
    "name": "Sewing To Broken",
    "description": "Craft 1 broken_needle from sewing_kit.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "sewing_kit",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "broken_needle",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "sword_to_notched": {
    "id": "sword_to_notched",
    "name": "Sword To Notched",
    "description": "Craft 1 notched_sword from iron_sword.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "iron_sword",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "notched_sword",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "dagger_to_chipped": {
    "id": "dagger_to_chipped",
    "name": "Dagger To Chipped",
    "description": "Craft 1 chipped_dagger from copper_dagger.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "copper_dagger",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "chipped_dagger",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "club_to_splintered": {
    "id": "club_to_splintered",
    "name": "Club To Splintered",
    "description": "Craft 1 splintered_club from wooden_club.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "wooden_club",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "splintered_club",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "longbow_to_snapped": {
    "id": "longbow_to_snapped",
    "name": "Longbow To Snapped",
    "description": "Craft 1 snapped_bow from longbow.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "longbow",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "snapped_bow",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "spear_to_broken": {
    "id": "spear_to_broken",
    "name": "Spear To Broken",
    "description": "Craft 1 broken_spear from spear.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "spear",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "broken_spear",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "hammer_to_cracked": {
    "id": "hammer_to_cracked",
    "name": "Hammer To Cracked",
    "description": "Craft 1 cracked_hammer from war_hammer.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "war_hammer",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "cracked_hammer",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "crossbow_to_broken": {
    "id": "crossbow_to_broken",
    "name": "Crossbow To Broken",
    "description": "Craft 1 broken_crossbow from crossbow.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "crossbow",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "broken_crossbow",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "serrated_to_dull": {
    "id": "serrated_to_dull",
    "name": "Serrated To Dull",
    "description": "Craft 1 dull_serrated_blade from serrated_blade.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "serrated_blade",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "dull_serrated_blade",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "vest_to_torn": {
    "id": "vest_to_torn",
    "name": "Vest To Torn",
    "description": "Craft 1 torn_leather_vest from leather_vest.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "leather_vest",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "torn_leather_vest",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "helmet_to_dented": {
    "id": "helmet_to_dented",
    "name": "Helmet To Dented",
    "description": "Craft 1 dented_iron_helmet from iron_helmet.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "iron_helmet",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "dented_iron_helmet",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "chainmail_to_rusted": {
    "id": "chainmail_to_rusted",
    "name": "Chainmail To Rusted",
    "description": "Craft 1 rusted_chainmail from chainmail.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "chainmail",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "rusted_chainmail",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "shield_to_broken": {
    "id": "shield_to_broken",
    "name": "Shield To Broken",
    "description": "Craft 1 broken_wooden_shield from wooden_shield.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "wooden_shield",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "broken_wooden_shield",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "cloak_to_shabby": {
    "id": "cloak_to_shabby",
    "name": "Cloak To Shabby",
    "description": "Craft 1 shabby_fur_cloak from fur_cloak.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "fur_cloak",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "shabby_fur_cloak",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "greaves_to_dented": {
    "id": "greaves_to_dented",
    "name": "Greaves To Dented",
    "description": "Craft 1 dented_iron_greaves from iron_greaves.",
    "type": "crafting",
    "craftingMethod": "transform",
    "itemInputs": [
      {
        "itemId": "iron_greaves",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "dented_iron_greaves",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "stone_iron_sharp": {
    "id": "stone_iron_sharp",
    "name": "Stone Iron Sharp",
    "description": "Craft 2 sharp_stone from stone, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "sharp_stone",
        "quantity": 2
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "copper_tin_bronze": {
    "id": "copper_tin_bronze",
    "name": "Copper Tin Bronze",
    "description": "Craft 1 copper_ingot from copper_ore, tin_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "copper_ore",
        "quantity": 1
      },
      {
        "itemId": "tin_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "iron_coal_ingot": {
    "id": "iron_coal_ingot",
    "name": "Iron Coal Ingot",
    "description": "Craft 1 iron_ingot from iron_ore, coal.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "iron_ore",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "silver_quartz_focus": {
    "id": "silver_quartz_focus",
    "name": "Silver Quartz Focus",
    "description": "Craft 3 essence_dust from silver_ore, quartz.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "silver_ore",
        "quantity": 1
      },
      {
        "itemId": "quartz",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "essence_dust",
        "quantity": 3
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "sulfur_coal_powder": {
    "id": "sulfur_coal_powder",
    "name": "Sulfur Coal Powder",
    "description": "Craft 1 black_powder from sulfur, coal.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "sulfur",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "black_powder",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "ruby_iron_infused": {
    "id": "ruby_iron_infused",
    "name": "Ruby Iron Infused",
    "description": "Craft 1 essence_infused_ingot from ruby, iron_ingot.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "ruby",
        "quantity": 1
      },
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "essence_infused_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "charcoal_fat_fuel": {
    "id": "charcoal_fat_fuel",
    "name": "Charcoal Fat Fuel",
    "description": "Craft 1 oil from charcoal, animal_fat.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "charcoal",
        "quantity": 1
      },
      {
        "itemId": "animal_fat",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "oil",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "resin_wood_adhesive": {
    "id": "resin_wood_adhesive",
    "name": "Resin Wood Adhesive",
    "description": "Craft 1 binding_agent from resin, rotted_wood.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "resin",
        "quantity": 1
      },
      {
        "itemId": "rotted_wood",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "binding_agent",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "red_herb_blue_moss_mana": {
    "id": "red_herb_blue_moss_mana",
    "name": "Red Herb Blue Moss Mana",
    "description": "Craft 1 mana_paste from red_herb, blue_moss.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "red_herb",
        "quantity": 1
      },
      {
        "itemId": "blue_moss",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "mana_paste",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "nightshade_sulfur_toxin": {
    "id": "nightshade_sulfur_toxin",
    "name": "Nightshade Sulfur Toxin",
    "description": "Craft 1 acid_vial from nightshade, sulfur.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "nightshade",
        "quantity": 1
      },
      {
        "itemId": "sulfur",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "acid_vial",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "glowcap_quartz_dust": {
    "id": "glowcap_quartz_dust",
    "name": "Glowcap Quartz Dust",
    "description": "Craft 2 essence_dust from glowcap_mushroom, quartz.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "glowcap_mushroom",
        "quantity": 1
      },
      {
        "itemId": "quartz",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "essence_dust",
        "quantity": 2
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "thornvine_rope_trap": {
    "id": "thornvine_rope_trap",
    "name": "Thornvine Rope Trap",
    "description": "Craft 2 nails from thornvine, rope.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "thornvine",
        "quantity": 1
      },
      {
        "itemId": "rope",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "nails",
        "quantity": 2
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "tobacco_alcohol_tonic": {
    "id": "tobacco_alcohol_tonic",
    "name": "Tobacco Alcohol Tonic",
    "description": "Craft 1 stimulant_tonic from dried_tobacco, alcohol.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "dried_tobacco",
        "quantity": 1
      },
      {
        "itemId": "alcohol",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "stimulant_tonic",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "ghost_lily_silver_dust": {
    "id": "ghost_lily_silver_dust",
    "name": "Ghost Lily Silver Dust",
    "description": "Craft 5 essence_dust from ghost_lily, silver_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "ghost_lily",
        "quantity": 1
      },
      {
        "itemId": "silver_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "essence_dust",
        "quantity": 5
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "swamp_root_charcoal_filter": {
    "id": "swamp_root_charcoal_filter",
    "name": "Swamp Root Charcoal Filter",
    "description": "Craft 1 clean_water from swamp_root, charcoal.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "swamp_root",
        "quantity": 1
      },
      {
        "itemId": "charcoal",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "clean_water",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "lavender_tallow_soap": {
    "id": "lavender_tallow_soap",
    "name": "Lavender Tallow Soap",
    "description": "Craft 1 ration from lavender, tallow.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "lavender",
        "quantity": 1
      },
      {
        "itemId": "tallow",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "ration",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "witchgrass_essence_dust": {
    "id": "witchgrass_essence_dust",
    "name": "Witchgrass Essence Dust",
    "description": "Craft 1 raw_essence_crystal from witchgrass, essence_dust.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "witchgrass",
        "quantity": 1
      },
      {
        "itemId": "essence_dust",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "raw_essence_crystal",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "corpse_flower_demon_blood": {
    "id": "corpse_flower_demon_blood",
    "name": "Corpse Flower Demon Blood",
    "description": "Craft 1 volatile_ash from corpse_flower, demon_blood.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "corpse_flower",
        "quantity": 1
      },
      {
        "itemId": "demon_blood",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "volatile_ash",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "wolf_tooth_iron_ingot_serrated": {
    "id": "wolf_tooth_iron_ingot_serrated",
    "name": "Wolf Tooth Iron Ingot Serrated",
    "description": "Craft 1 serrated_blade from wolf_tooth, iron_ingot.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "wolf_tooth",
        "quantity": 1
      },
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "serrated_blade",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "wolf_pelt_leather_vest": {
    "id": "wolf_pelt_leather_vest",
    "name": "Wolf Pelt Leather Vest",
    "description": "Craft 1 fur_cloak from wolf_pelt, leather_strip.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "wolf_pelt",
        "quantity": 1
      },
      {
        "itemId": "leather_strip",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "fur_cloak",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "boar_tusk_copper_dagger": {
    "id": "boar_tusk_copper_dagger",
    "name": "Boar Tusk Copper Dagger",
    "description": "Craft 1 copper_dagger from boar_tusk, copper_ingot.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "boar_tusk",
        "quantity": 1
      },
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_dagger",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "boar_hide_nails_shield": {
    "id": "boar_hide_nails_shield",
    "name": "Boar Hide Nails Shield",
    "description": "Craft 1 wooden_shield from boar_hide, nails.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "boar_hide",
        "quantity": 1
      },
      {
        "itemId": "nails",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "wooden_shield",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "veilmoth_wing_glass_vial": {
    "id": "veilmoth_wing_glass_vial",
    "name": "Veilmoth Wing Glass Vial",
    "description": "Craft 1 essence_vial from veilmoth_wing, glass_vial.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "veilmoth_wing",
        "quantity": 1
      },
      {
        "itemId": "glass_vial",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "essence_vial",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "lurker_claw_poison_knife": {
    "id": "lurker_claw_poison_knife",
    "name": "Lurker Claw Poison Knife",
    "description": "Craft 1 serrated_blade from cave_lurker_claw, hunting_knife.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "cave_lurker_claw",
        "quantity": 1
      },
      {
        "itemId": "hunting_knife",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "serrated_blade",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "rat_tail_binding": {
    "id": "rat_tail_binding",
    "name": "Rat Tail Binding",
    "description": "Craft 1 binding_agent from rat_tail, resin.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "rat_tail",
        "quantity": 1
      },
      {
        "itemId": "resin",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "binding_agent",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "crow_feather_thread_quill": {
    "id": "crow_feather_thread_quill",
    "name": "Crow Feather Thread Quill",
    "description": "Craft 3 thread from crow_feather, thread.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "crow_feather",
        "quantity": 1
      },
      {
        "itemId": "thread",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "thread",
        "quantity": 3
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "venom_sac_alcohol_toxin": {
    "id": "venom_sac_alcohol_toxin",
    "name": "Venom Sac Alcohol Toxin",
    "description": "Craft 1 acid_vial from snake_venom_sac, alcohol.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "snake_venom_sac",
        "quantity": 1
      },
      {
        "itemId": "alcohol",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "acid_vial",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "bone_fragment_glue": {
    "id": "bone_fragment_glue",
    "name": "Bone Fragment Glue",
    "description": "Craft 1 binding_agent from bone_fragment, resin.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "bone_fragment",
        "quantity": 1
      },
      {
        "itemId": "resin",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "binding_agent",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "sinew_rope_strong": {
    "id": "sinew_rope_strong",
    "name": "Sinew Rope Strong",
    "description": "Craft 2 rope from sinew, rope.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "sinew",
        "quantity": 1
      },
      {
        "itemId": "rope",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "rope",
        "quantity": 2
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "animal_fat_ash_soap": {
    "id": "animal_fat_ash_soap",
    "name": "Animal Fat Ash Soap",
    "description": "Craft 2 tallow from animal_fat, volatile_ash.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "animal_fat",
        "quantity": 1
      },
      {
        "itemId": "volatile_ash",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "tallow",
        "quantity": 2
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "spider_silk_silver_thread": {
    "id": "spider_silk_silver_thread",
    "name": "Spider Silk Silver Thread",
    "description": "Craft 5 thread from spider_silk, silver_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "spider_silk",
        "quantity": 1
      },
      {
        "itemId": "silver_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "thread",
        "quantity": 5
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "demon_blood_iron_cursed": {
    "id": "demon_blood_iron_cursed",
    "name": "Demon Blood Iron Cursed",
    "description": "Craft 1 essence_infused_ingot from demon_blood, iron_ingot.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "demon_blood",
        "quantity": 1
      },
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "essence_infused_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "essence_dust_glass_vial": {
    "id": "essence_dust_glass_vial",
    "name": "Essence Dust Glass Vial",
    "description": "Craft 1 essence_vial from essence_dust, glass_vial.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "essence_dust",
        "quantity": 1
      },
      {
        "itemId": "glass_vial",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "essence_vial",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "grey_salt_iron_ingot_essence": {
    "id": "grey_salt_iron_ingot_essence",
    "name": "Grey Salt Iron Ingot Essence",
    "description": "Craft 1 essence_infused_ingot from grey_salt, iron_ingot.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "grey_salt",
        "quantity": 1
      },
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "essence_infused_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "black_powder_nails_bomb": {
    "id": "black_powder_nails_bomb",
    "name": "Black Powder Nails Bomb",
    "description": "Craft 1 volatile_ash from black_powder, nails.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "black_powder",
        "quantity": 1
      },
      {
        "itemId": "nails",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "volatile_ash",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "quicksilver_copper_alloy": {
    "id": "quicksilver_copper_alloy",
    "name": "Quicksilver Copper Alloy",
    "description": "Craft 1 refined_oil from quicksilver, copper_ingot.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "quicksilver",
        "quantity": 1
      },
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "refined_oil",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "phosphite_powder_oil_lantern": {
    "id": "phosphite_powder_oil_lantern",
    "name": "Phosphite Powder Oil Lantern",
    "description": "Craft 1 lantern from phosphite_powder, oil.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "phosphite_powder",
        "quantity": 1
      },
      {
        "itemId": "oil",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "lantern",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "binding_agent_cloth_bandage": {
    "id": "binding_agent_cloth_bandage",
    "name": "Binding Agent Cloth Bandage",
    "description": "Craft 2 bandage from binding_agent, cloth.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "binding_agent",
        "quantity": 1
      },
      {
        "itemId": "cloth",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "bandage",
        "quantity": 2
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "stone_sharp_stone_shards": {
    "id": "stone_sharp_stone_shards",
    "name": "Stone Sharp Stone Shards",
    "description": "Craft 5 iron_shards from stone, sharp_stone.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "sharp_stone",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_shards",
        "quantity": 5
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "copper_ore_charcoal_ingot": {
    "id": "copper_ore_charcoal_ingot",
    "name": "Copper Ore Charcoal Ingot",
    "description": "Craft 1 copper_ingot from copper_ore, charcoal.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "copper_ore",
        "quantity": 1
      },
      {
        "itemId": "charcoal",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "silver_ore_charcoal_ingot": {
    "id": "silver_ore_charcoal_ingot",
    "name": "Silver Ore Charcoal Ingot",
    "description": "Craft 1 copper_ingot from silver_ore, charcoal.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "silver_ore",
        "quantity": 1
      },
      {
        "itemId": "charcoal",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "tin_ore_charcoal_ingot": {
    "id": "tin_ore_charcoal_ingot",
    "name": "Tin Ore Charcoal Ingot",
    "description": "Craft 1 copper_ingot from tin_ore, charcoal.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "tin_ore",
        "quantity": 1
      },
      {
        "itemId": "charcoal",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "quartz_glass_vial_lens": {
    "id": "quartz_glass_vial_lens",
    "name": "Quartz Glass Vial Lens",
    "description": "Craft 1 compass from quartz, glass_vial.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "quartz",
        "quantity": 1
      },
      {
        "itemId": "glass_vial",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "compass",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "obsidian_shard_oak_wood_knife": {
    "id": "obsidian_shard_oak_wood_knife",
    "name": "Obsidian Shard Oak Wood Knife",
    "description": "Craft 1 hunting_knife from obsidian_shard, oak_wood.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "obsidian_shard",
        "quantity": 1
      },
      {
        "itemId": "oak_wood",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "hunting_knife",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "ruby_glass_vial_elixir": {
    "id": "ruby_glass_vial_elixir",
    "name": "Ruby Glass Vial Elixir",
    "description": "Craft 1 stimulant_tonic from ruby, glass_vial.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "ruby",
        "quantity": 1
      },
      {
        "itemId": "glass_vial",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "stimulant_tonic",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "sapphire_glass_vial_elixir": {
    "id": "sapphire_glass_vial_elixir",
    "name": "Sapphire Glass Vial Elixir",
    "description": "Craft 1 healing_salve from sapphire, glass_vial.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "sapphire",
        "quantity": 1
      },
      {
        "itemId": "glass_vial",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "healing_salve",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "raw_essence_crystal_silver_wand": {
    "id": "raw_essence_crystal_silver_wand",
    "name": "Raw Essence Crystal Silver Wand",
    "description": "Craft 1 essence_ward from raw_essence_crystal, silver_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "raw_essence_crystal",
        "quantity": 1
      },
      {
        "itemId": "silver_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "essence_ward",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "spruce_wood_rope_ladder": {
    "id": "spruce_wood_rope_ladder",
    "name": "Spruce Wood Rope Ladder",
    "description": "Craft 5 rope from spruce_wood, rope.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "spruce_wood",
        "quantity": 1
      },
      {
        "itemId": "rope",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "rope",
        "quantity": 5
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "pine_wood_resin_torch": {
    "id": "pine_wood_resin_torch",
    "name": "Pine Wood Resin Torch",
    "description": "Craft 1 lantern from pine_wood, resin.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "pine_wood",
        "quantity": 1
      },
      {
        "itemId": "resin",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "lantern",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "ironwood_leather_shield": {
    "id": "ironwood_leather_shield",
    "name": "Ironwood Leather Shield",
    "description": "Craft 1 wooden_shield from ironwood, leather_strip.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "ironwood",
        "quantity": 1
      },
      {
        "itemId": "leather_strip",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "wooden_shield",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "iron_ingot_nails": {
    "id": "iron_ingot_nails",
    "name": "Iron Ingot Nails",
    "description": "Craft 20 nails from iron_ingot, stone.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      },
      {
        "itemId": "stone",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "nails",
        "quantity": 20
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "leather_strip_thread_belt": {
    "id": "leather_strip_thread_belt",
    "name": "Leather Strip Thread Belt",
    "description": "Craft 1 leather_vest from leather_strip, thread.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "leather_strip",
        "quantity": 1
      },
      {
        "itemId": "thread",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "leather_vest",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "glass_vial_clean_water": {
    "id": "glass_vial_clean_water",
    "name": "Glass Vial Clean Water",
    "description": "Craft 1 distilled_water from glass_vial, clean_water.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "glass_vial",
        "quantity": 1
      },
      {
        "itemId": "clean_water",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "distilled_water",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "cloth_thread_sock": {
    "id": "cloth_thread_sock",
    "name": "Cloth Thread Sock",
    "description": "Craft 5 bandage from cloth, thread.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "cloth",
        "quantity": 1
      },
      {
        "itemId": "thread",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "bandage",
        "quantity": 5
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "nails_oak_wood_box": {
    "id": "nails_oak_wood_box",
    "name": "Nails Oak Wood Box",
    "description": "Craft 5 ration from nails, oak_wood.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "nails",
        "quantity": 1
      },
      {
        "itemId": "oak_wood",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "ration",
        "quantity": 5
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "copper_ingot_tin_ingot_bronze": {
    "id": "copper_ingot_tin_ingot_bronze",
    "name": "Copper Ingot Tin Ingot Bronze",
    "description": "Craft 1 bronze_ingot from copper_ingot, tin_dust.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      },
      {
        "itemId": "tin_dust",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "bronze_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "iron_ingot_coal_steel": {
    "id": "iron_ingot_coal_steel",
    "name": "Iron Ingot Coal Steel",
    "description": "Craft 1 steel_alloy from iron_ingot, coal.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "steel_alloy",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "leather_strip_nails_helmet": {
    "id": "leather_strip_nails_helmet",
    "name": "Leather Strip Nails Helmet",
    "description": "Craft 1 iron_helmet from leather_strip, nails.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "leather_strip",
        "quantity": 1
      },
      {
        "itemId": "nails",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_helmet",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "cloth_leather_boots": {
    "id": "cloth_leather_boots",
    "name": "Cloth Leather Boots",
    "description": "Craft 1 iron_greaves from cloth, leather_strip.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "cloth",
        "quantity": 1
      },
      {
        "itemId": "leather_strip",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_greaves",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "bone_dust_binding_agent": {
    "id": "bone_dust_binding_agent",
    "name": "Bone Dust Binding Agent",
    "description": "Craft 2 grey_salt from bone_dust, binding_agent.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "bone_dust",
        "quantity": 1
      },
      {
        "itemId": "binding_agent",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "grey_salt",
        "quantity": 2
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "purified_fat_lavender_oil": {
    "id": "purified_fat_lavender_oil",
    "name": "Purified Fat Lavender Oil",
    "description": "Craft 3 tallow from purified_fat, lavender_oil.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "purified_fat",
        "quantity": 1
      },
      {
        "itemId": "lavender_oil",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "tallow",
        "quantity": 3
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "hemp_fiber_thread_rope": {
    "id": "hemp_fiber_thread_rope",
    "name": "Hemp Fiber Thread Rope",
    "description": "Craft 1 rope from hemp_fiber, thread.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "hemp_fiber",
        "quantity": 1
      },
      {
        "itemId": "thread",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "rope",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "quartz_shards_silver_dust": {
    "id": "quartz_shards_silver_dust",
    "name": "Quartz Shards Silver Dust",
    "description": "Craft 10 essence_dust from quartz_dust, silver_dust.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "quartz_dust",
        "quantity": 1
      },
      {
        "itemId": "silver_dust",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "essence_dust",
        "quantity": 10
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "broken_pickaxe_iron_ingot_repair": {
    "id": "broken_pickaxe_iron_ingot_repair",
    "name": "Broken Pickaxe Iron Ingot Repair",
    "description": "Craft 1 pickaxe from broken_pickaxe, iron_ingot.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "broken_pickaxe",
        "quantity": 1
      },
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "pickaxe",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "broken_hatchet_iron_ingot_repair": {
    "id": "broken_hatchet_iron_ingot_repair",
    "name": "Broken Hatchet Iron Ingot Repair",
    "description": "Craft 1 hatchet from broken_hatchet, iron_ingot.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "broken_hatchet",
        "quantity": 1
      },
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "hatchet",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "chipped_dagger_sharpening_stone": {
    "id": "chipped_dagger_sharpening_stone",
    "name": "Chipped Dagger Sharpening Stone",
    "description": "Craft 1 copper_dagger from chipped_dagger, sharpening_stone.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "chipped_dagger",
        "quantity": 1
      },
      {
        "itemId": "sharpening_stone",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_dagger",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "notched_sword_sharpening_stone": {
    "id": "notched_sword_sharpening_stone",
    "name": "Notched Sword Sharpening Stone",
    "description": "Craft 1 iron_sword from notched_sword, sharpening_stone.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "notched_sword",
        "quantity": 1
      },
      {
        "itemId": "sharpening_stone",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_sword",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "iron_ingot_steel_shards_charcoal": {
    "id": "iron_ingot_steel_shards_charcoal",
    "name": "Iron Ingot Steel Shards Charcoal",
    "description": "Craft 2 steel_alloy from iron_ingot, steel_shards, charcoal.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      },
      {
        "itemId": "steel_shards",
        "quantity": 1
      },
      {
        "itemId": "charcoal",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "steel_alloy",
        "quantity": 2
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "red_herb_blue_moss_nightshade": {
    "id": "red_herb_blue_moss_nightshade",
    "name": "Red Herb Blue Moss Nightshade",
    "description": "Craft 1 venom_extract from red_herb, blue_moss, nightshade.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "red_herb",
        "quantity": 1
      },
      {
        "itemId": "blue_moss",
        "quantity": 1
      },
      {
        "itemId": "nightshade",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "venom_extract",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "wolf_pelt_boar_hide_sinew": {
    "id": "wolf_pelt_boar_hide_sinew",
    "name": "Wolf Pelt Boar Hide Sinew",
    "description": "Craft 1 fur_cloak from wolf_pelt, boar_hide, sinew.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "wolf_pelt",
        "quantity": 1
      },
      {
        "itemId": "boar_hide",
        "quantity": 1
      },
      {
        "itemId": "sinew",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "fur_cloak",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "raw_essence_crystal_silver_quartz": {
    "id": "raw_essence_crystal_silver_quartz",
    "name": "Raw Essence Crystal Silver Quartz",
    "description": "Craft 1 essence_ward from raw_essence_crystal, silver_dust, quartz_dust.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "raw_essence_crystal",
        "quantity": 1
      },
      {
        "itemId": "silver_dust",
        "quantity": 1
      },
      {
        "itemId": "quartz_dust",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "essence_ward",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "demon_ichor_sulfur_charcoal": {
    "id": "demon_ichor_sulfur_charcoal",
    "name": "Demon Ichor Sulfur Charcoal",
    "description": "Craft 5 black_powder from demon_ichor, sulfur_powder, charcoal_powder.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "demon_ichor",
        "quantity": 1
      },
      {
        "itemId": "sulfur_powder",
        "quantity": 1
      },
      {
        "itemId": "charcoal_powder",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "black_powder",
        "quantity": 5
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "copper_ingot_tin_dust_charcoal": {
    "id": "copper_ingot_tin_dust_charcoal",
    "name": "Copper Ingot Tin Dust Charcoal",
    "description": "Craft 1 bronze_ingot from copper_ingot, tin_dust, charcoal.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      },
      {
        "itemId": "tin_dust",
        "quantity": 1
      },
      {
        "itemId": "charcoal",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "bronze_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "silver_dust_essence_dust_glass": {
    "id": "silver_dust_essence_dust_glass",
    "name": "Silver Dust Essence Dust Glass",
    "description": "Craft 1 essence_vial from silver_dust, essence_dust, glass_vial.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "silver_dust",
        "quantity": 1
      },
      {
        "itemId": "essence_dust",
        "quantity": 1
      },
      {
        "itemId": "glass_vial",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "essence_vial",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "oak_wood_leather_strip_nails": {
    "id": "oak_wood_leather_strip_nails",
    "name": "Oak Wood Leather Strip Nails",
    "description": "Craft 1 wooden_shield from oak_wood, leather_strip, nails.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "oak_wood",
        "quantity": 1
      },
      {
        "itemId": "leather_strip",
        "quantity": 1
      },
      {
        "itemId": "nails",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "wooden_shield",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "spruce_wood_sinew_feather": {
    "id": "spruce_wood_sinew_feather",
    "name": "Spruce Wood Sinew Feather",
    "description": "Craft 1 longbow from spruce_wood, sinew, crow_feather.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "spruce_wood",
        "quantity": 1
      },
      {
        "itemId": "sinew",
        "quantity": 1
      },
      {
        "itemId": "crow_feather",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "longbow",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "iron_ingot_oak_wood_leather": {
    "id": "iron_ingot_oak_wood_leather",
    "name": "Iron Ingot Oak Wood Leather",
    "description": "Craft 1 iron_sword from iron_ingot, oak_wood, leather_strip.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      },
      {
        "itemId": "oak_wood",
        "quantity": 1
      },
      {
        "itemId": "leather_strip",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_sword",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "iron_ingot_oak_wood_stone": {
    "id": "iron_ingot_oak_wood_stone",
    "name": "Iron Ingot Oak Wood Stone",
    "description": "Craft 1 war_hammer from iron_ingot, oak_wood, stone.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      },
      {
        "itemId": "oak_wood",
        "quantity": 1
      },
      {
        "itemId": "stone",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "war_hammer",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "iron_ingot_sinew_oak_wood": {
    "id": "iron_ingot_sinew_oak_wood",
    "name": "Iron Ingot Sinew Oak Wood",
    "description": "Craft 1 spear from iron_ingot, sinew, oak_wood.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      },
      {
        "itemId": "sinew",
        "quantity": 1
      },
      {
        "itemId": "oak_wood",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "spear",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "steel_alloy_leather_strip_nails": {
    "id": "steel_alloy_leather_strip_nails",
    "name": "Steel Alloy Leather Strip Nails",
    "description": "Craft 1 serrated_blade from steel_alloy, leather_strip, nails.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "steel_alloy",
        "quantity": 1
      },
      {
        "itemId": "leather_strip",
        "quantity": 1
      },
      {
        "itemId": "nails",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "serrated_blade",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "cloth_leather_sinew_armor": {
    "id": "cloth_leather_sinew_armor",
    "name": "Cloth Leather Sinew Armor",
    "description": "Craft 1 leather_vest from cloth, leather_strip, sinew.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "cloth",
        "quantity": 1
      },
      {
        "itemId": "leather_strip",
        "quantity": 1
      },
      {
        "itemId": "sinew",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "leather_vest",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "iron_ingot_leather_strip_nails_helm": {
    "id": "iron_ingot_leather_strip_nails_helm",
    "name": "Iron Ingot Leather Strip Nails Helm",
    "description": "Craft 1 iron_helmet from iron_ingot, leather_strip, nails.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      },
      {
        "itemId": "leather_strip",
        "quantity": 1
      },
      {
        "itemId": "nails",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_helmet",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "iron_ingot_iron_pins_leather": {
    "id": "iron_ingot_iron_pins_leather",
    "name": "Iron Ingot Iron Pins Leather",
    "description": "Craft 1 chainmail from iron_ingot, iron_pins, leather_strip.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      },
      {
        "itemId": "iron_pins",
        "quantity": 1
      },
      {
        "itemId": "leather_strip",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "chainmail",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "red_herb_blue_moss_spirit": {
    "id": "red_herb_blue_moss_spirit",
    "name": "Red Herb Blue Moss Spirit",
    "description": "Craft 1 anti_grey_serum from red_herb, blue_moss, potent_spirit.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "red_herb",
        "quantity": 1
      },
      {
        "itemId": "blue_moss",
        "quantity": 1
      },
      {
        "itemId": "potent_spirit",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "anti_grey_serum",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "swamp_root_bark_tea_water": {
    "id": "swamp_root_bark_tea_water",
    "name": "Swamp Root Bark Tea Water",
    "description": "Craft 2 antidote from swamp_pulp, bark_pulp, purified_liquid.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "swamp_pulp",
        "quantity": 1
      },
      {
        "itemId": "bark_pulp",
        "quantity": 1
      },
      {
        "itemId": "purified_liquid",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "antidote",
        "quantity": 2
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "glowcap_witchgrass_essence": {
    "id": "glowcap_witchgrass_essence",
    "name": "Glowcap Witchgrass Essence",
    "description": "Craft 3 essence_vial from mushroom_paste, witchgrass_extract, essence_shards.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "mushroom_paste",
        "quantity": 1
      },
      {
        "itemId": "witchgrass_extract",
        "quantity": 1
      },
      {
        "itemId": "essence_shards",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "essence_vial",
        "quantity": 3
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "wolf_tooth_lurker_venom_knife": {
    "id": "wolf_tooth_lurker_venom_knife",
    "name": "Wolf Tooth Lurker Venom Knife",
    "description": "Craft 1 serrated_blade from ground_tooth, lurker_venom, hunting_knife.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "ground_tooth",
        "quantity": 1
      },
      {
        "itemId": "lurker_venom",
        "quantity": 1
      },
      {
        "itemId": "hunting_knife",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "serrated_blade",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "tallow_block_lavender_oil_wax": {
    "id": "tallow_block_lavender_oil_wax",
    "name": "Tallow Block Lavender Oil Wax",
    "description": "Craft 5 wax from tallow_block, lavender_oil, processed_wax.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "tallow_block",
        "quantity": 1
      },
      {
        "itemId": "lavender_oil",
        "quantity": 1
      },
      {
        "itemId": "processed_wax",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "wax",
        "quantity": 5
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "hemp_fiber_silk_thread_rope": {
    "id": "hemp_fiber_silk_thread_rope",
    "name": "Hemp Fiber Silk Thread Rope",
    "description": "Craft 10 rope from hemp_fiber, silk_thread, resin.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "hemp_fiber",
        "quantity": 1
      },
      {
        "itemId": "silk_thread",
        "quantity": 1
      },
      {
        "itemId": "resin",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "rope",
        "quantity": 10
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "iron_filings_copper_filings_dust": {
    "id": "iron_filings_copper_filings_dust",
    "name": "Iron Filings Copper Filings Dust",
    "description": "Craft 1 magic_dust from iron_filings, copper_filings, silver_dust.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "iron_filings",
        "quantity": 1
      },
      {
        "itemId": "copper_filings",
        "quantity": 1
      },
      {
        "itemId": "silver_dust",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "magic_dust",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "iron_ingot_charcoal_powder_grey": {
    "id": "iron_ingot_charcoal_powder_grey",
    "name": "Iron Ingot Charcoal Powder Grey",
    "description": "Craft 1 steel_alloy from iron_ingot, charcoal_powder, grey_salt.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      },
      {
        "itemId": "charcoal_powder",
        "quantity": 1
      },
      {
        "itemId": "grey_salt",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "steel_alloy",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "oak_plank_iron_pins_nails": {
    "id": "oak_plank_iron_pins_nails",
    "name": "Oak Plank Iron Pins Nails",
    "description": "Craft 1 wooden_shield from oak_plank, iron_pins, nails.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "oak_plank",
        "quantity": 1
      },
      {
        "itemId": "iron_pins",
        "quantity": 1
      },
      {
        "itemId": "nails",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "wooden_shield",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "spruce_plank_sinew_feather": {
    "id": "spruce_plank_sinew_feather",
    "name": "Spruce Plank Sinew Feather",
    "description": "Craft 1 longbow from spruce_plank, cured_sinew, crow_feather.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "spruce_plank",
        "quantity": 1
      },
      {
        "itemId": "cured_sinew",
        "quantity": 1
      },
      {
        "itemId": "crow_feather",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "longbow",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "iron_shards_iron_ingot_steel": {
    "id": "iron_shards_iron_ingot_steel",
    "name": "Iron Shards Iron Ingot Steel",
    "description": "Craft 1 steel_alloy from iron_shards, iron_ingot, coal_dust.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "iron_shards",
        "quantity": 1
      },
      {
        "itemId": "iron_ingot",
        "quantity": 1
      },
      {
        "itemId": "coal_dust",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "steel_alloy",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "copper_ingot_tin_dust_silver": {
    "id": "copper_ingot_tin_dust_silver",
    "name": "Copper Ingot Tin Dust Silver",
    "description": "Craft 1 essence_infused_ingot from copper_ingot, tin_dust, silver_dust.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      },
      {
        "itemId": "tin_dust",
        "quantity": 1
      },
      {
        "itemId": "silver_dust",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "essence_infused_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "leather_scraps_sinew_nails": {
    "id": "leather_scraps_sinew_nails",
    "name": "Leather Scraps Sinew Nails",
    "description": "Craft 1 leather_vest from leather_scraps, cured_sinew, nails.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "leather_scraps",
        "quantity": 1
      },
      {
        "itemId": "cured_sinew",
        "quantity": 1
      },
      {
        "itemId": "nails",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "leather_vest",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "iron_shards_bone_dust_steel": {
    "id": "iron_shards_bone_dust_steel",
    "name": "Iron Shards Bone Dust Steel",
    "description": "Craft 1 steel_alloy from iron_shards, bone_dust, charcoal_powder.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "iron_shards",
        "quantity": 1
      },
      {
        "itemId": "bone_dust",
        "quantity": 1
      },
      {
        "itemId": "charcoal_powder",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "steel_alloy",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_0": {
    "id": "auto_gen_mix_0",
    "name": "Auto Gen Mix 0",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_1": {
    "id": "auto_gen_mix_1",
    "name": "Auto Gen Mix 1",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_2": {
    "id": "auto_gen_mix_2",
    "name": "Auto Gen Mix 2",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_3": {
    "id": "auto_gen_mix_3",
    "name": "Auto Gen Mix 3",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_4": {
    "id": "auto_gen_mix_4",
    "name": "Auto Gen Mix 4",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_5": {
    "id": "auto_gen_mix_5",
    "name": "Auto Gen Mix 5",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_6": {
    "id": "auto_gen_mix_6",
    "name": "Auto Gen Mix 6",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_7": {
    "id": "auto_gen_mix_7",
    "name": "Auto Gen Mix 7",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_8": {
    "id": "auto_gen_mix_8",
    "name": "Auto Gen Mix 8",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_9": {
    "id": "auto_gen_mix_9",
    "name": "Auto Gen Mix 9",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_10": {
    "id": "auto_gen_mix_10",
    "name": "Auto Gen Mix 10",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_11": {
    "id": "auto_gen_mix_11",
    "name": "Auto Gen Mix 11",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_12": {
    "id": "auto_gen_mix_12",
    "name": "Auto Gen Mix 12",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_13": {
    "id": "auto_gen_mix_13",
    "name": "Auto Gen Mix 13",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_14": {
    "id": "auto_gen_mix_14",
    "name": "Auto Gen Mix 14",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_15": {
    "id": "auto_gen_mix_15",
    "name": "Auto Gen Mix 15",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_16": {
    "id": "auto_gen_mix_16",
    "name": "Auto Gen Mix 16",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_17": {
    "id": "auto_gen_mix_17",
    "name": "Auto Gen Mix 17",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_18": {
    "id": "auto_gen_mix_18",
    "name": "Auto Gen Mix 18",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_19": {
    "id": "auto_gen_mix_19",
    "name": "Auto Gen Mix 19",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_20": {
    "id": "auto_gen_mix_20",
    "name": "Auto Gen Mix 20",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_21": {
    "id": "auto_gen_mix_21",
    "name": "Auto Gen Mix 21",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_22": {
    "id": "auto_gen_mix_22",
    "name": "Auto Gen Mix 22",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_23": {
    "id": "auto_gen_mix_23",
    "name": "Auto Gen Mix 23",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_24": {
    "id": "auto_gen_mix_24",
    "name": "Auto Gen Mix 24",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_25": {
    "id": "auto_gen_mix_25",
    "name": "Auto Gen Mix 25",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_26": {
    "id": "auto_gen_mix_26",
    "name": "Auto Gen Mix 26",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_27": {
    "id": "auto_gen_mix_27",
    "name": "Auto Gen Mix 27",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_28": {
    "id": "auto_gen_mix_28",
    "name": "Auto Gen Mix 28",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_29": {
    "id": "auto_gen_mix_29",
    "name": "Auto Gen Mix 29",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_30": {
    "id": "auto_gen_mix_30",
    "name": "Auto Gen Mix 30",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_31": {
    "id": "auto_gen_mix_31",
    "name": "Auto Gen Mix 31",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_32": {
    "id": "auto_gen_mix_32",
    "name": "Auto Gen Mix 32",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_33": {
    "id": "auto_gen_mix_33",
    "name": "Auto Gen Mix 33",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_34": {
    "id": "auto_gen_mix_34",
    "name": "Auto Gen Mix 34",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_35": {
    "id": "auto_gen_mix_35",
    "name": "Auto Gen Mix 35",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_36": {
    "id": "auto_gen_mix_36",
    "name": "Auto Gen Mix 36",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_37": {
    "id": "auto_gen_mix_37",
    "name": "Auto Gen Mix 37",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_38": {
    "id": "auto_gen_mix_38",
    "name": "Auto Gen Mix 38",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_39": {
    "id": "auto_gen_mix_39",
    "name": "Auto Gen Mix 39",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_40": {
    "id": "auto_gen_mix_40",
    "name": "Auto Gen Mix 40",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_41": {
    "id": "auto_gen_mix_41",
    "name": "Auto Gen Mix 41",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_42": {
    "id": "auto_gen_mix_42",
    "name": "Auto Gen Mix 42",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_43": {
    "id": "auto_gen_mix_43",
    "name": "Auto Gen Mix 43",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_44": {
    "id": "auto_gen_mix_44",
    "name": "Auto Gen Mix 44",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_45": {
    "id": "auto_gen_mix_45",
    "name": "Auto Gen Mix 45",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_46": {
    "id": "auto_gen_mix_46",
    "name": "Auto Gen Mix 46",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_47": {
    "id": "auto_gen_mix_47",
    "name": "Auto Gen Mix 47",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_48": {
    "id": "auto_gen_mix_48",
    "name": "Auto Gen Mix 48",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_49": {
    "id": "auto_gen_mix_49",
    "name": "Auto Gen Mix 49",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_50": {
    "id": "auto_gen_mix_50",
    "name": "Auto Gen Mix 50",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_51": {
    "id": "auto_gen_mix_51",
    "name": "Auto Gen Mix 51",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_52": {
    "id": "auto_gen_mix_52",
    "name": "Auto Gen Mix 52",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_53": {
    "id": "auto_gen_mix_53",
    "name": "Auto Gen Mix 53",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_54": {
    "id": "auto_gen_mix_54",
    "name": "Auto Gen Mix 54",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_55": {
    "id": "auto_gen_mix_55",
    "name": "Auto Gen Mix 55",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_56": {
    "id": "auto_gen_mix_56",
    "name": "Auto Gen Mix 56",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_57": {
    "id": "auto_gen_mix_57",
    "name": "Auto Gen Mix 57",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_58": {
    "id": "auto_gen_mix_58",
    "name": "Auto Gen Mix 58",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_59": {
    "id": "auto_gen_mix_59",
    "name": "Auto Gen Mix 59",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_60": {
    "id": "auto_gen_mix_60",
    "name": "Auto Gen Mix 60",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_61": {
    "id": "auto_gen_mix_61",
    "name": "Auto Gen Mix 61",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_62": {
    "id": "auto_gen_mix_62",
    "name": "Auto Gen Mix 62",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_63": {
    "id": "auto_gen_mix_63",
    "name": "Auto Gen Mix 63",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_64": {
    "id": "auto_gen_mix_64",
    "name": "Auto Gen Mix 64",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_65": {
    "id": "auto_gen_mix_65",
    "name": "Auto Gen Mix 65",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_66": {
    "id": "auto_gen_mix_66",
    "name": "Auto Gen Mix 66",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_67": {
    "id": "auto_gen_mix_67",
    "name": "Auto Gen Mix 67",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_68": {
    "id": "auto_gen_mix_68",
    "name": "Auto Gen Mix 68",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_69": {
    "id": "auto_gen_mix_69",
    "name": "Auto Gen Mix 69",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_70": {
    "id": "auto_gen_mix_70",
    "name": "Auto Gen Mix 70",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_71": {
    "id": "auto_gen_mix_71",
    "name": "Auto Gen Mix 71",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_72": {
    "id": "auto_gen_mix_72",
    "name": "Auto Gen Mix 72",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_73": {
    "id": "auto_gen_mix_73",
    "name": "Auto Gen Mix 73",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_74": {
    "id": "auto_gen_mix_74",
    "name": "Auto Gen Mix 74",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_75": {
    "id": "auto_gen_mix_75",
    "name": "Auto Gen Mix 75",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_76": {
    "id": "auto_gen_mix_76",
    "name": "Auto Gen Mix 76",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_77": {
    "id": "auto_gen_mix_77",
    "name": "Auto Gen Mix 77",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_78": {
    "id": "auto_gen_mix_78",
    "name": "Auto Gen Mix 78",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_79": {
    "id": "auto_gen_mix_79",
    "name": "Auto Gen Mix 79",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_80": {
    "id": "auto_gen_mix_80",
    "name": "Auto Gen Mix 80",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_81": {
    "id": "auto_gen_mix_81",
    "name": "Auto Gen Mix 81",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_82": {
    "id": "auto_gen_mix_82",
    "name": "Auto Gen Mix 82",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_83": {
    "id": "auto_gen_mix_83",
    "name": "Auto Gen Mix 83",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_84": {
    "id": "auto_gen_mix_84",
    "name": "Auto Gen Mix 84",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_85": {
    "id": "auto_gen_mix_85",
    "name": "Auto Gen Mix 85",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_86": {
    "id": "auto_gen_mix_86",
    "name": "Auto Gen Mix 86",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_87": {
    "id": "auto_gen_mix_87",
    "name": "Auto Gen Mix 87",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_88": {
    "id": "auto_gen_mix_88",
    "name": "Auto Gen Mix 88",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_89": {
    "id": "auto_gen_mix_89",
    "name": "Auto Gen Mix 89",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_90": {
    "id": "auto_gen_mix_90",
    "name": "Auto Gen Mix 90",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_91": {
    "id": "auto_gen_mix_91",
    "name": "Auto Gen Mix 91",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_92": {
    "id": "auto_gen_mix_92",
    "name": "Auto Gen Mix 92",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_93": {
    "id": "auto_gen_mix_93",
    "name": "Auto Gen Mix 93",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_94": {
    "id": "auto_gen_mix_94",
    "name": "Auto Gen Mix 94",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_95": {
    "id": "auto_gen_mix_95",
    "name": "Auto Gen Mix 95",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_96": {
    "id": "auto_gen_mix_96",
    "name": "Auto Gen Mix 96",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_97": {
    "id": "auto_gen_mix_97",
    "name": "Auto Gen Mix 97",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_98": {
    "id": "auto_gen_mix_98",
    "name": "Auto Gen Mix 98",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_99": {
    "id": "auto_gen_mix_99",
    "name": "Auto Gen Mix 99",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_100": {
    "id": "auto_gen_mix_100",
    "name": "Auto Gen Mix 100",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_101": {
    "id": "auto_gen_mix_101",
    "name": "Auto Gen Mix 101",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_102": {
    "id": "auto_gen_mix_102",
    "name": "Auto Gen Mix 102",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_103": {
    "id": "auto_gen_mix_103",
    "name": "Auto Gen Mix 103",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_104": {
    "id": "auto_gen_mix_104",
    "name": "Auto Gen Mix 104",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_105": {
    "id": "auto_gen_mix_105",
    "name": "Auto Gen Mix 105",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_106": {
    "id": "auto_gen_mix_106",
    "name": "Auto Gen Mix 106",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_107": {
    "id": "auto_gen_mix_107",
    "name": "Auto Gen Mix 107",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_108": {
    "id": "auto_gen_mix_108",
    "name": "Auto Gen Mix 108",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_109": {
    "id": "auto_gen_mix_109",
    "name": "Auto Gen Mix 109",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_110": {
    "id": "auto_gen_mix_110",
    "name": "Auto Gen Mix 110",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_111": {
    "id": "auto_gen_mix_111",
    "name": "Auto Gen Mix 111",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_112": {
    "id": "auto_gen_mix_112",
    "name": "Auto Gen Mix 112",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_113": {
    "id": "auto_gen_mix_113",
    "name": "Auto Gen Mix 113",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_114": {
    "id": "auto_gen_mix_114",
    "name": "Auto Gen Mix 114",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_115": {
    "id": "auto_gen_mix_115",
    "name": "Auto Gen Mix 115",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_116": {
    "id": "auto_gen_mix_116",
    "name": "Auto Gen Mix 116",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_117": {
    "id": "auto_gen_mix_117",
    "name": "Auto Gen Mix 117",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_118": {
    "id": "auto_gen_mix_118",
    "name": "Auto Gen Mix 118",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_119": {
    "id": "auto_gen_mix_119",
    "name": "Auto Gen Mix 119",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_120": {
    "id": "auto_gen_mix_120",
    "name": "Auto Gen Mix 120",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_121": {
    "id": "auto_gen_mix_121",
    "name": "Auto Gen Mix 121",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_122": {
    "id": "auto_gen_mix_122",
    "name": "Auto Gen Mix 122",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_123": {
    "id": "auto_gen_mix_123",
    "name": "Auto Gen Mix 123",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_124": {
    "id": "auto_gen_mix_124",
    "name": "Auto Gen Mix 124",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_125": {
    "id": "auto_gen_mix_125",
    "name": "Auto Gen Mix 125",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_126": {
    "id": "auto_gen_mix_126",
    "name": "Auto Gen Mix 126",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_127": {
    "id": "auto_gen_mix_127",
    "name": "Auto Gen Mix 127",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_128": {
    "id": "auto_gen_mix_128",
    "name": "Auto Gen Mix 128",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_129": {
    "id": "auto_gen_mix_129",
    "name": "Auto Gen Mix 129",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_130": {
    "id": "auto_gen_mix_130",
    "name": "Auto Gen Mix 130",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_131": {
    "id": "auto_gen_mix_131",
    "name": "Auto Gen Mix 131",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_132": {
    "id": "auto_gen_mix_132",
    "name": "Auto Gen Mix 132",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_133": {
    "id": "auto_gen_mix_133",
    "name": "Auto Gen Mix 133",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_134": {
    "id": "auto_gen_mix_134",
    "name": "Auto Gen Mix 134",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_135": {
    "id": "auto_gen_mix_135",
    "name": "Auto Gen Mix 135",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_136": {
    "id": "auto_gen_mix_136",
    "name": "Auto Gen Mix 136",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_137": {
    "id": "auto_gen_mix_137",
    "name": "Auto Gen Mix 137",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_138": {
    "id": "auto_gen_mix_138",
    "name": "Auto Gen Mix 138",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_139": {
    "id": "auto_gen_mix_139",
    "name": "Auto Gen Mix 139",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_140": {
    "id": "auto_gen_mix_140",
    "name": "Auto Gen Mix 140",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_141": {
    "id": "auto_gen_mix_141",
    "name": "Auto Gen Mix 141",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_142": {
    "id": "auto_gen_mix_142",
    "name": "Auto Gen Mix 142",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_143": {
    "id": "auto_gen_mix_143",
    "name": "Auto Gen Mix 143",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_144": {
    "id": "auto_gen_mix_144",
    "name": "Auto Gen Mix 144",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_145": {
    "id": "auto_gen_mix_145",
    "name": "Auto Gen Mix 145",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_146": {
    "id": "auto_gen_mix_146",
    "name": "Auto Gen Mix 146",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_147": {
    "id": "auto_gen_mix_147",
    "name": "Auto Gen Mix 147",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_148": {
    "id": "auto_gen_mix_148",
    "name": "Auto Gen Mix 148",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_149": {
    "id": "auto_gen_mix_149",
    "name": "Auto Gen Mix 149",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_150": {
    "id": "auto_gen_mix_150",
    "name": "Auto Gen Mix 150",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_151": {
    "id": "auto_gen_mix_151",
    "name": "Auto Gen Mix 151",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_152": {
    "id": "auto_gen_mix_152",
    "name": "Auto Gen Mix 152",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_153": {
    "id": "auto_gen_mix_153",
    "name": "Auto Gen Mix 153",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_154": {
    "id": "auto_gen_mix_154",
    "name": "Auto Gen Mix 154",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_155": {
    "id": "auto_gen_mix_155",
    "name": "Auto Gen Mix 155",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_156": {
    "id": "auto_gen_mix_156",
    "name": "Auto Gen Mix 156",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_157": {
    "id": "auto_gen_mix_157",
    "name": "Auto Gen Mix 157",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_158": {
    "id": "auto_gen_mix_158",
    "name": "Auto Gen Mix 158",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_159": {
    "id": "auto_gen_mix_159",
    "name": "Auto Gen Mix 159",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_160": {
    "id": "auto_gen_mix_160",
    "name": "Auto Gen Mix 160",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_161": {
    "id": "auto_gen_mix_161",
    "name": "Auto Gen Mix 161",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_162": {
    "id": "auto_gen_mix_162",
    "name": "Auto Gen Mix 162",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_163": {
    "id": "auto_gen_mix_163",
    "name": "Auto Gen Mix 163",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_164": {
    "id": "auto_gen_mix_164",
    "name": "Auto Gen Mix 164",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_165": {
    "id": "auto_gen_mix_165",
    "name": "Auto Gen Mix 165",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_166": {
    "id": "auto_gen_mix_166",
    "name": "Auto Gen Mix 166",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_167": {
    "id": "auto_gen_mix_167",
    "name": "Auto Gen Mix 167",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_168": {
    "id": "auto_gen_mix_168",
    "name": "Auto Gen Mix 168",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_169": {
    "id": "auto_gen_mix_169",
    "name": "Auto Gen Mix 169",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_170": {
    "id": "auto_gen_mix_170",
    "name": "Auto Gen Mix 170",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_171": {
    "id": "auto_gen_mix_171",
    "name": "Auto Gen Mix 171",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_172": {
    "id": "auto_gen_mix_172",
    "name": "Auto Gen Mix 172",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_173": {
    "id": "auto_gen_mix_173",
    "name": "Auto Gen Mix 173",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_174": {
    "id": "auto_gen_mix_174",
    "name": "Auto Gen Mix 174",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_175": {
    "id": "auto_gen_mix_175",
    "name": "Auto Gen Mix 175",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_176": {
    "id": "auto_gen_mix_176",
    "name": "Auto Gen Mix 176",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_177": {
    "id": "auto_gen_mix_177",
    "name": "Auto Gen Mix 177",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_178": {
    "id": "auto_gen_mix_178",
    "name": "Auto Gen Mix 178",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_179": {
    "id": "auto_gen_mix_179",
    "name": "Auto Gen Mix 179",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_180": {
    "id": "auto_gen_mix_180",
    "name": "Auto Gen Mix 180",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_181": {
    "id": "auto_gen_mix_181",
    "name": "Auto Gen Mix 181",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_182": {
    "id": "auto_gen_mix_182",
    "name": "Auto Gen Mix 182",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_183": {
    "id": "auto_gen_mix_183",
    "name": "Auto Gen Mix 183",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_184": {
    "id": "auto_gen_mix_184",
    "name": "Auto Gen Mix 184",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_185": {
    "id": "auto_gen_mix_185",
    "name": "Auto Gen Mix 185",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_186": {
    "id": "auto_gen_mix_186",
    "name": "Auto Gen Mix 186",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_187": {
    "id": "auto_gen_mix_187",
    "name": "Auto Gen Mix 187",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_188": {
    "id": "auto_gen_mix_188",
    "name": "Auto Gen Mix 188",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_189": {
    "id": "auto_gen_mix_189",
    "name": "Auto Gen Mix 189",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_190": {
    "id": "auto_gen_mix_190",
    "name": "Auto Gen Mix 190",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_191": {
    "id": "auto_gen_mix_191",
    "name": "Auto Gen Mix 191",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_192": {
    "id": "auto_gen_mix_192",
    "name": "Auto Gen Mix 192",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_193": {
    "id": "auto_gen_mix_193",
    "name": "Auto Gen Mix 193",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_194": {
    "id": "auto_gen_mix_194",
    "name": "Auto Gen Mix 194",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_195": {
    "id": "auto_gen_mix_195",
    "name": "Auto Gen Mix 195",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_196": {
    "id": "auto_gen_mix_196",
    "name": "Auto Gen Mix 196",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_197": {
    "id": "auto_gen_mix_197",
    "name": "Auto Gen Mix 197",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_198": {
    "id": "auto_gen_mix_198",
    "name": "Auto Gen Mix 198",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_199": {
    "id": "auto_gen_mix_199",
    "name": "Auto Gen Mix 199",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_200": {
    "id": "auto_gen_mix_200",
    "name": "Auto Gen Mix 200",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_201": {
    "id": "auto_gen_mix_201",
    "name": "Auto Gen Mix 201",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_202": {
    "id": "auto_gen_mix_202",
    "name": "Auto Gen Mix 202",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_203": {
    "id": "auto_gen_mix_203",
    "name": "Auto Gen Mix 203",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_204": {
    "id": "auto_gen_mix_204",
    "name": "Auto Gen Mix 204",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_205": {
    "id": "auto_gen_mix_205",
    "name": "Auto Gen Mix 205",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_206": {
    "id": "auto_gen_mix_206",
    "name": "Auto Gen Mix 206",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_207": {
    "id": "auto_gen_mix_207",
    "name": "Auto Gen Mix 207",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_208": {
    "id": "auto_gen_mix_208",
    "name": "Auto Gen Mix 208",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_209": {
    "id": "auto_gen_mix_209",
    "name": "Auto Gen Mix 209",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_210": {
    "id": "auto_gen_mix_210",
    "name": "Auto Gen Mix 210",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_211": {
    "id": "auto_gen_mix_211",
    "name": "Auto Gen Mix 211",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_212": {
    "id": "auto_gen_mix_212",
    "name": "Auto Gen Mix 212",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_213": {
    "id": "auto_gen_mix_213",
    "name": "Auto Gen Mix 213",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_214": {
    "id": "auto_gen_mix_214",
    "name": "Auto Gen Mix 214",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_215": {
    "id": "auto_gen_mix_215",
    "name": "Auto Gen Mix 215",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_216": {
    "id": "auto_gen_mix_216",
    "name": "Auto Gen Mix 216",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_217": {
    "id": "auto_gen_mix_217",
    "name": "Auto Gen Mix 217",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_218": {
    "id": "auto_gen_mix_218",
    "name": "Auto Gen Mix 218",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_219": {
    "id": "auto_gen_mix_219",
    "name": "Auto Gen Mix 219",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_220": {
    "id": "auto_gen_mix_220",
    "name": "Auto Gen Mix 220",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_221": {
    "id": "auto_gen_mix_221",
    "name": "Auto Gen Mix 221",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_222": {
    "id": "auto_gen_mix_222",
    "name": "Auto Gen Mix 222",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_223": {
    "id": "auto_gen_mix_223",
    "name": "Auto Gen Mix 223",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_224": {
    "id": "auto_gen_mix_224",
    "name": "Auto Gen Mix 224",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_225": {
    "id": "auto_gen_mix_225",
    "name": "Auto Gen Mix 225",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_226": {
    "id": "auto_gen_mix_226",
    "name": "Auto Gen Mix 226",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_227": {
    "id": "auto_gen_mix_227",
    "name": "Auto Gen Mix 227",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_228": {
    "id": "auto_gen_mix_228",
    "name": "Auto Gen Mix 228",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_229": {
    "id": "auto_gen_mix_229",
    "name": "Auto Gen Mix 229",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_230": {
    "id": "auto_gen_mix_230",
    "name": "Auto Gen Mix 230",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_231": {
    "id": "auto_gen_mix_231",
    "name": "Auto Gen Mix 231",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_232": {
    "id": "auto_gen_mix_232",
    "name": "Auto Gen Mix 232",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_233": {
    "id": "auto_gen_mix_233",
    "name": "Auto Gen Mix 233",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_234": {
    "id": "auto_gen_mix_234",
    "name": "Auto Gen Mix 234",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_235": {
    "id": "auto_gen_mix_235",
    "name": "Auto Gen Mix 235",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_236": {
    "id": "auto_gen_mix_236",
    "name": "Auto Gen Mix 236",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_237": {
    "id": "auto_gen_mix_237",
    "name": "Auto Gen Mix 237",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_238": {
    "id": "auto_gen_mix_238",
    "name": "Auto Gen Mix 238",
    "description": "Craft 1 iron_ingot from stone, coal, iron_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "iron_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "auto_gen_mix_239": {
    "id": "auto_gen_mix_239",
    "name": "Auto Gen Mix 239",
    "description": "Craft 1 copper_ingot from stone, coal, copper_ore.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "stone",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "copper_ore",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_ingot",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "red_water_salve": {
    "id": "red_water_salve",
    "name": "Red Water Salve",
    "description": "Craft 1 healing_salve from red_herb, clean_water.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "red_herb",
        "quantity": 1
      },
      {
        "itemId": "clean_water",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "healing_salve",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "moss_alcohol_spirit": {
    "id": "moss_alcohol_spirit",
    "name": "Moss Alcohol Spirit",
    "description": "Craft 1 stimulant_tonic from blue_moss, alcohol.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "blue_moss",
        "quantity": 1
      },
      {
        "itemId": "alcohol",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "stimulant_tonic",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "swamp_pulp_antidote": {
    "id": "swamp_pulp_antidote",
    "name": "Swamp Pulp Antidote",
    "description": "Craft 1 antidote from swamp_pulp, distilled_water.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "swamp_pulp",
        "quantity": 1
      },
      {
        "itemId": "distilled_water",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "antidote",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "bark_water_tea": {
    "id": "bark_water_tea",
    "name": "Bark Water Tea",
    "description": "Craft 1 ration from bark_tea_leaves, clean_water.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "bark_tea_leaves",
        "quantity": 1
      },
      {
        "itemId": "clean_water",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "ration",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "hide_sinew_vest": {
    "id": "hide_sinew_vest",
    "name": "Hide Sinew Vest",
    "description": "Craft 1 leather_vest from boar_hide, sinew.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "boar_hide",
        "quantity": 1
      },
      {
        "itemId": "sinew",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "leather_vest",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "bone_wood_club": {
    "id": "bone_wood_club",
    "name": "Bone Wood Club",
    "description": "Craft 1 wooden_club from bone_fragment, oak_wood.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "bone_fragment",
        "quantity": 1
      },
      {
        "itemId": "oak_wood",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "wooden_club",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "silk_thread_cloak": {
    "id": "silk_thread_cloak",
    "name": "Silk Thread Cloak",
    "description": "Craft 1 fur_cloak from spider_silk, cloth.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "spider_silk",
        "quantity": 1
      },
      {
        "itemId": "cloth",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "fur_cloak",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "tusks_leather_dagger": {
    "id": "tusks_leather_dagger",
    "name": "Tusks Leather Dagger",
    "description": "Craft 1 copper_dagger from boar_tusk, leather_strip.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "boar_tusk",
        "quantity": 1
      },
      {
        "itemId": "leather_strip",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "copper_dagger",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "iron_coal_limestone_steel": {
    "id": "iron_coal_limestone_steel",
    "name": "Iron Coal Limestone Steel",
    "description": "Craft 1 steel_alloy from iron_ore, coal, stone.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "iron_ore",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "stone",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "steel_alloy",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "oak_leather_nails_shield": {
    "id": "oak_leather_nails_shield",
    "name": "Oak Leather Nails Shield",
    "description": "Craft 1 wooden_shield from oak_wood, leather_strip, nails.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "oak_wood",
        "quantity": 1
      },
      {
        "itemId": "leather_strip",
        "quantity": 1
      },
      {
        "itemId": "nails",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "wooden_shield",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "spruce_sinew_feather_bow": {
    "id": "spruce_sinew_feather_bow",
    "name": "Spruce Sinew Feather Bow",
    "description": "Craft 1 longbow from spruce_wood, sinew, crow_feather.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "spruce_wood",
        "quantity": 1
      },
      {
        "itemId": "sinew",
        "quantity": 1
      },
      {
        "itemId": "crow_feather",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "longbow",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "iron_oak_leather_sword": {
    "id": "iron_oak_leather_sword",
    "name": "Iron Oak Leather Sword",
    "description": "Craft 1 iron_sword from iron_ingot, oak_wood, leather_strip.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      },
      {
        "itemId": "oak_wood",
        "quantity": 1
      },
      {
        "itemId": "leather_strip",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "iron_sword",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "iron_oak_leather_hammer": {
    "id": "iron_oak_leather_hammer",
    "name": "Iron Oak Leather Hammer",
    "description": "Craft 1 war_hammer from iron_ingot, oak_wood, leather_strip.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      },
      {
        "itemId": "oak_wood",
        "quantity": 1
      },
      {
        "itemId": "leather_strip",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "war_hammer",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "iron_leather_sinew_spear": {
    "id": "iron_leather_sinew_spear",
    "name": "Iron Leather Sinew Spear",
    "description": "Craft 1 spear from iron_ingot, leather_strip, sinew.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "iron_ingot",
        "quantity": 1
      },
      {
        "itemId": "leather_strip",
        "quantity": 1
      },
      {
        "itemId": "sinew",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "spear",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "ruby_silver_quartz_ward": {
    "id": "ruby_silver_quartz_ward",
    "name": "Ruby Silver Quartz Ward",
    "description": "Craft 1 essence_ward from ruby, silver_ore, quartz.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "ruby",
        "quantity": 1
      },
      {
        "itemId": "silver_ore",
        "quantity": 1
      },
      {
        "itemId": "quartz",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "essence_ward",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "demon_ichor_acid_grey": {
    "id": "demon_ichor_acid_grey",
    "name": "Demon Ichor Acid Grey",
    "description": "Craft 1 anti_grey_serum from demon_blood, acid_vial, raw_essence_crystal.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "demon_blood",
        "quantity": 1
      },
      {
        "itemId": "acid_vial",
        "quantity": 1
      },
      {
        "itemId": "raw_essence_crystal",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "anti_grey_serum",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "sulfur_coal_grey_powder": {
    "id": "sulfur_coal_grey_powder",
    "name": "Sulfur Coal Grey Powder",
    "description": "Craft 2 black_powder from sulfur, coal, grey_salt.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "sulfur",
        "quantity": 1
      },
      {
        "itemId": "coal",
        "quantity": 1
      },
      {
        "itemId": "grey_salt",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "black_powder",
        "quantity": 2
      }
    ],
    "xpReward": 0,
    "enabled": true
  },
  "quicksilver_essence_glass_vial": {
    "id": "quicksilver_essence_glass_vial",
    "name": "Quicksilver Essence Glass Vial",
    "description": "Craft 1 essence_vial from quicksilver, essence_dust, glass_vial.",
    "type": "crafting",
    "craftingMethod": "mixture",
    "itemInputs": [
      {
        "itemId": "quicksilver",
        "quantity": 1
      },
      {
        "itemId": "essence_dust",
        "quantity": 1
      },
      {
        "itemId": "glass_vial",
        "quantity": 1
      }
    ],
    "itemOutputs": [
      {
        "itemId": "essence_vial",
        "quantity": 1
      }
    ],
    "xpReward": 0,
    "enabled": true
  }
},
});

export type DefaultItemId = keyof typeof DEFAULT_CONTENT_PACK.items;
export type DefaultRecipeId = keyof typeof DEFAULT_CONTENT_PACK.recipes;
export type DefaultLocationId = keyof typeof DEFAULT_CONTENT_PACK.locations;
export type DefaultDropTableId = keyof typeof DEFAULT_CONTENT_PACK.dropTables;
