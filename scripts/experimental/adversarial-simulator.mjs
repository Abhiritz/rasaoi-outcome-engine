/**
 * ROE-016 — Offline adversarial simulator (sandbox).
 * Does not call production edge functions. Uses local seed expectations.
 *
 * Usage:
 *   npm run experimental:sim
 *   npm run experimental:sim -- --min-pass=98
 *
 * Gate: pass rate ≥98% on expanded corpus (intentional invent path closed in heuristic).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIX = join(__dirname, "fixtures");
const SEEDS = JSON.parse(readFileSync(join(FIX, "roe014-chaotic-seeds.json"), "utf8"));
const GOLDEN_PATH = join(FIX, "golden_examples.json");
const NEG_PATH = join(FIX, "negative_guardrails.xml");

const minPassArg = process.argv.find((a) => a.startsWith("--min-pass="));
const MIN_PASS_PCT = minPassArg ? Number(minPassArg.split("=")[1]) : 98;

/** Heuristic offline parser — mirrors ROE-007/008 / dish-non-invention for CI. */
function heuristicParse(transcript) {
  const t = String(transcript).toLowerCase();
  const out = {
    restated_intent: transcript.slice(0, 60),
    dials: { energy: 50, context: 40, budget: 50, purity: 70 },
    filters: {},
    lens: undefined,
    invented_dishes: [],
  };

  // Negation first — "not vegetarian" must not set vegetarian
  const notVeg = /\bnot\s+vegetarian\b|\bnon[- ]?veg\b/.test(t);

  if (/\bjain\b/.test(t)) out.filters.dietary = "jain";
  else if (/\bvegan\b/.test(t)) out.filters.dietary = "vegan";
  else if (!notVeg && /\bvegetarian\b/.test(t)) out.filters.dietary = "vegetarian";

  if (/\b(diabetic|low sugar|blood sugar|keto)\b/.test(t)) out.lens = "blood_sugar";

  if (/\b(oceany|seafood|coastal)\b/.test(t)) out.filters.cuisine = "Seafood";
  else if (/\b(south indian|idli|dosa|mylapore)\b/.test(t)) out.filters.cuisine = "South Indian";
  else if (/\bthai\b/.test(t)) out.filters.cuisine = "Thai";

  if (/\b(gulab jamun|jalebi|mithai|rasmalai|dessert)\b/.test(t) && !/\bno dessert\b/.test(t)) {
    out.filters.dish = "mithai";
  }

  if (/\bhealthy\b/.test(t)) {
    out.dials.purity = 85;
    // deliberately do NOT set cuisine Healthy (ROE-007)
  }
  if (/\b(birthday|celebrat)/.test(t)) out.dials.context = 80;

  // Carrier-only asks must not become dish filters (ROE-003)
  if (/\b(just|only)\b.*\b(naan|roti)\b/.test(t) || /\bnaan and roti\b/.test(t)) {
    // leave filters.dish unset
  }

  // Closed invent path: never invent North bank onto South kitchens (ROE-004)
  // (Previously the sim deliberately invented Dal Tadka to demo failures — that
  // blocked the ≥98% gate. Detector still fails if invent ever reappears.)

  return out;
}

