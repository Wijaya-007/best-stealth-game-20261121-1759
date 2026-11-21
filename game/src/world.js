// WHITEOUT — the simulation: one fixed step of the world. Player movement with
// circle-vs-rectangle collision, guard patrols with vision cones and line of sight,
// a detection meter that gives the player time to recover, running noise that guards
// hear, snowstorm gusts that shrink every cone, footprints in the snow, data cores
// and the helipad exit. No Math.random anywhere: flakes and gusts are pure functions
// of the level seed and the clock, so a staged screenshot is reproducible.
import { GUARD, HUD_HEIGHT, PALETTE, PLAYER, STORM, VIEW, GAME } from './config.js';
import { LEVELS, sightBlockers, solidBlockers } from './levels.js';
import { makeSeededRandom } from './random.js';

export const EVENT_NONE = 0;
export const EVENT_PICKUP = 1;
export const EVENT_ALERT = 2;
export const EVENT_CAUGHT = 4;
export const EVENT_LEVEL_CLEAR = 8;
export const EVENT_WIN = 16;
export const EVENT_UNLOCKED = 32;
export const EVENT_SPOTTED = 64;

const TAU = Math.PI * 2;
const FLAKE_COUNT = 90;

/** The smallest angle between two headings, in (-PI, PI]. */
export function angleDifference(a, b) {
  let diff = (a - b) % TAU;
  if (diff > Math.PI) diff -= TAU;
  if (diff <= -Math.PI) diff += TAU;
  return diff;
}

/** Turn `from` toward `to` by at most `maxStep` radians. */
function turnToward(from, to, maxStep) {
  const diff = angleDifference(to, from);
  if (Math.abs(diff) <= maxStep) return to;
  return from + Math.sign(diff) * maxStep;
}

function circleHitsRect(x, y, radius, rect) {
  const nearestX = Math.max(rect.x, Math.min(x, rect.x + rect.w));
  const nearestY = Math.max(rect.y, Math.min(y, rect.y + rect.h));
  const dx = x - nearestX;
  const dy = y - nearestY;
  return dx * dx + dy * dy < radius * radius;
}

function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

/** True when the segment from (x1,y1) to (x2,y2) crosses rect (slab test). */
function segmentHitsRect(x1, y1, x2, y2, rect) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tMin = 0;
  let tMax = 1;
  const axes = [
    { d: dx, low: rect.x - x1, high: rect.x + rect.w - x1 },
    { d: dy, low: rect.y - y1, high: rect.y + rect.h - y1 },
  ];
  for (const axis of axes) {
    if (Math.abs(axis.d) < 1e-9) {
      if (axis.low > 0 || axis.high < 0) return false;
    } else {
      let t1 = axis.low / axis.d;
      let t2 = axis.high / axis.d;
      if (t1 > t2) {
        const held = t1;
        t1 = t2;
        t2 = held;
      }
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) return false;
    }
  }
  return true;
}

/** True when no sight blocker stands between the guard and the player. */
export function hasLineOfSight(level, fromX, fromY, toX, toY) {
  const blockers = sightBlockers(level);
  for (let i = 0; i < blockers.length; i += 1) {
    if (segmentHitsRect(fromX, fromY, toX, toY, blockers[i])) return false;
  }
  return true;
}

/** Move a circle against the solid rects, axis by axis so it slides along walls. */
function moveCircle(level, entity, dx, dy, radius) {
  const solids = solidBlockers(level);
  let nextX = entity.x + dx;
  let blocked = false;
  for (let i = 0; i < solids.length; i += 1) {
    if (circleHitsRect(nextX, entity.y, radius, solids[i])) {
      blocked = true;
      break;
    }
  }
  if (!blocked && nextX - radius >= 0 && nextX + radius <= VIEW.width) entity.x = nextX;
  let nextY = entity.y + dy;
  blocked = false;
  for (let i = 0; i < solids.length; i += 1) {
    if (circleHitsRect(entity.x, nextY, radius, solids[i])) {
      blocked = true;
      break;
    }
  }
  if (!blocked && nextY - radius >= HUD_HEIGHT && nextY + radius <= VIEW.height) entity.y = nextY;
}

/** How much of the gust is blowing right now: 0 calm, 1 full storm, eased at the edges. */
export function stormAmountAt(time) {
  if (time < STORM.firstAt) return 0;
  const phase = (time - STORM.firstAt) % STORM.period;
  if (phase >= STORM.duration) return 0;
  const ramp = 0.8;
  if (phase < ramp) return phase / ramp;
  if (phase > STORM.duration - ramp) return (STORM.duration - phase) / ramp;
  return 1;
}

