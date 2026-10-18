// Generates the illustrated avatars and supplier logos with DiceBear's CC0 styles.
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAvatar } from "@dicebear/core";
import { notionists, shapes } from "@dicebear/collection";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../assets/images");
const backgrounds = ["b6e3f4", "c0aede", "d1d4f9", "ffd5dc", "ffdfbf", "c7f0d8", "fde68a"];

async function write(svg, file, size) {
  await mkdir(path.dirname(file), { recursive: true });
  await sharp(Buffer.from(svg)).resize(size, size).webp({ quality: 80 }).toFile(file);
}

const sets = [
  { style: notionists, folder: "avatars/guides", prefix: "guide", count: 25, digits: 2, size: 192 },
  { style: notionists, folder: "avatars/travellers", prefix: "traveller", count: 300, digits: 3, size: 192 },
  { style: shapes, folder: "suppliers", prefix: "supplier", count: 80, digits: 3, size: 160 },
];

for (const set of sets) {
  for (let i = 1; i <= set.count; i++) {
    const name = `${set.prefix}-${String(i).padStart(set.digits, "0")}`;
    const svg = createAvatar(set.style, { seed: `voyager-${name}`, backgroundColor: backgrounds, radius: set.style === shapes ? 20 : 0 }).toString();
    await write(svg, path.join(root, set.folder, `${name}.webp`), set.size);
  }

  console.log(`${set.folder}: ${set.count}`);
}
