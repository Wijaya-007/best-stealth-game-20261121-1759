// WHITEOUT — the entry point: the loop, the screen state machine, and the wiring
// between input, world, render and audio. Screens: title → play ⇄ pause → level
// clear → next level → win / game over, with R to retry and Enter to advance.
// With ?shot=<name> in the URL the game stages that screenshot scene from the
// real rules instead of starting the title screen, draws one frame, and sets
// window.__shotReady so the screenshot tool knows the frame is final.
import { STEP, VIEW } from './config.js';
import { LEVELS } from './levels.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  EVENT_ALERT,
  EVENT_CAUGHT,
  EVENT_LEVEL_CLEAR,
  EVENT_PICKUP,
  EVENT_SPOTTED,
  EVENT_UNLOCKED,
  EVENT_WIN,
  createWorld,
  nearestGuardDistance,
  stepWorld,
  stormAmountAt,
} from './world.js';
import {
  drawBanner,
  drawCaught,
  drawGameOver,
  drawHud,
  drawLevelClear,
  drawPaused,
  drawTitle,
  drawWin,
  drawWorld,
} from './render.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function fitCanvas() {
  const scale = Math.min(window.innerWidth / VIEW.width, window.innerHeight / VIEW.height);
  canvas.width = VIEW.width;
  canvas.height = VIEW.height;
  canvas.style.width = `${Math.floor(VIEW.width * scale)}px`;
  canvas.style.height = `${Math.floor(VIEW.height * scale)}px`;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

const input = createInput(canvas);
const audio = createAudio();
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');

let screen = 'title'; // title | play | pause | levelClear | win | gameOver
let world = createWorld(0);
let stagedShot = null;
let lastFrame = performance.now();
let accumulator = 0;
let lastGuardStep = 0;

function playEvents(events) {
  if (events & EVENT_PICKUP) audio.pickup();
  if (events & EVENT_SPOTTED) audio.spotted();
  if (events & EVENT_ALERT) audio.alert();
  if (events & EVENT_CAUGHT) audio.caught();
  if (events & EVENT_UNLOCKED) audio.exitUnlocked();
  if (events & EVENT_LEVEL_CLEAR) audio.levelClear();
  if (events & EVENT_WIN) audio.gameWin();
}

function advanceLevel() {
  const nextIndex = world.levelIndex + 1;
  world = createWorld(nextIndex, world.carry);
  screen = 'play';
}

function restartRun() {
  world = createWorld(0);
  screen = 'play';
}

function retryLevel() {
  world = createWorld(world.levelIndex, { ...world.carry, lives: 3 });
  screen = 'play';
}

function draw() {
  ctx.clearRect(0, 0, VIEW.width, VIEW.height);
  if (screen === 'title') {
    drawTitle(ctx, performance.now() / 1000);
    return;
  }
  drawWorld(ctx, world);
  drawHud(ctx, world);
  drawBanner(ctx, world);
  if (screen === 'pause') drawPaused(ctx);
  else if (screen === 'levelClear') drawLevelClear(ctx, world);
  else if (screen === 'win') drawWin(ctx, world);
  else if (screen === 'gameOver') drawGameOver(ctx, world);
  else if (world.status === 'caught') drawCaught(ctx, world);
}

function frame(now) {
  const elapsed = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;

  if (input.pressedMute) audio.toggleMute();
  if (input.pressedAny) audio.unlock();

  if (screen === 'title') {
    if (input.pressedEnter || input.pressedAny) {
      screen = 'play';
    }
  } else if (screen === 'play') {
    if (input.pressedPause) {
      screen = 'pause';
    } else {
      accumulator += elapsed;
      while (accumulator >= STEP) {
        accumulator -= STEP;
        const events = stepWorld(world, input, STEP);
        playEvents(events);
        if (world.status === 'levelClear' && world.statusTimer > 0.6) screen = 'levelClear';
        else if (world.status === 'win' && world.statusTimer > 0.6) screen = 'win';
        else if (world.status === 'gameOver' && world.statusTimer > 0.6) screen = 'gameOver';
        else if (world.status === 'caught' && world.statusTimer > 1.4) {
          world.status = 'playing';
          world.statusTimer = 0;
        }
      }
      // Footsteps: the player's crunch, and the nearest guard's tick when close.
      if (world.player.moving) {
        const stride = world.player.running ? 0.32 : 0.48;
        if (world.time - lastGuardStep > stride) {
          lastGuardStep = world.time;
          audio.footstep(world.player.running);
        }
      }
      audio.guardProximity(nearestGuardDistance(world));
      audio.setStorm(stormAmountAt(world.time));
    }
  } else if (screen === 'pause') {
    if (input.pressedPause) screen = 'play';
    else if (input.pressedRestart) retryLevel();
  } else if (screen === 'levelClear') {
    if (input.pressedEnter || input.pressedAny) advanceLevel();
  } else if (screen === 'win' || screen === 'gameOver') {
    if (input.pressedRestart) restartRun();
    else if (input.pressedEnter && screen === 'gameOver') restartRun();
  }

  input.consumePresses();
  draw();
  requestAnimationFrame(frame);
}

if (shotName) {
  // Screenshot mode: stage the scene from the real rules, draw it once, and tell
  // the screenshot tool the frame is final. No audio, no loop, no input.
  stagedShot = stageShot(shotName);
  world = stagedShot.world;
  screen = stagedShot.screen === 'play' ? 'play' : stagedShot.screen;
  draw();
  window.__shotReady = true;
  window.__shotInfo = {
    name: shotName,
    screen: stagedShot.screen,
    steps: stagedShot.steps,
    status: world.status,
    cores: world.coresCollected,
    lives: world.carry.lives,
    time: world.time,
  };
} else {
  requestAnimationFrame(frame);
}
