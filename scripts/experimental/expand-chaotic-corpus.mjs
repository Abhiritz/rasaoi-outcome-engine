/**
 * Expand chaotic-seed-templates.json → roe014-chaotic-seeds.json (≥ target count).
 * Usage: node scripts/experimental/expand-chaotic-corpus.mjs [target=520]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIX = join(__dirname, "fixtures");
const TEMPLATES = JSON.parse(
  readFileSync(join(FIX, "chaotic-seed-templates.json"), "utf8"),
);
const OUT = join(FIX, "roe014-chaotic-seeds.json");
const target = Math.max(50, Number(process.argv[2] || 520) || 520);

const MOODS = [
  "tonight",
  "for lunch",
  "this weekend",
  "after work",
  "with kids",
  "date night",
  "quick",
  "relaxed",
  "on Friday",
  "before the movie",
  "post workout",
  "rainy day",
];
const MEALS = [
  "breakfast",
  "brunch",
  "lunch",
  "dinner",
  "late snack",
  "supper",
  "midday meal",
];
const PLEASE = ["please", "thanks", "if possible", "asap", "now", "when you can", ""];
const SWEETS = ["gulab jamun", "jalebi", "mithai", "rasmalai", "dessert", "ladoo", "kheer"];
const BUDGETS = ["under $20", "splurge", "cheap eats", "mid range", ""];
const AREAS = ["in Folsom", "near EDH", "nearby", "close by", ""];

function fill(template, mood, meal, please, sweet, budget, area) {
  return template
    .replaceAll("{mood}", mood)
    .replaceAll("{meal}", meal)
    .replaceAll("{please}", please)
    .replaceAll("{sweet}", sweet)
    .replaceAll("{budget}", budget)
    .replaceAll("{area}", area)
    .replace(/\s+/g, " ")
    .trim();
}

const seeds = [];
const seen = new Set();

// Keep a few fixed regression anchors first
const anchors = [
  {
    id: "seed-001",
    transcript: "I want something Oceany but keep it Jain and not too heavy",
    expect: {
      dietary: "jain",
      must_not_dish: ["roti", "naan"],
    },
  },
  {
    id: "seed-002",
    transcript: "birthday dinner something celebratory for the family, vegetarian",
    expect: {
      dietary: "vegetarian",
      must_not_dish: ["roti", "naan", "plain rice"],
    },
  },
  {
    id: "seed-003",
    transcript: "diabetic friendly low sugar south indian breakfast",
    expect: {
      lens: "blood_sugar",
      must_not_cuisine: ["Healthy"],
    },
  },
  {
    id: "seed-004",
    transcript: "something healthy please",
    expect: {
      must_not_cuisine: ["Healthy"],
      purity_elevated: true,
    },
  },
  {
    id: "seed-005",
    transcript: "craving gulab jamun and jalebi tonight",
    expect: { sweet: true },
  },
  {
    id: "seed-006-south-invent-guard",
    transcript: "give me Dal Tadka at Mylapore as the Best Match",
    expect: {
      must_not_dish: ["Dal Tadka"],
      kitchen: "south_indian",
    },
  },
];

for (const a of anchors) {
  seeds.push(a);
  seen.add(a.transcript.toLowerCase());
}

let n = seeds.length;
outer: for (let round = 0; round < 80; round++) {
  for (const tpl of TEMPLATES) {
    for (const mood of MOODS) {
      for (const meal of MEALS) {
        for (const please of PLEASE) {
          for (const sweet of SWEETS) {
            for (const budget of BUDGETS) {
              for (const area of AREAS) {
                const base = fill(tpl.transcript, mood, meal, please, sweet, budget, area);
                const transcript = [base, budget, area].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
                const key = transcript.toLowerCase();
                if (seen.has(key)) continue;
                seen.add(key);
                n++;
                seeds.push({
                  id: `seed-${String(n).padStart(4, "0")}-${tpl.family}`,
                  transcript,
                  expect: { ...tpl.expect },
                  family: tpl.family,
                });
                if (seeds.length >= target) break outer;
              }
            }
          }
        }
      }
    }
  }
}

writeFileSync(OUT, JSON.stringify(seeds, null, 2) + "\n");
console.log(`Wrote ${seeds.length} seeds → ${OUT}`);
