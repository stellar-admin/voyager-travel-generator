// Fetches CC0 and public-domain photos from Openverse and converts them to compressed WebP.
//
//   node photos.mjs            fetch every missing photo
//   node photos.mjs kyoto ...  replace the photos for these destinations or pools with the next candidates
//   node photos.mjs trips/kyoto.webp  replace a single photo
//
// Picks are recorded in assets/images/photos.json so reruns reuse them; search results are cached in .cache/.
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const seedRoot = path.resolve(here, "../..");
const imagesRoot = path.join(seedRoot, "assets/images");
const manifestPath = path.join(imagesRoot, "photos.json");
const cacheRoot = path.join(here, ".cache");
const catalogPath = path.join(seedRoot, "overlay/src/VoyagerTravel/Data/Seeding/Catalog.cs");

// Searches that find better photos than "<destination> <country>", tried in order. Landmarks work best.
const queryOverrides = {
  kansai: ["Nara deer temple", "Nara Japan", "Himeji castle"],
  "cusco-region": ["Sacred Valley Peru", "Sacred Valley Urubamba", "Ollantaytambo"],
  "south-iceland": ["Skogafoss waterfall"],
  patagonia: ["Patagonia mountains", "Patagonia landscape"],
  "el-chalten": ["Fitz Roy mountain"],
  "el-calafate": ["Perito Moreno glacier"],
  rajasthan: ["Jodhpur fort"],
  "everest-region": ["Ama Dablam", "Himalaya mountains Nepal", "Everest Himalaya"],
  "wild-atlantic-way": ["Cliffs of Moher"],
  "masai-mara": ["Masai Mara savanna"],
  serengeti: ["Serengeti wildlife"],
  "great-barrier-reef": ["coral reef fish"],
  uluru: ["Uluru"],
  "douro-valley": ["Douro valley vineyards"],
  lofoten: ["Reine Lofoten", "Lofoten Norway", "Lofoten islands"],
  "machu-picchu": ["Machu Picchu"],
  tambopata: ["Amazon rainforest river"],
  galapagos: ["Galapagos sea lion", "Galapagos tortoise", "Galapagos"],
  komodo: ["Komodo dragon", "Padar island", "Komodo island"],
  sossusvlei: ["Deadvlei", "Namib desert dunes", "Sossusvlei dunes"],
  etosha: ["Etosha national park", "Namibia zebra", "Etosha elephants"],
  "gobi-desert": ["Mongolia desert camels", "Mongolia steppe", "Gobi desert", "Mongolia landscape", "Mongolia"],
  "scottish-highlands": ["Scottish Highlands glen"],
  kruger: ["Kruger national park"],
  "ha-long-bay": ["Ha Long Bay"],
  "torres-del-paine": ["Torres del Paine"],
  atacama: ["Valle de la Luna Chile", "Atacama Chile", "Atacama desert"],
  merzouga: ["Merzouga dunes"],
  "wadi-rum": ["Wadi Rum"],
  kazbegi: ["Gergeti Trinity church", "Caucasus mountains Georgia", "Kazbegi Gergeti", "Stepantsminda", "Caucasus mountains"],
  jeju: ["Jeju island"],
  hokkaido: ["Hokkaido"],
  dolomites: ["Dolomites"],
  "new-york": ["New York skyline"],
  florence: ["Florence Duomo", "Ponte Vecchio"],
  siena: ["Siena Piazza del Campo", "Siena Italy"],
  rome: ["Colosseum", "Rome Trevi fountain"],
  fes: ["Fes medina", "Fez Morocco"],
  nairobi: ["Kenya giraffe", "Nairobi national park", "Nairobi skyline", "Nairobi Kenya", "Nairobi"],
  zanzibar: ["Zanzibar beach", "Stone Town Zanzibar"],
  yucatan: ["Chichen Itza", "cenote Mexico"],
  arenal: ["Arenal volcano", "Costa Rica volcano"],
  "buenos-aires": ["Buenos Aires Caminito", "Buenos Aires Obelisco", "Buenos Aires"],
  mendoza: ["Mendoza vineyard", "Malbec vineyard Andes", "Mendoza Argentina", "Aconcagua"],
  cairo: ["Giza pyramids", "pyramids Egypt"],
  galle: ["Galle fort Sri Lanka", "Sri Lanka beach"],
  paris: ["Eiffel Tower", "Paris Seine"],
  dublin: ["Dublin Ha'penny bridge", "Dublin Temple Bar", "Dublin Ireland", "Dublin"],
  istanbul: ["Hagia Sophia", "Istanbul Bosphorus"],
  cappadocia: ["Cappadocia balloons", "Goreme Cappadocia"],
  lucerne: ["Lucerne Switzerland", "Lucerne Chapel Bridge", "Lucerne old town", "Mount Pilatus"],
  banff: ["Moraine Lake", "Lake Louise"],
  edinburgh: ["Edinburgh castle"],
  kandy: ["Kandy lake", "Sri Lanka tea plantation"],
  santorini: ["Oia Santorini", "Santorini Greece"],
  tromso: ["northern lights Norway", "Tromso Norway"],
  vancouver: ["Vancouver skyline", "Stanley Park Vancouver"],
  tokyo: ["Tokyo skyline", "Shibuya crossing", "Tokyo Japan"],
  osaka: ["Osaka castle", "Dotonbori"],
};