/** Seconds until the next gust starts (0 while one is blowing). */
export function secondsToStorm(time) {
  if (time < STORM.firstAt) return STORM.firstAt - time;
  const phase = (time - STORM.firstAt) % STORM.period;
  if (phase < STORM.duration) return 0;
  return STORM.period - phase;
}

/** Snowflake positions are a pure function of seed and time: deterministic. */
export function snowflakes(level, time, stormAmount) {
  const random = makeSeededRandom(level.seed * 7919 + 5);
  const flakes = [];
  const speed = 26 + stormAmount * 90;
  for (let i = 0; i < FLAKE_COUNT; i += 1) {
    const x0 = random() * VIEW.width;
    const y0 = random() * VIEW.height;
    const size = 1 + random() * 2.4;
    const drift = (random() - 0.5) * 30;
    const fall = (y0 + time * speed * (0.6 + random() * 0.8)) % VIEW.height;
    const sway = Math.sin(time * 0.9 + i) * 6;
    flakes.push({
      x: (x0 + drift * time * 0.2 + sway + stormAmount * time * 60) % VIEW.width,
      y: fall,
      size,
      alpha: 0.35 + stormAmount * 0.45,
    });
  }
  return flakes;
}

export function createWorld(levelIndex, carry = {}) {
  const level = LEVELS[levelIndex];
  const guards = level.guards.map((definition) => ({
    x: definition.waypoints[0].x,
    y: definition.waypoints[0].y,
    angle: 0,
    state: 'patrol',
    waypointIndex: 1 % definition.waypoints.length,
    pauseTimer: 0,
    scanTimer: 0,
    detection: 0,
    lastSeen: null,
    investigateTarget: null,
    chaseTimer: 0,
    stepAccumulator: 0,
    definition,
  }));
  return {
    level,
    levelIndex,
    carry: {
      lives: carry.lives ?? GAME.lives,
      totalTime: carry.totalTime ?? 0,
      alerts: carry.alerts ?? 0,
    },
    player: {
      x: level.playerStart.x,
      y: level.playerStart.y,
      angle: -Math.PI / 2,
      moving: false,
      running: false,
      crouching: false,
      strideAccumulator: 0,
      inDrift: false,
    },
    guards,
    cores: level.cores.map((core) => ({ x: core.x, y: core.y, taken: false })),
    coresCollected: 0,
    exitUnlocked: false,
    footprints: [],
    noisePulse: null, // { x, y, radius, age } while a running noise ring expands
    noiseTimer: 0,
    time: 0,
    status: 'playing', // playing | caught | levelClear | win | gameOver
    statusTimer: 0,
    banner: null, // { text, sub, age, duration } shown over the playfield
  };
}

function resetAfterCaught(state) {
  const level = state.level;
  state.player.x = level.playerStart.x;
  state.player.y = level.playerStart.y;
  state.player.angle = -Math.PI / 2;
  state.footprints = [];
  state.noisePulse = null;
  for (const guard of state.guards) {
    guard.x = guard.definition.waypoints[0].x;
    guard.y = guard.definition.waypoints[0].y;
    guard.state = 'patrol';
    guard.waypointIndex = 1 % guard.definition.waypoints.length;
    guard.pauseTimer = 0;
    guard.detection = 0;
    guard.lastSeen = null;
    guard.investigateTarget = null;
    guard.chaseTimer = 0;
  }
}

function showBanner(state, text, sub, duration = 2.2) {
  state.banner = { text, sub, age: 0, duration };
}

/**
 * One fixed step. `input` is the keyboard/mouse state; `events` collects what the
 * caller should announce with sound. Returns the event bitmask for this step.
 */
