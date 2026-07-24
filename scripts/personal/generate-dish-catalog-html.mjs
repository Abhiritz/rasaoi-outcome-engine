/**
 * Generate folsom-edh-indian-menu-catalog.html from dish-data JSON.
 * Usage: node scripts/personal/generate-dish-catalog-html.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");
const dishDir = resolve(__dirname, "dish-data");
const outPath = resolve(root, "folsom-edh-indian-menu-catalog.html");

const RESTAURANTS = [
  // ROE-005: Mythaai demo retired from catalog HTML
  { file: "taj-grill.json", name: "Taj Grill Indian Cuisine", hood: "Folsom", sig: "Tandoori Chicken" },
  { file: "sanskrit.json", name: "Sanskrit", hood: "Folsom", sig: "Sanskrit Butter Masala (Paneer)" },
  { file: "mantra.json", name: "Mantra", hood: "Folsom", sig: "Vegan Chana Masala" },
  { file: "ruchi.json", name: "Ruchi Indian Cuisine", hood: "Folsom", sig: "Chicken Tikka Masala" },
  { file: "mylapore.json", name: "Mylapore", hood: "Folsom", sig: "Masala Dosa" },
  { file: "india-oven.json", name: "India Oven", hood: "El Dorado Hills", sig: "Butter Chicken" },
  { file: "bawarchi.json", name: "Bawarchi Indian Cuisine", hood: "El Dorado Hills", sig: "Chicken Biryani" },
];

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function dietLabel(d) {
  const mods = d.dietary_modifiers ?? [];
  if (mods.includes("jain")) return "Jain";
  if (d.diet_class === "vegan") return "Vegan";
  if (d.diet_class === "vegetarian") return "Veg";
  if (d.diet_class === "eggetarian") return "Eggetarian";
  if (d.diet_class === "non_veg") return "Non-Veg";
  if (mods.includes("halal")) return "Halal";
  if (mods.includes("jhatka")) return "Jhatka";
  if (mods.includes("kosher")) return "Kosher";
  return d.diet_class ?? "—";
}

function dietClass(d) {
  const label = dietLabel(d);
  if (label === "Non-Veg") return "diet-nv";
  if (label === "Vegan" || label === "Jain") return "diet-veg";
  return "diet-mid";
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const venues = RESTAURANTS.map((r) => {
  const dishes = JSON.parse(readFileSync(resolve(dishDir, r.file), "utf8"));
  return { ...r, id: slug(r.name), dishes };
});

const totalDishes = venues.reduce((n, v) => n + v.dishes.length, 0);
const folsomCount = venues.filter((v) => v.hood === "Folsom").length;
const edhCount = venues.filter((v) => v.hood === "El Dorado Hills").length;

const dietStats = {};
for (const v of venues) {
  for (const d of v.dishes) {
    const k = d.diet_class ?? "unknown";
    dietStats[k] = (dietStats[k] ?? 0) + 1;
  }
}

function dishCard(d) {
  const extras = [];
  if (d.contains_dairy) extras.push("Dairy");
  if (d.contains_eggs) extras.push("Eggs");
  if (d.contains_nuts) extras.push("Nuts");
  if (d.gluten_free) extras.push("GF");
  const mods = (d.dietary_modifiers ?? []).filter((m) => !["jain"].includes(m) || dietLabel(d) !== "Jain");
  return `
    <article class="dish-card">
      <div class="dish-card__head">
        <h4 class="dish-card__name">${esc(d.name)}</h4>
        ${d.price != null ? `<span class="dish-card__price">$${esc(d.price)}</span>` : ""}
      </div>
      ${d.description ? `<p class="dish-card__desc">${esc(d.description)}</p>` : ""}
      <div class="dish-card__tags">
        <span class="diet-pill ${dietClass(d)}">${esc(dietLabel(d))}</span>
        ${mods.map((m) => `<span class="tag tag-mod">${esc(m)}</span>`).join("")}
        ${d.category ? `<span class="tag">${esc(d.category)}</span>` : ""}
        ${d.cuisine_region ? `<span class="tag tag-region">${esc(d.cuisine_region)}</span>` : ""}
        ${d.purity_tier ? `<span class="tag tag-purity">${esc(d.purity_tier)}</span>` : ""}
        ${extras.map((e) => `<span class="tag tag-hint">${esc(e)}</span>`).join("")}
      </div>
    </article>`;
}

function venueSection(v) {
  const byCat = {};
  for (const d of v.dishes) {
    const c = d.category ?? "Other";
    if (!byCat[c]) byCat[c] = [];
    byCat[c].push(d);
  }
  const cats = Object.keys(byCat).sort();
  return `
    <section class="section venue-section" id="${v.id}">
      <div class="venue-header">
        <div>
          <p class="venue-eyebrow">${esc(v.hood)} · Indian</p>
          <h2 class="serif venue-title">${esc(v.name)}</h2>
          <p class="venue-sig">Signature: <em>${esc(v.sig)}</em></p>
        </div>
        <div class="venue-stat">
          <span class="venue-stat__num">${v.dishes.length}</span>
          <span class="venue-stat__label">Dishes</span>
        </div>
      </div>
      ${cats
        .map(
          (cat) => `
        <div class="category-block">
          <h3 class="category-title">${esc(cat)}</h3>
          <div class="dish-grid">${byCat[cat].map(dishCard).join("")}</div>
        </div>`,
        )
        .join("")}
    </section>`;
}

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Rasaoi — Folsom &amp; El Dorado Hills Indian Menu Catalog</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="description" content="Curated Indian menu catalog — 8 venues, ${totalDishes} dishes across Folsom and El Dorado Hills (DATA-001 / DIET-001)." />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #f7f4ee;
      --surface: #fffdf9;
      --primary: #1b3d3a;
      --primary-soft: #2a5550;
      --gold: #c9a227;
      --gold-soft: #f3e6b8;
      --text: #1f2937;
      --muted: #6b7280;
      --border: #e5e0d5;
      --shadow: 0 18px 50px -24px rgba(27, 61, 58, 0.35);
      --radius: 12px;
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      font-family: "Inter", system-ui, sans-serif;
      line-height: 1.65;
      color: var(--text);
      background:
        radial-gradient(circle at top right, rgba(201, 162, 39, 0.12), transparent 28%),
        radial-gradient(circle at top left, rgba(27, 61, 58, 0.08), transparent 24%),
        var(--bg);
    }
    h1, h2, h3, .serif { font-family: "Cormorant Garamond", Georgia, serif; color: var(--gold); }
    h1 { font-size: clamp(2rem, 5vw, 3.2rem); line-height: 1.05; margin: 0 0 0.5rem; letter-spacing: -0.02em; }
    h2 { font-size: clamp(1.5rem, 3vw, 2rem); margin: 0; line-height: 1.1; }
    h3 { font-size: 1rem; margin: 0 0 0.75rem; color: var(--primary); font-family: Inter, sans-serif; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
    p { margin: 0.45rem 0; }
    .page-shell { max-width: 1100px; margin: 0 auto; padding: 1.25rem 1.25rem 4rem; }
    .export-bar {
      position: sticky; top: 0; z-index: 50;
      display: flex; align-items: center; justify-content: space-between; gap: 1rem;
      padding: 0.75rem 1rem; margin-bottom: 1rem;
      background: rgba(255, 253, 249, 0.92); backdrop-filter: blur(10px);
      border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow);
    }
    .export-bar__brand { font-size: 0.72rem; letter-spacing: 0.22em; text-transform: uppercase; color: var(--muted); font-weight: 600; }
    .btn-export {
      appearance: none; border: 1px solid var(--gold);
      background: linear-gradient(135deg, #d4af37, #b8891d);
      color: #1b3d3a; font: inherit; font-size: 0.78rem; font-weight: 700;
      letter-spacing: 0.08em; text-transform: uppercase;
      padding: 0.62rem 1rem; border-radius: 999px; cursor: pointer;
      box-shadow: 0 8px 20px -10px rgba(201, 162, 39, 0.8);
    }
    .btn-export:hover { transform: translateY(-1px); }
    .hero {
      background: linear-gradient(135deg, var(--primary) 0%, #16302d 55%, #102422 100%);
      color: #f8faf9; border-radius: calc(var(--radius) + 4px);
      padding: clamp(1.5rem, 4vw, 2.5rem); margin-bottom: 1.25rem;
      box-shadow: var(--shadow); border: 1px solid rgba(201, 162, 39, 0.35);
    }
    .hero__eyebrow { display: inline-block; font-size: 0.68rem; letter-spacing: 0.28em; text-transform: uppercase; color: var(--gold-soft); margin-bottom: 0.75rem; font-weight: 600; }
    .hero p { color: rgba(248, 250, 249, 0.88); max-width: 65ch; }
    .hero h1 { color: #fffdf9; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.85rem; margin: 1.25rem 0 0; }
    .metric { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: var(--radius); padding: 0.85rem 1rem; }
    .metric__num { font-family: "Cormorant Garamond", serif; font-size: 2rem; line-height: 1; color: var(--gold-soft); font-weight: 700; }
    .metric__label { font-size: 0.68rem; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(248,250,249,0.7); margin-top: 0.35rem; font-weight: 600; }
    .jump-nav { display: flex; flex-wrap: wrap; gap: 0.45rem; margin: 1.25rem 0 1.5rem; }
    .jump-nav a {
      font-size: 0.7rem; letter-spacing: 0.06em; text-transform: uppercase; font-weight: 600;
      padding: 0.45rem 0.75rem; border-radius: 999px;
      background: var(--surface); border: 1px solid var(--border); color: var(--primary); text-decoration: none;
    }
    .jump-nav a:hover { border-color: var(--gold); background: #fff9ea; }
    .jump-nav .hood-label { width: 100%; font-size: 0.65rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--muted); font-weight: 700; margin: 0.5rem 0 0.15rem; }
    .section {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: calc(var(--radius) + 2px); padding: clamp(1rem, 3vw, 1.6rem);
      margin-bottom: 1.25rem; box-shadow: var(--shadow);
    }
    .callout {
      border-left: 4px solid var(--gold);
      background: linear-gradient(90deg, #fff9ea, #fffdf9);
      padding: 0.9rem 1rem; border-radius: 8px; margin-bottom: 1.25rem; font-size: 0.95rem;
    }
    .callout small { display: block; font-size: 0.68rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); margin-bottom: 0.35rem; font-weight: 600; }
    .diet-summary { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem; }
    .venue-header { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 1.25rem; padding-bottom: 1rem; border-bottom: 2px solid var(--gold-soft); }
    .venue-eyebrow { font-size: 0.68rem; letter-spacing: 0.22em; text-transform: uppercase; color: var(--muted); font-weight: 600; margin: 0 0 0.35rem; }
    .venue-title { color: var(--primary); }
    .venue-sig { font-size: 0.9rem; color: var(--muted); margin: 0.35rem 0 0; }
    .venue-stat { text-align: center; background: #fcfaf6; border: 1px solid var(--border); border-radius: 10px; padding: 0.65rem 1rem; min-width: 72px; }
    .venue-stat__num { display: block; font-family: "Cormorant Garamond", serif; font-size: 1.75rem; font-weight: 700; color: var(--gold); line-height: 1; }
    .venue-stat__label { font-size: 0.62rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); font-weight: 600; }
    .category-block { margin-bottom: 1.5rem; }
    .category-block:last-child { margin-bottom: 0; }
    .dish-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 0.75rem; }
    .dish-card {
      border: 1px solid var(--border); border-radius: 10px; padding: 0.9rem 1rem;
      background: linear-gradient(180deg, #fffdf9 0%, #fcfaf6 100%);
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .dish-card:hover { border-color: rgba(201, 162, 39, 0.55); box-shadow: 0 10px 28px -18px rgba(27, 61, 58, 0.35); }
    .dish-card__head { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.35rem; }
    .dish-card__name { margin: 0; font-family: "Cormorant Garamond", serif; font-size: 1.15rem; font-weight: 600; color: var(--primary); line-height: 1.2; }
    .dish-card__price { font-size: 0.85rem; font-weight: 700; color: var(--gold); white-space: nowrap; }
    .dish-card__desc { font-size: 0.82rem; color: var(--muted); line-height: 1.45; margin: 0 0 0.6rem; }
    .dish-card__tags { display: flex; flex-wrap: wrap; gap: 0.25rem; }
    .tag {
      display: inline-block; font-size: 0.62rem; letter-spacing: 0.08em; text-transform: uppercase;
      padding: 0.15rem 0.5rem; border-radius: 999px; border: 1px solid var(--border);
      background: #faf8f3; color: var(--muted); font-weight: 600;
    }
    .tag-mod { border-color: #c9a22744; background: #fff9ea; color: #92400e; }
    .tag-region { border-color: #2a555044; background: #ecfdf5; color: #166534; }
    .tag-purity { border-color: #6366f144; background: #eef2ff; color: #3730a3; }
    .tag-hint { border-color: #e5e0d5; background: #f9fafb; color: #6b7280; }
    .diet-pill {
      display: inline-block; font-size: 0.62rem; letter-spacing: 0.1em; text-transform: uppercase;
      padding: 0.18rem 0.55rem; border-radius: 4px; font-weight: 700; border: 1px solid;
    }
    .diet-veg { background: #ecfdf5; color: #166534; border-color: #bbf7d0; }
    .diet-mid { background: #fffbeb; color: #92400e; border-color: #fde68a; }
    .diet-nv { background: #fff1f2; color: #9f1239; border-color: #fecdd3; }
    footer { text-align: center; font-size: 0.75rem; color: var(--muted); padding: 2rem 0 0; letter-spacing: 0.06em; }
    @media print {
      .export-bar { display: none; }
      .dish-card { break-inside: avoid; }
      body { background: white; }
    }
  </style>
</head>
<body>
  <div class="page-shell">
    <div class="export-bar">
      <span class="export-bar__brand">Rasaoi · Personal Dev Catalog</span>
      <button class="btn-export" type="button" onclick="window.print()">Print / Save PDF</button>
    </div>

    <header class="hero">
      <span class="hero__eyebrow">DATA-001 · DIET-001 · June 2026</span>
      <h1 class="serif">Indian Menu Catalog</h1>
      <p>
        Curated dishes across <strong>${folsomCount} Folsom</strong> and <strong>${edhCount} El Dorado Hills</strong> venues —
        ${totalDishes} items with canonical <code style="background:rgba(0,0,0,0.2);padding:0.1rem 0.35rem;border-radius:4px;color:#f3e6b8">diet_class</code>
        taxonomy for Reading-page gates and Lab QA.
      </p>
      <div class="metrics">
        <div class="metric"><div class="metric__num">8</div><div class="metric__label">Restaurants</div></div>
        <div class="metric"><div class="metric__num">${totalDishes}</div><div class="metric__label">Dishes</div></div>
        <div class="metric"><div class="metric__num">6</div><div class="metric__label">Folsom</div></div>
        <div class="metric"><div class="metric__num">2</div><div class="metric__label">EDH</div></div>
      </div>
    </header>

    <div class="callout">
      <small>Dietary breakdown</small>
      <div class="diet-summary">
        ${Object.entries(dietStats)
          .sort((a, b) => b[1] - a[1])
          .map(([k, n]) => `<span class="tag tag-region">${esc(k.replace("_", "-"))}: ${n}</span>`)
          .join("")}
      </div>
    </div>

    <nav class="jump-nav" aria-label="Restaurant quick links">
      <span class="hood-label">Folsom</span>
      ${venues
        .filter((v) => v.hood === "Folsom")
        .map((v) => `<a href="#${v.id}">${esc(v.name)}</a>`)
        .join("")}
      <span class="hood-label">El Dorado Hills</span>
      ${venues
        .filter((v) => v.hood === "El Dorado Hills")
        .map((v) => `<a href="#${v.id}">${esc(v.name)}</a>`)
        .join("")}
    </nav>

    ${venues.map(venueSection).join("\n")}

    <footer>
      Rasaoi Outcome Engine · Personal Supabase <code>kiugplotjcnmpwjlxajc</code> · Generated from <code>scripts/personal/dish-data/</code>
    </footer>
  </div>
</body>
</html>`;

writeFileSync(outPath, html, "utf8");
console.log(`Wrote ${outPath} (${totalDishes} dishes, ${venues.length} venues)`);