const pools = [
  { folder: "hotels", prefix: "hotel", count: 24, queries: ["hotel room bed", "hotel lobby", "hotel swimming pool", "beach resort", "mountain lodge", "hotel terrace"] },
  ...[
    ["walking-tour", ["cobblestone street old town", "historic old town street", "guided walking tour old town", "tourists old town square", "tour guide group"]],
    ["cooking-class", "cooking class kitchen"],
    ["market", "food market stall"],
    ["cycling", "cycling countryside"],
    ["boat", "sunset boat sea"],
    ["museum", ["art museum interior", "museum gallery interior"]],
    ["kayak", "kayaking"],
    ["wine", "wine tasting vineyard"],
    ["balloon", "hot air balloons"],
    ["snorkel", ["snorkeling", "snorkeling coral reef"]],
  ].map(([kind, query]) => ({ folder: "excursions", prefix: kind, count: 2, queries: [query].flat(), noPad: true })),
];

// Museum and library collections are mostly scans of old prints, paintings and stereoview cards.
const bannedCreators = /getty|museum|library|smithsonian|rijks|archive|gallery|yale|nypl|institute|collection/i;
const bannedWords = /\b(map|flag|logo|stamp|coin|poster|postcard|diagram|drawing|painting|illustration|engraving|chart|book|text|sign|ticket|selfie|stereo\w*|souvenir|model|exhibit|hospital|troops|visit|meeting|conference|minister|embassy|ambassador|delegation)\b/i;
let lastRequest = 0;

async function search(query) {
  const cacheFile = path.join(cacheRoot, `${query.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.json`);
  if (existsSync(cacheFile)) {
    return JSON.parse(await readFile(cacheFile, "utf8"));
  }

  const wait = lastRequest + 3500 - Date.now();
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }

  lastRequest = Date.now();
  const url = new URL("https://api.openverse.org/v1/images/");
  url.search = new URLSearchParams({ q: query, license: "cc0", category: "photograph", mature: "false", page_size: "20" }).toString();
  const response = await fetch(url, { headers: { "User-Agent": "voyager-travel-seed/1.0" } });
  if (!response.ok) {
    throw new Error(`Openverse ${response.status} for "${query}": ${await response.text()}`);
  }

  const results = (await response.json()).results;
  await mkdir(cacheRoot, { recursive: true });
  await writeFile(cacheFile, JSON.stringify(results, null, 2));
  return results;
}

