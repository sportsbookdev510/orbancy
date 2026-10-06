// A coin's icon, read at a glance: the color says its personality, the mark says its drive, and the
// name shifts the shade so no two coins look alike. Plain data, shared by the site (an SVG over a CSS
// gradient) and the launch route (the PNG that becomes the token's logo).

// Personality → hue. Spread around the wheel so each one is its own color.
export const HUES = {
  Trickster: 18,
  Builder: 46,
  Guardian: 140,
  Cartographer: 184,
  Analyst: 218,
  Oracle: 272,
  Contrarian: 342,
};

// Drive → the mark inside the Orbancy ring, in a 100-unit box. Rings are [rx, ry, opacity], hollow;
// discs are [cx, cy, r, opacity], filled.
const RING = [34, 34, 0.9];
const ORBIT = [34, 12.8, 0.55];
const CORE = [50, 50, 10.4, 0.95];
export const MARKS = {
  "Steady buybacks": { rings: [RING, ORBIT], discs: [CORE] }, // the Orbancy mark itself: one steady orbit
  "Research first": {
    rings: [RING, ORBIT, [12.8, 34, 0.55]],
    discs: [[50, 50, 8, 0.95]],
  }, // crossed orbits, a globe
  "Culture over price": {
    rings: [RING],
    discs: [
      [50, 50, 8, 0.95],
      ...[-90, 30, 150].map((a) => [
        50 + 21 * Math.cos((a * Math.PI) / 180),
        50 + 21 * Math.sin((a * Math.PI) / 180),
        5,
        0.9,
      ]),
    ],
  }, // a core and its people
  "Holder confidence": { rings: [RING, [21, 21, 0.7]], discs: [CORE] }, // a shield around the core
  "Calm in volatility": { rings: [RING], discs: [CORE] }, // nothing moving
  "Open book": { rings: [RING, ORBIT, [10.4, 10.4, 0.95]], discs: [] }, // an open core
  "Convince me": {
    rings: [RING],
    discs: [
      [50, 50, 8, 0.95],
      [27, 50, 5, 0.9],
      [73, 50, 5, 0.9],
    ],
  }, // a core that listens both ways
};
const STROKE = 3.2;
const INK = "#F4EFE4";

const hash = (s) =>
  [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/// { stops: [[offset, h, s, l]…], mark } for a coin. Unknown personalities fall back to a hue from the name.
export function sigilSpec(name = "", personality, drive) {
  const n = hash(name);
  const base = HUES[personality] ?? n % 360;
  const h = (base + ((n % 21) - 10) + 360) % 360; // ±10° by name, staying inside the personality's color
  const s = 30 + ((n >>> 5) % 14); // 30–43%
  return {
    stops: [
      [0, h, s + 8, 86],
      [0.58, (h + 14) % 360, s, 46],
      [1, (h + 28) % 360, s + 4, 18],
    ],
    mark: MARKS[drive] || MARKS["Steady buybacks"],
  };
}

/// The mark as an SVG string, for CSS backgrounds.
export function markSvg(mark) {
  const rings = mark.rings
    .map(
      ([rx, ry, o]) =>
        `<ellipse cx="50" cy="50" rx="${rx}" ry="${ry}" stroke-opacity="${o}"/>`
    )
    .join("");
  const discs = mark.discs
    .map(
      ([cx, cy, r, o]) =>
        `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(
          2
        )}" r="${r}" fill="${INK}" fill-opacity="${o}" stroke="none"/>`
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="${INK}" stroke-width="${STROKE}">${rings}${discs}</svg>`;
}

export const INK_RGB = [244, 239, 228];
export { STROKE };
