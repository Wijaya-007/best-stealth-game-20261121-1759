// WHITEOUT — the screenshot scenes behind ?shot=cover|patrol|storm|escape. Each one
// plays the real rules forward from a fresh world for a fixed number of steps,
// steered by a scripted pilot that walks the player between waypoints (the same
// click-to-move steering a human uses), so the frame is what a short game really
// looks like and the same seed always gives the same frame. No randomness: the
// world is deterministic, so re-running a scene reproduces it exactly.
import { STEP } from './config.js';
import { LEVELS } from './levels.js';
import { createWorld, stepWorld, stormAmountAt } from './world.js';

const MAX_SECONDS = 90;

// Legs the pilot walks, in order. `crouch` keeps the player hard to spot on a leg
// that crosses a patrol route; `wait` holds still that many seconds at the end.
const SCRIPTS = {
  // Full level in view: the player slips behind the crates north of guard A's
  // patrol line while its cone sweeps past — cover, cone and helipad all visible.
  // (The middle leg routes around crate C1: a straight line into its corner
  // deadlocks the click-to-move steering, so the pilot goes below it first.)
  cover: {
    level: 0,
    legs: [
      { to: { x: 250, y: 120 } },
      { to: { x: 430, y: 240 } },
      { to: { x: 700, y: 262 }, crouch: true },
    ],
    holdSeconds: 1.2,
  },
  // Level 2: the player drops to the bottom corridor (crate C4 blocks the direct
  // line along y=650), slides under it, climbs the left-centre corridor, slips
  // under guard A's patrol line, and ends crouched in guard B's corridor as its
  // cone turns toward them — a near miss with the detection meter climbing.
  patrol: {
    level: 1,
    legs: [
      { to: { x: 80, y: 688 } },
      { to: { x: 420, y: 688 } },
      { to: { x: 300, y: 480 } },
      { to: { x: 700, y: 480 } },
      { to: { x: 860, y: 560 }, crouch: true },
    ],
    holdSeconds: 1.6,
  },
  // Level 1 in a full gust: cones shrink, snow thickens, the player crosses the
  // open middle while the guards are half-blind. The wait spot sits well clear
  // of guard A's patrol line — standing on it got the pilot caught.
  storm: {
    level: 0,
    legs: [
      { to: { x: 250, y: 120 } },
      { to: { x: 640, y: 470 } },
    ],
    waitForStorm: true,
    holdSeconds: 0.6,
  },
  // Level 1 played through: every core collected, then the sprint to the helipad
  // — the frame is the level-clear panel over the finished level.
  escape: {
    level: 0,
    legs: [
      { to: { x: 250, y: 120 } },
      { to: { x: 640, y: 340 } },
      { to: { x: 640, y: 470 } },
      { to: { x: 1150, y: 640 } },
      { to: { x: 1180, y: 130 }, run: true },
    ],
    holdSeconds: 0.4,
  },
};

function makePilotInput() {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
    run: false,
    crouch: false,
    clickTarget: null,
    pressedEnter: false,
    pressedPause: false,
    pressedRestart: false,
    pressedMute: false,
    pressedAny: false,
    moveVector() {
      return { x: 0, y: 0 };
    },
    consumePresses() {},
  };
}

/**
 * Stage the named scene and return { world, screen }: the world after the pilot
 * played it, and which screen the game should draw over it ('play', 'levelClear',
 * 'win' or 'caught'). Any other name stages the cover.
 */
export function stageShot(name) {
  const script = SCRIPTS[name] || SCRIPTS.cover;
  const world = createWorld(script.level);
  const input = makePilotInput();
  let legIndex = 0;
  let holdTimer = 0;
  let steps = 0;
  const maxSteps = Math.floor(MAX_SECONDS / STEP);

  while (steps < maxSteps) {
    steps += 1;
    if (world.status !== 'playing') break;
    if (legIndex < script.legs.length) {
      const leg = script.legs[legIndex];
      input.clickTarget = { x: leg.to.x, y: leg.to.y };
      input.run = !!leg.run;
      input.crouch = !!leg.crouch;
      const arrived = Math.hypot(world.player.x - leg.to.x, world.player.y - leg.to.y) < 10;
      if (arrived) {
        legIndex += 1;
        input.clickTarget = null;
      }
    } else if (script.waitForStorm && stormAmountAt(world.time) < 0.8) {
      input.clickTarget = null;
      input.run = false;
      input.crouch = false;
    } else {
      input.clickTarget = null;
      input.run = false;
      input.crouch = false;
      holdTimer += STEP;
      if (holdTimer >= (script.holdSeconds ?? 1)) break;
    }
    stepWorld(world, input, STEP);
  }

  let screen = 'play';
  if (world.status === 'levelClear') screen = 'levelClear';
  else if (world.status === 'win') screen = 'win';
  else if (world.status === 'caught') screen = 'caught';
  else if (world.status === 'gameOver') screen = 'gameOver';
  return { world, screen, steps };
}

export const SHOT_NAMES = Object.keys(SCRIPTS);
export { LEVELS };