export function stepWorld(state, input, dt) {
  let events = EVENT_NONE;
  state.time += dt;
  state.carry.totalTime += dt;
  if (state.banner) {
    state.banner.age += dt;
    if (state.banner.age >= state.banner.duration) state.banner = null;
  }
  if (state.noisePulse) {
    state.noisePulse.age += dt;
    if (state.noisePulse.age > 0.9) state.noisePulse = null;
  }
  for (let i = state.footprints.length - 1; i >= 0; i -= 1) {
    state.footprints[i].age += dt;
    if (state.footprints[i].age > 6) state.footprints.splice(i, 1);
  }

  // A caught / cleared / won world freezes for a beat, then the caller advances.
  if (state.status !== 'playing') {
    state.statusTimer += dt;
    return events;
  }

  const storm = stormAmountAt(state.time);
  const player = state.player;

  // --- Player movement -----------------------------------------------------
  let move = input.moveVector();
  if (move.x === 0 && move.y === 0 && input.clickTarget) {
    const dx = input.clickTarget.x - player.x;
    const dy = input.clickTarget.y - player.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 8) {
      input.clickTarget = null;
    } else {
      move = { x: dx / distance, y: dy / distance };
    }
  }
  player.inDrift = state.level.drifts.some((drift) => pointInRect(player.x, player.y, drift));
  let speed = PLAYER.walkSpeed;
  player.running = false;
  player.crouching = false;
  if (move.x !== 0 || move.y !== 0) {
    if (input.crouch) {
      speed = PLAYER.crouchSpeed;
      player.crouching = true;
    } else if (input.run) {
      speed = PLAYER.runSpeed;
      player.running = true;
    }
    if (player.inDrift) speed *= 0.6;
    const beforeX = player.x;
    const beforeY = player.y;
    moveCircle(state.level, player, move.x * speed * dt, move.y * speed * dt, PLAYER.radius);
    const travelled = Math.hypot(player.x - beforeX, player.y - beforeY);
    player.moving = travelled > 0.01;
    if (player.moving) {
      player.angle = Math.atan2(move.y, move.x);
      player.strideAccumulator += travelled;
      if (player.strideAccumulator >= PLAYER.stride) {
        player.strideAccumulator = 0;
        state.footprints.push({
          x: player.x,
          y: player.y,
          angle: player.angle,
          age: 0,
        });
      }
      // Running is loud: a noise ring every half second that guards can hear.
      if (player.running) {
        state.noiseTimer += dt;
        if (state.noiseTimer >= 0.5) {
          state.noiseTimer = 0;
          state.noisePulse = { x: player.x, y: player.y, radius: GUARD.hearRadius, age: 0 };
          for (const guard of state.guards) {
            if (guard.state === 'patrol' || guard.state === 'return') {
              const distance = Math.hypot(guard.x - player.x, guard.y - player.y);
              if (distance <= GUARD.hearRadius) {
                guard.state = 'investigate';
                guard.investigateTarget = { x: player.x, y: player.y };
                guard.detection = Math.max(guard.detection, 35);
              }
            }
          }
        }
      }
    } else {
      player.moving = false;
    }
  } else {
    player.moving = false;
    state.noiseTimer = 0;
  }

  // --- Data cores -----------------------------------------------------------
  for (const core of state.cores) {
    if (!core.taken && Math.hypot(player.x - core.x, player.y - core.y) < 26) {
      core.taken = true;
      state.coresCollected += 1;
      events |= EVENT_PICKUP;
      if (state.coresCollected === state.level.cores.length) {
        state.exitUnlocked = true;
        events |= EVENT_UNLOCKED;
        showBanner(state, 'HELIPAD TERBUKA', 'Semua inti data terkumpul — capai helipad tanpa terlihat');
      }
    }
  }

  // --- Guards: sight, detection, states -------------------------------------
  const visionRange = GUARD.visionRange * (1 - storm * (1 - GUARD.stormVisionFactor));
  for (const guard of state.guards) {
    const dx = player.x - guard.x;
    const dy = player.y - guard.y;
    const distance = Math.hypot(dx, dy);
    const angleToPlayer = Math.atan2(dy, dx);
    const inCone = distance <= visionRange && Math.abs(angleDifference(angleToPlayer, guard.angle)) <= GUARD.visionHalfAngle;
    const seen = inCone && hasLineOfSight(state.level, guard.x, guard.y, player.x, player.y);
    const wasSpotted = guard.detection >= 60;

    if (seen) {
      let rate = GUARD.detectRate * (1 - (distance / visionRange) * 0.5);
      if (player.running) rate *= GUARD.detectRunFactor;
      if (player.crouching) rate *= GUARD.detectCrouchFactor;
      rate *= 1 - storm * (1 - GUARD.stormDetectFactor);
      guard.detection = Math.min(100, guard.detection + rate * dt);
      guard.lastSeen = { x: player.x, y: player.y };
      if (guard.detection >= 100 && guard.state !== 'chase') {
        guard.state = 'chase';
        guard.chaseTimer = 0;
        state.carry.alerts += 1;
        events |= EVENT_ALERT;
        showBanner(state, 'TERLIHAT!', 'Penjaga mengejarmu — sembunyi sampai dia kehilangan jejak');
      } else if (!wasSpotted && guard.detection >= 60) {
        events |= EVENT_SPOTTED;
      }
    } else {
      guard.detection = Math.max(0, guard.detection - GUARD.detectDecay * dt);
    }

    // State machine.
    if (guard.state === 'chase') {
      if (seen) guard.chaseTimer = 0;
      else guard.chaseTimer += dt;
      const target = seen ? { x: player.x, y: player.y } : guard.lastSeen;
      if (guard.chaseTimer >= GUARD.chaseMemory) {
        guard.state = 'return';
        guard.detection = Math.min(guard.detection, 50);
      } else if (target) {
        moveGuardToward(state, guard, target, GUARD.chaseSpeed, dt);
      }
    } else if (guard.state === 'investigate' && guard.investigateTarget) {
      const target = guard.investigateTarget;
      const arrived = moveGuardToward(state, guard, target, GUARD.investigateSpeed, dt);
      if (arrived) {
        guard.scanTimer += dt;
        guard.angle += dt * 1.4; // look around before giving up
        if (guard.scanTimer >= 1.6) {
          guard.scanTimer = 0;
          guard.state = 'return';
        }
      }
    } else if (guard.state === 'return') {
      const waypoints = guard.definition.waypoints;
      let nearest = 0;
      let nearestDistance = Infinity;
      for (let i = 0; i < waypoints.length; i += 1) {
        const d = Math.hypot(waypoints[i].x - guard.x, waypoints[i].y - guard.y);
        if (d < nearestDistance) {
          nearestDistance = d;
          nearest = i;
        }
      }
      const arrived = moveGuardToward(state, guard, waypoints[nearest], GUARD.patrolSpeed, dt);
      if (arrived) {
        guard.waypointIndex = (nearest + 1) % waypoints.length;
        guard.state = 'patrol';
      }
    } else {
      // patrol
      const waypoints = guard.definition.waypoints;
      const target = waypoints[guard.waypointIndex];
      if (guard.pauseTimer > 0) {
        guard.pauseTimer -= dt;
        guard.angle += Math.sin(state.time * 0.9 + guard.x) * dt * 0.5; // idle scan
      } else {
        const arrived = moveGuardToward(state, guard, target, GUARD.patrolSpeed, dt);
        if (arrived) {
          guard.pauseTimer = guard.definition.pause;
          guard.waypointIndex = (guard.waypointIndex + 1) % waypoints.length;
        }
      }
    }

    // Footstep ticks for the audio layer: the caller reads stepAccumulator.
    if (guard.state === 'chase' || guard.state === 'investigate') {
      guard.stepAccumulator += GUARD.chaseSpeed * dt;
    } else {
      guard.stepAccumulator += GUARD.patrolSpeed * dt;
    }

    // Caught?
    if (Math.hypot(player.x - guard.x, player.y - guard.y) < GUARD.catchDistance) {
      state.carry.lives -= 1;
      events |= EVENT_CAUGHT;
      if (state.carry.lives <= 0) {
        state.status = 'gameOver';
        state.statusTimer = 0;
      } else {
        state.status = 'caught';
        state.statusTimer = 0;
        resetAfterCaught(state);
        showBanner(state, 'TERTANGKAP!', `Nyawa tersisa: ${state.carry.lives} — kembali ke titik awal`);
      }
      break;
    }
  }

  // --- Helipad exit -----------------------------------------------------------
  if (state.exitUnlocked) {
    const helipad = state.level.helipad;
    if (Math.hypot(player.x - helipad.x, player.y - helipad.y) < helipad.r - 6) {
      if (state.levelIndex >= LEVELS.length - 1) {
        state.status = 'win';
        state.statusTimer = 0;
        events |= EVENT_WIN;
      } else {
        state.status = 'levelClear';
        state.statusTimer = 0;
        events |= EVENT_LEVEL_CLEAR;
      }
    }
  }

  return events;
}

/** Walk a guard toward a point; returns true when it arrives (within 6 px). */
function moveGuardToward(state, guard, target, speed, dt) {
  const dx = target.x - guard.x;
  const dy = target.y - guard.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 6) return true;
  const step = Math.min(distance, speed * dt);
  const wantedAngle = Math.atan2(dy, dx);
  guard.angle = turnToward(guard.angle, wantedAngle, dt * 6);
  moveCircle(state.level, guard, (dx / distance) * step, (dy / distance) * step, GUARD.radius);
  return Math.hypot(target.x - guard.x, target.y - guard.y) < 6;
}

/** Distance from the player to the nearest guard (for the proximity footsteps). */
export function nearestGuardDistance(state) {
  let nearest = Infinity;
  for (const guard of state.guards) {
    nearest = Math.min(nearest, Math.hypot(guard.x - state.player.x, guard.y - state.player.y));
  }
  return nearest;
}

/** Colour of a guard's vision cone, by alert state and storm. */
export function coneFill(guard, storm) {
  if (guard.state === 'chase') return PALETTE.coneAlert;
  if (storm > 0.5) return PALETTE.coneStorm;
  return PALETTE.cone;
}
