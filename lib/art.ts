import artManifest from "./art-manifest.json";

/**
 * Maps artwork numbers to their public image URLs.
 *
 * Drop files named `<number>.jpg|png|webp|gif` into `public/art/`, then run
 * `npm run scan:art` (it also runs automatically before `next dev`/`next build`)
 * to regenerate `lib/art-manifest.json`.
 */
export function artImages(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [num, file] of Object.entries(artManifest)) {
    out[num] = "/art/" + file;
  }
  return out;
}
