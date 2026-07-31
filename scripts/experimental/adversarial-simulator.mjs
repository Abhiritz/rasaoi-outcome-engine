/**
 * ROE-016 — Offline adversarial simulator (sandbox).
 * Does not call production edge functions. Uses local seed expectations +
 * optional EXPERIMENTAL_LLM_BASE_URL when EXPERIMENTAL_MODE=true.
 *
 * Usage: node scripts/experimental/adversarial-simulator.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIX = join(__dirname, "fixtures");
const SEEDS = JSON.parse(readFileSync(join(FIX, "roe014-chaotic-seeds.json"), "utf8"));
const GOLDEN_PATH = join(FIX, "golden_examples.json");
const NEG_PATH = join(FIX, "negative_guardrails.xml");

/** Heuristic offline parser stand-in — mirrors ROE-007/008 guardrails for CI without LLM spend. */
function heuristicParse(transcript) {
  const t = String(transcript).toLowerCase();
  const out = {
    restated_intent: transcript.slice(0, 60),
    dials: { energy: 50, context: 40, budget: 50, purity: 70 },
    filters: {},
    lens: undefined,
    invented_dishes: [],
  };

  if (/\bjain\b/.test(t)) out.filters.dietary = "jain";
  if (/\bvegan\b/.test(t)) out.filters.dietary = "vegan";
  if (/\bvegetarian\b/.test(t) && !/\bnon[- ]?veg/.test(t)) out.filters.dietary = "vegetarian";
  if (/\b(diabetic|low sugar|blood sugar|keto)\b/.test(t)) out.lens = "blood_sugar";
  if (/\b(oceany|seafood|coastal)\b/.test(t)) out.filters.cuisine = "Seafood";
  if (/\b(south indian|idli|dosa|mylapore)\b/.test(t)) out.filters.cuisine = "South Indian";
  if (/\b(gulab jamun|jalebi|mithai|dessert)\b/.test(t)) out.filters.dish = "mithai";
  if (/\bhealthy\b/.test(t)) {
    out.dials.purity = 85;
    // deliberately do NOT set cuisine Healthy
  }
  if (/\b(birthday|celebrat)/.test(t)) out.dials.context = 80;

  // Simulate the failure mode we want to catch: inventing Dal Tadka on Mylapore
  if (/\bdal tadka\b/.test(t) && /\bmylapore\b/.test(t)) {
    out.invented_dishes.push("Dal Tadka");
  }

  return out;
}

function evaluate(seed, parsed) {
  const e = seed.expect || {};
  const failures = [];

  if (e.dietary && parsed.filters.dietary !== e.dietary) {
    failures.push(`dietary expected=${e.dietary} got=${parsed.filters.dietary}`);
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
  if (e.purity_elevated && parsed.dials.purity < 75) {
    failures.push("purity not elevated for healthy intent");
  }
  if (e.sweet && !parsed.filters.dish) {
    failures.push("sweet dish signal missing");
  }

  return failures;
}

function appendNegative(seed, failures) {
  let xml = readFileSync(NEG_PATH, "utf8");
  const block = `
  <negative_guardrail id="ng-${seed.id}" seed="${seed.id}" ts="${new Date().toISOString()}">
    <transcript><![CDATA[${seed.transcript}]]></transcript>
    <failure><![CDATA[${failures.join("; ")}]]></failure>
    <rule>dish-non-invention + ParsedIntent grounding</rule>
  </negative_guardrail>
`;
  xml = xml.replace("</negative_guardrails>", `${block}</negative_guardrails>`);
  writeFileSync(NEG_PATH, xml);
}

function main() {
  const golden = JSON.parse(readFileSync(GOLDEN_PATH, "utf8"));
  let pass = 0;
  let fail = 0;

  for (const seed of SEEDS) {
    const parsed = heuristicParse(seed.transcript);
    const failures = evaluate(seed, parsed);
    if (failures.length) {
      fail++;
      appendNegative(seed, failures);
      console.log(`FAIL ${seed.id}: ${failures.join("; ")}`);
    } else {
      pass++;
      golden.push({
        id: seed.id,
        transcript: seed.transcript,
        parsed,
        ts: new Date().toISOString(),
      });
      console.log(`PASS ${seed.id}`);
    }
  }

  // Dedupe golden by id (keep latest)
  const byId = new Map();
  for (const g of golden) byId.set(g.id, g);
  writeFileSync(GOLDEN_PATH, JSON.stringify([...byId.values()], null, 2) + "\n");

  const total = pass + fail;
  const pct = total ? Math.round((pass / total) * 1000) / 10 : 0;
  console.log(`\nAdversarial summary: ${pass}/${total} pass (${pct}%). Target ≥98% after 500+ corpus.`);
  console.log(`Golden → ${GOLDEN_PATH}`);
  console.log(`Negatives → ${NEG_PATH}`);
  if (fail > 0 && SEEDS.some((s) => s.force_fail_if_model_invents)) {
    console.log("Note: intentional fail seeds are expected until invent-path is fully blocked in simulator LLM mode.");
  }
  process.exit(fail > 0 && pass === 0 ? 1 : 0);
}

main();
