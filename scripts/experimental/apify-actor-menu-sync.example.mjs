/**
 * EXP-T11 — Apify Actor: weekly menu → staging webhook
 *
 * Paste into Apify Console → Actor source (Node.js).
 *
 * Input JSON shape:
 * {
 *   "webhookUrl": "https://aotlzhdgnvovvqxmgyyx.supabase.co/functions/v1/experimental-apify-webhook",
 *   "webhookSecret": "<APIFY_WEBHOOK_SECRET>",
 *   "mode": "auto",   // auto | catalog | scrape
 *   "targets": [ { restaurant_name, source_url?, dishes?: [{name,price}] } ]
 * }
 *
 * auto: scrape when source_url present, else POST dishes from input (catalog refresh)
 * catalog: always POST input dishes
 * scrape: only venues with source_url
 */
import { Actor } from "apify";

await Actor.init();

const input = (await Actor.getInput()) ?? {};
const {
  webhookUrl,
  webhookSecret,
  mode = "auto",
  targets = [],
} = input;

if (!webhookUrl || !webhookSecret) {
  throw new Error("webhookUrl and webhookSecret required");
}
if (!Array.isArray(targets) || !targets.length) {
  throw new Error("targets[] required — paste restaurants from apify-menu-targets.json");
}

async function scrapeDishes(sourceUrl) {
  const res = await fetch(sourceUrl, {
    headers: { "User-Agent": "Mozilla/5.0 Rasaoi-Apify" },
  });
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  const html = await res.text();
  const dishes = [];
  const re =
    /([A-Z][A-Za-z0-9 &'()-]{2,40})\s*[–\-:]?\s*\$?\s*(\d{1,3}(?:\.\d{2})?)/g;
  let m;
  while ((m = re.exec(html)) && dishes.length < 100) {
    dishes.push({ name: m[1].trim(), price: Number(m[2]) });
  }
  return dishes;
}

const restaurants = [];

for (const t of targets) {
  const name = String(t.restaurant_name || t.name || "").trim();
  if (!name) continue;

  const sourceUrl = t.source_url || null;
  const catalogDishes = Array.isArray(t.dishes)
    ? t.dishes.filter((d) => d?.name)
    : [];

  let dishes = [];
  let via = "skip";

  const wantScrape =
    (mode === "scrape" || mode === "auto") && !!sourceUrl;
  const wantCatalog =
    mode === "catalog" || (mode === "auto" && !sourceUrl) || mode === "auto";

  if (wantScrape) {
    try {
      dishes = await scrapeDishes(sourceUrl);
      via = "scrape";
      console.log(`${name}: scraped ${dishes.length} from ${sourceUrl}`);
    } catch (e) {
      console.log(`${name}: scrape failed (${e.message}), fallback catalog`);
      dishes = catalogDishes;
      via = "catalog-fallback";
    }
  }

  if (!dishes.length && wantCatalog && catalogDishes.length) {
    dishes = catalogDishes;
    via = "catalog";
    console.log(`${name}: catalog upsert ${dishes.length}`);
  }

  if (!dishes.length) {
    console.log(`${name}: nothing to send (add source_url or dishes in input)`);
    continue;
  }

  restaurants.push({
    restaurant_name: name,
    dishes: dishes.map((d) => ({
      name: d.name,
      price: typeof d.price === "number" ? d.price : undefined,
      course: d.course,
      dish_type: d.dish_type,
    })),
    _via: via,
  });
}

if (!restaurants.length) {
  console.log("Nothing to POST — exiting OK");
  await Actor.setValue("OUTPUT", { ok: true, upserted: 0, reason: "empty" });
  await Actor.exit();
}

const payload = {
  restaurants: restaurants.map(({ restaurant_name, dishes }) => ({
    restaurant_name,
    dishes,
  })),
};

const post = await fetch(webhookUrl, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-apify-webhook-secret": webhookSecret,
  },
  body: JSON.stringify(payload),
});
const text = await post.text();
console.log(`Webhook ${post.status}: ${text.slice(0, 500)}`);
await Actor.setValue("OUTPUT", {
  status: post.status,
  body: text,
  restaurants: restaurants.map((r) => ({
    name: r.restaurant_name,
    dishes: r.dishes.length,
    via: r._via,
  })),
});

if (!post.ok) throw new Error(`Webhook failed: ${post.status} ${text}`);

await Actor.exit();
