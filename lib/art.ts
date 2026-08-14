import artManifest from "./art-manifest.json";

function generatePlaceholderSvg(num: string | number): string {
  const n = Number(num);
  const hue = Math.floor((n * 137.5) % 360);
  const hue2 = (hue + 60) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <defs>
    <linearGradient id="g${n}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="hsl(${hue}, 70%, 45%)"/>
      <stop offset="100%" stop-color="hsl(${hue2}, 80%, 25%)"/>
    </linearGradient>
  </defs>
  <rect width="400" height="300" fill="url(#g${n})"/>
  <circle cx="200" cy="120" r="48" fill="rgba(255,255,255,0.12)"/>
  <text x="200" y="132" font-family="system-ui, -apple-system, sans-serif" font-size="38" font-weight="800" fill="#ffffff" text-anchor="middle">#${n}</text>
  <text x="200" y="200" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="500" fill="rgba(255,255,255,0.85)" text-anchor="middle">Artwork Candidate</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Maps artwork numbers to their public image URLs or fallback SVG placeholders.
 */
export function artImages(): Record<string, string> {
  const out: Record<string, string> = {};
  const manifestMap = artManifest as Record<string, string>;

  // Include any manifest entries first
  for (const [num, file] of Object.entries(manifestMap)) {
    out[num] = "/art/" + file;
  }

  // Wrap in proxy so any queried key returns manifest image or fallback SVG
  return new Proxy(out, {
    get(target, prop: string) {
      if (typeof prop === "string" && !isNaN(Number(prop))) {
        if (target[prop]) return target[prop];
        return generatePlaceholderSvg(prop);
      }
      return target[prop];
    },
  });
}