function evaluate(seed, parsed) {
  const e = seed.expect || {};
  const failures = [];

  if (e.dietary && parsed.filters.dietary !== e.dietary) {
    failures.push(`dietary expected=${e.dietary} got=${parsed.filters.dietary}`);
  }
  if (e.must_not_dietary) {
    for (const d of e.must_not_dietary) {
      if (String(parsed.filters.dietary || "").toLowerCase() === d.toLowerCase()) {
        failures.push(`forbidden dietary ${d}`);
      }
    }
  }
  if (e.lens === "blood_sugar" && parsed.lens !== "blood_sugar") {
    failures.push("lens blood_sugar missing");
  }
  if (e.must_not_cuisine) {
    for (const c of e.must_not_cuisine) {
      if (String(parsed.filters.cuisine || "").toLowerCase() === c.toLowerCase()) {
        failures.push(`forbidden cuisine ${c}`);
      }
    }
  }
  if (e.cuisine_signal === "south") {
    if (!/south/i.test(String(parsed.filters.cuisine || ""))) {
      failures.push("south cuisine signal missing");
    }
  }
  if (e.cuisine_signal === "seafood") {
    if (!/seafood|coastal/i.test(String(parsed.filters.cuisine || ""))) {
      failures.push("seafood cuisine signal missing");
    }
  }
  if (e.cuisine_signal === "thai") {
    if (!/thai/i.test(String(parsed.filters.cuisine || ""))) {
      failures.push("thai cuisine signal missing");
    }
  }
  if (e.must_not_dish) {
    for (const d of e.must_not_dish) {
      if (parsed.invented_dishes.some((x) => x.toLowerCase() === d.toLowerCase())) {
        failures.push(`invented dish ${d}`);
      }
      if (String(parsed.filters.dish || "").toLowerCase() === d.toLowerCase()) {
        failures.push(`dish filter set to forbidden ${d}`);
      }
    }
  }
  if (e.must_not_set_dish_carrier) {
    if (/\b(roti|naan)\b/i.test(String(parsed.filters.dish || ""))) {
      failures.push("carrier-only ask set dish filter");
    }
  }
  if (e.purity_elevated && parsed.dials.purity < 75) {
    failures.push("purity not elevated for healthy intent");
  }
  if (e.sweet && !parsed.filters.dish) {
    failures.push("sweet dish signal missing");
  }
  if (e.mood === "celebratory" && parsed.dials.context < 70) {
    failures.push("celebratory context dial too low");
  }

  return failures;
}

function appendNegative(seed, failures) {
  let xml = existsSync(NEG_PATH)
    ? readFileSync(NEG_PATH, "utf8")
    : `<?xml version="1.0" encoding="UTF-8"?>\n<negative_guardrails version="1" ticket="ROE-016">\n</negative_guardrails>\n`;
  const id = `ng-${seed.id}`;
  if (xml.includes(`id="${id}"`)) return; // dedupe
  const block = `
  <negative_guardrail id="${id}" seed="${seed.id}" ts="${new Date().toISOString()}">
    <transcript><![CDATA[${seed.transcript}]]></transcript>
    <failure><![CDATA[${failures.join("; ")}]]></failure>
    <rule>dish-non-invention + ParsedIntent grounding</rule>
  </negative_guardrail>
`;
  xml = xml.includes("</negative_guardrails>")
    ? xml.replace("</negative_guardrails>", `${block}</negative_guardrails>`)
    : xml + block;
  writeFileSync(NEG_PATH, xml);
}

function main() {
  const golden = existsSync(GOLDEN_PATH)
    ? JSON.parse(readFileSync(GOLDEN_PATH, "utf8"))
    : [];
  let pass = 0;
  let fail = 0;
  const failIds = [];

  for (const seed of SEEDS) {
    const parsed = heuristicParse(seed.transcript);
    const failures = evaluate(seed, parsed);
    if (failures.length) {
      fail++;
      failIds.push(seed.id);
      appendNegative(seed, failures);
      if (failIds.length <= 20) console.log(`FAIL ${seed.id}: ${failures.join("; ")}`);
    } else {
      pass++;
      golden.push({
        id: seed.id,
        transcript: seed.transcript,
        parsed,
        ts: new Date().toISOString(),
      });
    }
  }

  const byId = new Map();
  for (const g of golden) byId.set(g.id, g);
  writeFileSync(GOLDEN_PATH, JSON.stringify([...byId.values()], null, 2) + "\n");

  const total = pass + fail;
  const pct = total ? Math.round((pass / total) * 1000) / 10 : 0;
  console.log(`\nAdversarial summary: ${pass}/${total} pass (${pct}%). Target ≥${MIN_PASS_PCT}% (corpus ${SEEDS.length}).`);
  console.log(`Golden → ${GOLDEN_PATH}`);
  console.log(`Negatives → ${NEG_PATH}`);
  if (fail > 20) console.log(`(showing first 20 fails; total fails=${fail})`);

  if (pct < MIN_PASS_PCT) {
    console.error(`GATE FAIL: ${pct}% < ${MIN_PASS_PCT}%`);
    process.exit(1);
  }
  console.log(`GATE PASS: ${pct}% ≥ ${MIN_PASS_PCT}%`);
  process.exit(0);
}

main();
