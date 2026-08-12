/**
 * Scans public/art/ for `<number>.<ext>` images and writes lib/art-manifest.json.
 * Runs automatically before `next dev` and `next build` (see package.json scripts).
 * Re-run with `npm run scan:art` after dropping in new artwork images.
 */
import { readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ART_DIR = join(ROOT, "public", "art");
const OUT_FILE = join(ROOT, "lib", "art-manifest.json");

mkdirSync(ART_DIR, { recursive: true });

const manifest = {};
for (const file of readdirSync(ART_DIR)) {
  const m = file.match(/^(\d+)\.(png|jpe?g|webp|gif)$/i);
  if (m) manifest[m[1]] = file;
}

writeFileSync(OUT_FILE, JSON.stringify(manifest, null, 2) + "\n");

const count = Object.keys(manifest).length;
console.log(
  `🎨 art manifest: ${count} image${count === 1 ? "" : "s"} found in public/art/ -> lib/art-manifest.json`
);
