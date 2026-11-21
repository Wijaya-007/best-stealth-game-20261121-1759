// WHITEOUT — shared constants: canvas, palette, speeds and detection tuning.
// Every number lives here so the whole game can be balanced from one file.
export const VIEW = { width: 1280, height: 720 };
export const HUD_HEIGHT = 56;
export const STEP = 1 / 60;

export const PALETTE = {
  snow: '#eef4fb',
  snowShade: '#dde9f6',
  snowSparkle: '#ffffff',
  drift: '#cfe0f2',
  driftEdge: '#a9c6e4',
  wall: '#8fb8dd',
  wallEdge: '#5d8fc0',
  wallTop: '#b9d4ee',
  crate: '#d9a05b',
  crateEdge: '#a8742f',
  crateTop: '#eec084',
  helipad: '#3fae7a',
  helipadRing: '#ffffff',
  core: '#22c8d8',
  coreGlow: 'rgba(34, 200, 216, 0.35)',
  player: '#ff7a1a',
  playerEdge: '#b34d00',
  guard: '#c0392b',
  guardEdge: '#7b1f16',
  cone: 'rgba(255, 214, 64, 0.34)',
  coneAlert: 'rgba(255, 64, 64, 0.45)',
  coneStorm: 'rgba(255, 214, 64, 0.16)',
  hudBack: 'rgba(13, 32, 56, 0.92)',
  hudText: '#eaf3ff',
  hudWarn: '#ffd640',
  hudDanger: '#ff5a5a',
  stormVeil: 'rgba(240, 248, 255, 0.28)',
  footprint: 'rgba(70, 100, 140, 0.35)',
  noiseRing: 'rgba(255, 122, 26, 0.55)',
  titleBack: '#0d2038',
};

export const PLAYER = {
  radius: 13,
  walkSpeed: 165,
  runSpeed: 265,
  crouchSpeed: 88,
  // Footprints: one pair every step of this distance while moving.
  stride: 26,
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 78,
  chaseSpeed: 168,
  investigateSpeed: 120,
  visionRange: 185,
  visionHalfAngle: 0.61, // ~35 degrees each side
  stormVisionFactor: 0.55,
  catchDistance: 30,
  hearRadius: 110,
  // Detection rises this fast (per second) when the player is fully inside a cone.
  detectRate: 55,
  // Running in a cone is louder and easier to spot.
  detectRunFactor: 1.6,
  detectCrouchFactor: 0.45,
  detectDecay: 26,
  stormDetectFactor: 0.3,
  // Seconds a guard keeps chasing after losing sight before giving up.
  chaseMemory: 4,
};

export const STORM = {
  firstAt: 14, // seconds into a level before the first gust
  period: 20, // seconds between gust starts
  duration: 5, // seconds each gust lasts
  warnBefore: 2, // seconds of HUD warning before a gust
};

export const GAME = {
  lives: 3,
  coresPerLevel: 3,
};
