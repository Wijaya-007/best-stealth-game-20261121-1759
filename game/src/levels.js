// WHITEOUT — the three levels. All geometry is hand-placed and fixed, so every run
// of a level is identical; patrol routes were checked against walls and crates so a
// guard never walks into solid cover. Coordinates are canvas pixels (1280x720, the
// top 56 px are the HUD). Walls and crates block movement and sight; snowdrifts block
// sight only, and walking through one is slow — they are the soft cover.
import { HUD_HEIGHT } from './config.js';

const BORDER = [
  { x: 0, y: HUD_HEIGHT, w: 1280, h: 16 },
  { x: 0, y: 704, w: 1280, h: 16 },
  { x: 0, y: HUD_HEIGHT, w: 16, h: 648 },
  { x: 1264, y: HUD_HEIGHT, w: 16, h: 648 },
];

export const LEVELS = [
  {
    name: 'STASIUN AURORA',
    subtitle: 'Level 1 — belajar merunduk di balik tumpukan salju',
    seed: 11,
    playerStart: { x: 80, y: 650 },
    helipad: { x: 1180, y: 130, r: 46 },
    cores: [
      { x: 640, y: 340 },
      { x: 250, y: 120 },
      { x: 1150, y: 640 },
    ],
    walls: [
      ...BORDER,
      { x: 300, y: 200, w: 20, h: 240 },
      { x: 700, y: 380, w: 280, h: 20 },
      { x: 980, y: 120, w: 20, h: 160 },
    ],
    crates: [
      { x: 480, y: 140, w: 56, h: 56 },
      { x: 560, y: 560, w: 56, h: 56 },
      { x: 1080, y: 420, w: 56, h: 56 },
    ],
    drifts: [
      { x: 180, y: 480, w: 200, h: 48 },
      { x: 820, y: 140, w: 200, h: 48 },
      { x: 1050, y: 580, w: 150, h: 48 },
    ],
    guards: [
      { waypoints: [{ x: 360, y: 320 }, { x: 900, y: 320 }], pause: 1.2 },
      { waypoints: [{ x: 1000, y: 180 }, { x: 1000, y: 600 }], pause: 1.0 },
    ],
  },
  {
    name: 'DEPOT ES',
    subtitle: 'Level 2 — tiga penjaga, lorong sempit, badai lebih sering',
    seed: 23,
    playerStart: { x: 80, y: 650 },
    helipad: { x: 1180, y: 120, r: 46 },
    cores: [
      { x: 400, y: 110 },
      { x: 700, y: 420 },
      { x: 1160, y: 620 },
    ],
    walls: [
      ...BORDER,
      { x: 240, y: 160, w: 20, h: 300 },
      { x: 560, y: 120, w: 20, h: 260 },
      { x: 880, y: 420, w: 20, h: 220 },
      { x: 340, y: 500, w: 300, h: 20 },
      { x: 900, y: 180, w: 220, h: 20 },
    ],
    crates: [
      { x: 420, y: 300, w: 56, h: 56 },
      { x: 700, y: 560, w: 56, h: 56 },
      { x: 1120, y: 300, w: 56, h: 56 },
      { x: 180, y: 600, w: 56, h: 56 },
    ],
    drifts: [
      { x: 300, y: 620, w: 200, h: 48 },
      { x: 980, y: 100, w: 160, h: 48 },
      { x: 640, y: 260, w: 180, h: 48 },
    ],
    guards: [
      { waypoints: [{ x: 300, y: 420 }, { x: 860, y: 420 }], pause: 0.9 },
      { waypoints: [{ x: 980, y: 300 }, { x: 980, y: 640 }], pause: 1.1 },
      { waypoints: [{ x: 130, y: 180 }, { x: 130, y: 620 }], pause: 1.4 },
    ],
  },
  {
    name: 'REAKTOR BEKU',
    subtitle: 'Level 3 — empat penjaga menjaga inti terakhir',
    seed: 37,
    playerStart: { x: 80, y: 650 },
    helipad: { x: 1180, y: 120, r: 46 },
    cores: [
      { x: 400, y: 640 },
      { x: 700, y: 100 },
      { x: 1180, y: 300 },
      { x: 120, y: 120 },
    ],
    walls: [
      ...BORDER,
      { x: 220, y: 140, w: 20, h: 260 },
      { x: 520, y: 380, w: 20, h: 260 },
      { x: 820, y: 140, w: 20, h: 260 },
      { x: 1080, y: 380, w: 20, h: 260 },
      { x: 360, y: 560, w: 280, h: 20 },
      { x: 700, y: 160, w: 220, h: 20 },
    ],
    crates: [
      { x: 340, y: 260, w: 56, h: 56 },
      { x: 660, y: 520, w: 56, h: 56 },
      { x: 940, y: 300, w: 56, h: 56 },
      { x: 1140, y: 620, w: 56, h: 56 },
      { x: 120, y: 420, w: 56, h: 56 },
    ],
    drifts: [
      { x: 280, y: 120, w: 180, h: 48 },
      { x: 900, y: 600, w: 180, h: 48 },
      { x: 560, y: 240, w: 160, h: 48 },
    ],
    guards: [
      { waypoints: [{ x: 300, y: 320 }, { x: 760, y: 320 }], pause: 0.8 },
      { waypoints: [{ x: 880, y: 240 }, { x: 1200, y: 240 }], pause: 0.8 },
      { waypoints: [{ x: 200, y: 200 }, { x: 200, y: 600 }], pause: 1.2 },
      { waypoints: [{ x: 620, y: 620 }, { x: 1020, y: 620 }], pause: 1.0 },
    ],
  },
];

/** A rectangle blocks sight: walls, crates and drifts alike. */
export function sightBlockers(level) {
  return [...level.walls, ...level.crates, ...level.drifts];
}

/** A rectangle blocks movement: walls and crates, but never drifts. */
export function solidBlockers(level) {
  return [...level.walls, ...level.crates];
}