// Hasler and Süsstrunk's colourfulness metric; rejects black-and-white scans and washed-out photos.
async function colourfulness(buffer) {
  const { data } = await sharp(buffer, { failOn: "none" }).resize(64, 64, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const rg = [];
  const yb = [];
  for (let i = 0; i < data.length; i += 3) {
    rg.push(data[i] - data[i + 1]);
    yb.push((data[i] + data[i + 1]) / 2 - data[i + 2]);
  }

  const stats = (values) => {
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    return [mean, Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length)];
  };
  const [rgMean, rgDeviation] = stats(rg);
  const [ybMean, ybDeviation] = stats(yb);
  return Math.hypot(rgDeviation, ybDeviation) + 0.3 * Math.hypot(rgMean, ybMean);
}

// Pool searches are generic; destination photos must mention a word from the search in their title or tags.
function relevant(result, query) {
  const text = `${result.title ?? ""} ${(result.tags ?? []).map((tag) => tag.name).join(" ")}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const words = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/\s+/).filter((word) => word.length > 3);
  return pools.some((pool) => pool.queries.includes(query)) || words.some((word) => text.includes(word));
}

async function convert(candidate, file) {
  const response = await fetch(candidate.url, { headers: { "User-Agent": "voyager-travel-seed/1.0" }, signal: AbortSignal.timeout(60000) });
  if (!response.ok) {
    return false;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const image = sharp(buffer, { failOn: "none" }).rotate();
  const { width, height } = await image.metadata();
  if (!width || !height || width < 900 || width < height * 1.2 || (await colourfulness(buffer)) < 20) {
    return false;
  }

  await mkdir(path.dirname(file), { recursive: true });
  await image.resize({ width: 1280, withoutEnlargement: true }).webp({ quality: 68, effort: 6 }).toFile(file);
  return true;
}

async function fill(targets, queries, manifest, used, replace) {
  targets = targets.filter((target) => !singles.size || singles.has(target));
  if (targets.length === 0) {
    return;
  }

  const candidates = [];
  for (const query of queries) {
    for (const result of await search(query)) {
      if (result.license === "cc0" && relevant(result, query) && !used.has(result.id) && !bannedWords.test(result.title ?? "") && !bannedCreators.test(result.creator ?? "") && !candidates.some((candidate) => candidate.id === result.id)) {
        candidates.push(result);
      }
    }
  }

  // Round-robin across queries keeps a pool varied.
  for (const target of targets) {
    if (!replace && existsSync(path.join(imagesRoot, target))) {
      continue;
    }

    const rejected = new Set(manifest[target]?.rejected ?? []);
    if (replace && manifest[target]) {
      rejected.add(manifest[target].id);
    }

    let picked = false;
    while (candidates.length > 0 && !picked) {
      const candidate = candidates.shift();
      if (rejected.has(candidate.id) || used.has(candidate.id)) {
        continue;
      }

      try {
        picked = await convert(candidate, path.join(imagesRoot, target));
      } catch {
        picked = false;
      }

      if (picked) {
        used.add(candidate.id);
        manifest[target] = {
          id: candidate.id,
          title: candidate.title,
          creator: candidate.creator ?? null,
          license: `${candidate.license.toUpperCase()} ${candidate.license_version ?? ""}`.trim(),
          source: candidate.foreign_landing_url,
          rejected: [...rejected],
        };
        console.log(`${target} <- ${candidate.title}`);
      }
    }

    if (!picked && replace && existsSync(path.join(imagesRoot, target))) {
      await unlink(path.join(imagesRoot, target));
      manifest[target] = { rejected: [...rejected] };
      console.warn(`${target}: removed, no better photo found`);
    } else if (!picked && !existsSync(path.join(imagesRoot, target))) {
      console.warn(`${target}: no usable photo found`);
    }
  }
}

async function writeCredits(manifest) {
  const lines = [
    "# Photo credits",
    "",
    "All photos are CC0 or public domain, found through [Openverse](https://openverse.org). Avatars and supplier logos are generated with [DiceBear](https://www.dicebear.com) (Notionists by Zoish and Shapes, both CC0 1.0).",
    "",
    "| File | Photo | Creator | Licence |",
    "| --- | --- | --- | --- |",
    ...Object.keys(manifest).filter((file) => manifest[file].id && existsSync(path.join(imagesRoot, file))).sort().map((file) => {
      const entry = manifest[file];
      const title = (entry.title ?? "Untitled").replaceAll("|", "\\|");
      return `| ${file} | [${title}](${entry.source}) | ${(entry.creator ?? "Unknown").replaceAll("|", "\\|")} | ${entry.license} |`;
    }),
    "",
  ];
  await writeFile(path.join(imagesRoot, "CREDITS.md"), lines.join("\n"));
}

const catalog = await readFile(catalogPath, "utf8");
const countries = Object.fromEntries([...catalog.matchAll(/\("([A-Z]{2})", "([^"]+)", Continent\./g)].map((match) => [match[1], match[2]]));
const destinations = [...catalog.matchAll(/new\("([a-z-]+)", "([^"]+)", "([A-Z]{2})", /g)].map((match) => ({ slug: match[1], name: match[2], country: countries[match[3]] }));
const tripSlugs = new Set([...catalog.matchAll(/new\("([a-z-]+)", "[^"]+", TripType\./g)].map((match) => match[1]));
const reset = process.argv.includes("--reset");
const args = process.argv.slice(2).filter((arg) => arg !== "--reset");
const singles = new Set(args.filter((arg) => arg.endsWith(".webp")));
const only = new Set(args.map((arg) => (arg.endsWith(".webp") ? path.basename(arg, ".webp").replace(/-\d+$/, "") : arg)));

const manifest = existsSync(manifestPath) && !reset ? JSON.parse(await readFile(manifestPath, "utf8")) : {};
const used = new Set(Object.values(manifest).map((entry) => entry.id).filter(Boolean));

try {
  for (const destination of destinations) {
    if (only.size > 0 && !only.has(destination.slug)) {
      continue;
    }

    const targets = [`destinations/${destination.slug}.webp`];
    if (tripSlugs.has(destination.slug)) {
      targets.push(`trips/${destination.slug}.webp`);
    }

    await fill(targets, queryOverrides[destination.slug] ?? [`${destination.name} ${destination.country}`], manifest, used, only.size > 0);
  }

  for (const pool of pools) {
    if (only.size > 0 && !only.has(pool.prefix) && !only.has(pool.folder)) {
      continue;
    }

    const targets = Array.from({ length: pool.count }, (_, i) => `${pool.folder}/${pool.prefix}-${pool.noPad ? i + 1 : String(i + 1).padStart(2, "0")}.webp`);
    await fill(targets, pool.queries, manifest, used, only.size > 0);
  }

  // Trips without their own photo share the destination's; a region without one borrows a city's.
  for (const destination of destinations) {
    const hero = path.join(imagesRoot, `destinations/${destination.slug}.webp`);
    const child = destinations.find((other) => catalog.includes(`new("${other.slug}", "${other.name}", "`) && new RegExp(`new\\("${other.slug}", "[^"]+", "[A-Z]{2}", "${destination.slug}"`).test(catalog));
    if (!existsSync(hero) && child && existsSync(path.join(imagesRoot, `destinations/${child.slug}.webp`))) {
      await copyFile(path.join(imagesRoot, `destinations/${child.slug}.webp`), hero);
    }

    const trip = path.join(imagesRoot, `trips/${destination.slug}.webp`);
    if (tripSlugs.has(destination.slug) && !existsSync(trip) && existsSync(hero)) {
      await copyFile(hero, trip);
    }

    if (!existsSync(hero) || (tripSlugs.has(destination.slug) && !existsSync(trip))) {
      console.warn(`${destination.slug}: still missing a photo`);
    }
  }

  // A pool photo without its own pick shares a sibling's.
  for (const pool of pools) {
    const files = Array.from({ length: pool.count }, (_, i) => path.join(imagesRoot, pool.folder, `${pool.prefix}-${pool.noPad ? i + 1 : String(i + 1).padStart(2, "0")}.webp`));
    const existing = files.filter((file) => existsSync(file));
    for (const [index, file] of files.entries()) {
      if (!existsSync(file) && existing.length > 0) {
        await copyFile(existing[index % existing.length], file);
      }
    }
  }
} finally {
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  await writeCredits(manifest);
}
