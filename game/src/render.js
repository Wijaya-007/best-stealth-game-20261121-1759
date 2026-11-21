// WHITEOUT — every pixel the player sees, drawn on one canvas. Bright snow so the
// game reads at a glance against the dark night scenes other entries will show:
// white-blue floor, ice-blue walls, orange player, red guards, yellow vision cones,
// a green helipad. The draw order matters: cones go down before walls and crates,
// so solid cover visually cuts a cone exactly where it blocks sight.
import { GUARD, HUD_HEIGHT, PALETTE, PLAYER, STORM, VIEW, GAME } from './config.js';
import { LEVELS } from './levels.js';
import { coneFill, nearestGuardDistance, secondsToStorm, snowflakes, stormAmountAt } from './world.js';
import { makeSeededRandom } from './random.js';

const TAU = Math.PI * 2;

function roundRect(ctx, x, y, w, h, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawSparkles(ctx, level) {
  const random = makeSeededRandom(level.seed * 331 + 7);
  ctx.fillStyle = PALETTE.snowSparkle;
  for (let i = 0; i < 260; i += 1) {
    const x = random() * VIEW.width;
    const y = HUD_HEIGHT + random() * (VIEW.height - HUD_HEIGHT);
    const size = random() < 0.85 ? 1.5 : 2.5;
    ctx.globalAlpha = 0.5 + random() * 0.5;
    ctx.fillRect(x, y, size, size);
  }
  ctx.globalAlpha = 1;
}

function drawHelipad(ctx, level, unlocked, time) {
  const pad = level.helipad;
  ctx.save();
  ctx.beginPath();
  ctx.arc(pad.x, pad.y, pad.r, 0, TAU);
  ctx.fillStyle = unlocked ? PALETTE.helipad : '#7fae9c';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = PALETTE.helipadRing;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(pad.x, pad.y, pad.r - 12, 0, TAU);
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.7;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('H', pad.x, pad.y + 1);
  if (unlocked) {
    // A slow pulse so the open exit is easy to find.
    const pulse = 0.25 + 0.15 * Math.sin(time * 3);
    ctx.beginPath();
    ctx.arc(pad.x, pad.y, pad.r + 6 + 4 * Math.sin(time * 3), 0, TAU);
    ctx.strokeStyle = `rgba(63, 174, 122, ${pulse})`;
    ctx.lineWidth = 5;
    ctx.stroke();
  }
  ctx.restore();
}

function drawCore(ctx, core, time) {
  const bob = Math.sin(time * 2.4 + core.x * 0.01) * 3;
  ctx.save();
  ctx.translate(core.x, core.y + bob);
  ctx.beginPath();
  ctx.arc(0, 0, 20, 0, TAU);
  ctx.fillStyle = PALETTE.coreGlow;
  ctx.fill();
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = PALETTE.core;
  ctx.fillRect(-9, -9, 18, 18);
  ctx.strokeStyle = '#0e7d8a';
  ctx.lineWidth = 2;
  ctx.strokeRect(-9, -9, 18, 18);
  ctx.restore();
}

function drawDrift(ctx, drift) {
  ctx.save();
  roundRect(ctx, drift.x, drift.y, drift.w, drift.h, 18);
  ctx.fillStyle = PALETTE.drift;
  ctx.fill();
  ctx.strokeStyle = PALETTE.driftEdge;
  ctx.lineWidth = 2;
  ctx.stroke();
  // Soft bumps along the top edge so it reads as a snow bank, not a box.
  ctx.fillStyle = '#ffffff';
  for (let x = drift.x + 14; x < drift.x + drift.w - 10; x += 34) {
    ctx.beginPath();
    ctx.arc(x, drift.y + 8, 9, Math.PI, 0);
    ctx.fill();
  }
  ctx.restore();
}

function drawWall(ctx, wall) {
  ctx.save();
  ctx.fillStyle = PALETTE.wallTop;
  ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
  ctx.fillStyle = PALETTE.wall;
  ctx.fillRect(wall.x, wall.y + Math.min(6, wall.h - 6), wall.w, wall.h - Math.min(6, wall.h - 6));
  ctx.strokeStyle = PALETTE.wallEdge;
  ctx.lineWidth = 2;
  ctx.strokeRect(wall.x + 1, wall.y + 1, wall.w - 2, wall.h - 2);
  ctx.restore();
}

function drawCrate(ctx, crate) {
  ctx.save();
  ctx.fillStyle = PALETTE.crateTop;
  ctx.fillRect(crate.x, crate.y, crate.w, crate.h);
  ctx.fillStyle = PALETTE.crate;
  ctx.fillRect(crate.x, crate.y + 8, crate.w, crate.h - 8);
  ctx.strokeStyle = PALETTE.crateEdge;
  ctx.lineWidth = 2;
  ctx.strokeRect(crate.x + 1, crate.y + 1, crate.w - 2, crate.h - 2);
  ctx.beginPath();
  ctx.moveTo(crate.x, crate.y);
  ctx.lineTo(crate.x + crate.w, crate.y + crate.h);
  ctx.moveTo(crate.x + crate.w, crate.y);
  ctx.lineTo(crate.x, crate.y + crate.h);
  ctx.stroke();
  ctx.restore();
}

function drawVisionCone(ctx, guard, storm) {
  const range = GUARD.visionRange * (1 - storm * (1 - GUARD.stormVisionFactor));
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(guard.x, guard.y);
  ctx.arc(guard.x, guard.y, range, guard.angle - GUARD.visionHalfAngle, guard.angle + GUARD.visionHalfAngle);
  ctx.closePath();
  ctx.fillStyle = coneFill(guard, storm);
  ctx.fill();
  ctx.strokeStyle = guard.state === 'chase' ? 'rgba(255, 64, 64, 0.7)' : 'rgba(214, 164, 0, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

function drawGuard(ctx, guard, time) {
  ctx.save();
  ctx.translate(guard.x, guard.y);
  if (guard.state === 'chase') {
    ctx.beginPath();
    ctx.arc(0, 0, GUARD.radius + 5 + 2 * Math.sin(time * 8), 0, TAU);
    ctx.strokeStyle = 'rgba(255, 64, 64, 0.8)';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, GUARD.radius, 0, TAU);
  ctx.fillStyle = PALETTE.guard;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = PALETTE.guardEdge;
  ctx.stroke();
  // Helmet brim toward the facing direction.
  ctx.rotate(guard.angle);
  ctx.beginPath();
  ctx.arc(4, 0, 7, 0, TAU);
  ctx.fillStyle = '#e8b4ac';
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(8, -4, 2, 0, TAU);
  ctx.arc(8, 4, 2, 0, TAU);
  ctx.fill();
  ctx.restore();
  if (guard.detection >= 60) {
    ctx.save();
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = guard.state === 'chase' ? '#ff2e2e' : '#d6a400';
    ctx.fillText('!', guard.x, guard.y - GUARD.radius - 6);
    ctx.restore();
  }
}

function drawPlayer(ctx, player, time) {
  ctx.save();
  ctx.translate(player.x, player.y);
  if (player.running) {
    // Motion streaks behind a running player.
    ctx.strokeStyle = 'rgba(255, 122, 26, 0.5)';
    ctx.lineWidth = 3;
    const backX = -Math.cos(player.angle);
    const backY = -Math.sin(player.angle);
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(backX * (18 + i * 6), backY * (18 + i * 6) - 4 + i * 4);
      ctx.lineTo(backX * (26 + i * 6), backY * (26 + i * 6) - 4 + i * 4);
      ctx.stroke();
    }
  }
  const radius = player.crouching ? PLAYER.radius - 3 : PLAYER.radius;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, TAU);
  ctx.fillStyle = PALETTE.player;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = PALETTE.playerEdge;
  ctx.stroke();
  ctx.rotate(player.angle);
  ctx.beginPath();
  ctx.arc(5, 0, 6, 0, TAU);
  ctx.fillStyle = '#ffd9b3';
  ctx.fill();
  ctx.restore();
  if (player.crouching) {
    ctx.save();
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#5d8fc0';
    ctx.fillText('MERUNDUK', player.x, player.y + PLAYER.radius + 14);
    ctx.restore();
  }
}

function drawFootprints(ctx, footprints) {
  ctx.save();
  for (const print of footprints) {
    const alpha = 0.35 * (1 - print.age / 6);
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.fillStyle = PALETTE.footprint;
    ctx.save();
    ctx.translate(print.x, print.y);
    ctx.rotate(print.angle);
    ctx.beginPath();
    ctx.ellipse(-4, -4, 4, 2.4, 0, 0, TAU);
    ctx.ellipse(4, 4, 4, 2.4, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawNoiseRing(ctx, pulse) {
  if (!pulse) return;
  const progress = pulse.age / 0.9;
  ctx.save();
  ctx.beginPath();
  ctx.arc(pulse.x, pulse.y, 10 + progress * pulse.radius, 0, TAU);
  ctx.strokeStyle = PALETTE.noiseRing;
  ctx.globalAlpha = 1 - progress;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

/** The playfield: floor, cover, exit, actors, weather. No HUD here. */
export function drawWorld(ctx, state) {
  const { level } = state;
  const time = state.time;
  const storm = stormAmountAt(time);
  ctx.fillStyle = PALETTE.snow;
  ctx.fillRect(0, HUD_HEIGHT, VIEW.width, VIEW.height - HUD_HEIGHT);
  // Shaded bands so the big white floor still reads as terrain.
  ctx.fillStyle = PALETTE.snowShade;
  for (let x = 0; x < VIEW.width; x += 160) {
    ctx.globalAlpha = 0.25;
    ctx.fillRect(x, HUD_HEIGHT, 80, VIEW.height - HUD_HEIGHT);
  }
  ctx.globalAlpha = 1;
  drawSparkles(ctx, level);
  drawHelipad(ctx, level, state.exitUnlocked, time);
  for (const core of state.cores) {
    if (!core.taken) drawCore(ctx, core, time);
  }
  for (const drift of level.drifts) drawDrift(ctx, drift);
  drawFootprints(ctx, state.footprints);
  drawNoiseRing(ctx, state.noisePulse);
  for (const guard of state.guards) drawVisionCone(ctx, guard, storm);
  for (const wall of level.walls) drawWall(ctx, wall);
  for (const crate of level.crates) drawCrate(ctx, crate);
  for (const guard of state.guards) drawGuard(ctx, guard, time);
  drawPlayer(ctx, state.player, time);
  // Falling snow, heavier and bigger in a storm.
  const flakes = snowflakes(level, time, storm);
  ctx.save();
  ctx.fillStyle = '#ffffff';
  for (const flake of flakes) {
    ctx.globalAlpha = flake.alpha;
    const size = flake.size * (1 + storm * 1.2);
    ctx.fillRect(flake.x, flake.y, size, size);
  }
  ctx.restore();
  if (storm > 0) {
    ctx.fillStyle = PALETTE.stormVeil;
    ctx.globalAlpha = storm * 1.4;
    ctx.fillRect(0, HUD_HEIGHT, VIEW.width, VIEW.height - HUD_HEIGHT);
    ctx.globalAlpha = 1;
  }
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export function drawHud(ctx, state) {
  const maxDetection = Math.max(0, ...state.guards.map((guard) => guard.detection));
  const storm = stormAmountAt(state.time);
  const toStorm = secondsToStorm(state.time);
  ctx.save();
  ctx.fillStyle = PALETTE.hudBack;
  ctx.fillRect(0, 0, VIEW.width, HUD_HEIGHT);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  // Left block: level title over its subtitle.
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 19px system-ui, sans-serif';
  ctx.fillText(`WHITEOUT · ${state.level.name}`, 16, 17);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = '#a9c6e4';
  ctx.fillText(state.level.subtitle, 16, 40);
  // Cores block: label over the diamonds, short status beside them.
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.hudText;
  ctx.fillText('INTI DATA', 520, 17);
  for (let i = 0; i < state.level.cores.length; i += 1) {
    ctx.save();
    ctx.translate(528 + i * 26, 40);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = i < state.coresCollected ? PALETTE.core : 'rgba(255,255,255,0.25)';
    ctx.fillRect(-7, -7, 14, 14);
    ctx.restore();
  }
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = state.exitUnlocked ? '#7be3a8' : '#a9c6e4';
  ctx.fillText(state.exitUnlocked ? 'HELIPAD TERBUKA' : `${state.coresCollected}/${state.level.cores.length} terkumpul`, 620, 40);
  // Lives block: label over the dots, clock beside them.
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.hudText;
  ctx.fillText('NYAWA', 800, 17);
  for (let i = 0; i < GAME.lives; i += 1) {
    ctx.beginPath();
    ctx.arc(808 + i * 24, 40, 7, 0, TAU);
    ctx.fillStyle = i < state.carry.lives ? '#ff5a5a' : 'rgba(255,255,255,0.2)';
    ctx.fill();
  }
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = '#a9c6e4';
  ctx.fillText(`Waktu ${formatTime(state.carry.totalTime)}`, 890, 40);
  // Detection block: label over the meter bar, storm note right of the bar.
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillStyle = maxDetection >= 100 ? PALETTE.hudDanger : maxDetection >= 60 ? PALETTE.hudWarn : PALETTE.hudText;
  ctx.fillText('TERLIHAT', 1000, 17);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(1000, 35, 130, 10);
  ctx.fillStyle = maxDetection >= 100 ? PALETTE.hudDanger : maxDetection >= 60 ? PALETTE.hudWarn : '#ffd640';
  ctx.fillRect(1000, 35, 130 * (maxDetection / 100), 10);
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = storm > 0.3 ? '#bfe6ff' : toStorm <= STORM.warnBefore ? PALETTE.hudWarn : '#a9c6e4';
  ctx.fillText(
    storm > 0.3 ? 'BADAI!' : toStorm <= STORM.warnBefore ? 'Badai…' : `Badai ${Math.ceil(toStorm)} dtk`,
    1140,
    40,
  );
  // Controls reminder along the bottom edge, on a pill so it reads over the wall.
  const hint = 'WASD / panah gerak · Shift lari (berisik!) · C merunduk · Klik = jalan ke titik · P jeda · M suara';
  ctx.font = '12px system-ui, sans-serif';
  const hintWidth = ctx.measureText(hint).width;
  ctx.fillStyle = 'rgba(13, 32, 56, 0.55)';
  roundRect(ctx, VIEW.width / 2 - hintWidth / 2 - 10, VIEW.height - 22, hintWidth + 20, 18, 9);
  ctx.fill();
  ctx.fillStyle = '#dbe9f8';
  ctx.textAlign = 'center';
  ctx.fillText(hint, VIEW.width / 2, VIEW.height - 13);
  ctx.restore();
}

function drawOverlayPanel(ctx, title, lines, accent) {
  ctx.save();
  ctx.fillStyle = 'rgba(13, 32, 56, 0.82)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent;
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText(title, VIEW.width / 2, 250);
  ctx.fillStyle = '#eaf3ff';
  ctx.font = '20px system-ui, sans-serif';
  lines.forEach((line, index) => {
    ctx.fillText(line, VIEW.width / 2, 320 + index * 34);
  });
  ctx.restore();
}

export function drawTitle(ctx, time) {
  ctx.save();
  ctx.fillStyle = PALETTE.titleBack;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  // Drifting snow behind the title.
  ctx.fillStyle = '#ffffff';
  const random = makeSeededRandom(99);
  for (let i = 0; i < 120; i += 1) {
    const x = (random() * VIEW.width + time * 12 * (0.5 + random())) % VIEW.width;
    const y = (random() * VIEW.height + time * 20) % VIEW.height;
    ctx.globalAlpha = 0.25 + random() * 0.5;
    ctx.fillRect(x, y, 2.5, 2.5);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 96px system-ui, sans-serif';
  ctx.fillText('WHITEOUT', VIEW.width / 2, 210);
  ctx.fillStyle = '#9fd8ff';
  ctx.font = '24px system-ui, sans-serif';
  ctx.fillText('Stealth di stasiun riset Arktik — capai helipad tanpa terlihat', VIEW.width / 2, 262);
  ctx.fillStyle = '#eaf3ff';
  ctx.font = '18px system-ui, sans-serif';
  const instructions = [
    'Kumpulkan semua inti data, lalu kabur lewat helipad.',
    'Hindari kerucut pandang penjaga — dinding, peti dan tumpukan salju menutupi pandangan mereka.',
    'Lari itu berisik: penjaga mendengar langkahmu. Merunduk lebih lambat tapi lebih sulit terlihat.',
    'Saat badai salju datang, pandangan penjaga memendek — saat itulah bergerak.',
    '',
    'WASD / panah bergerak · Shift lari · C merunduk · Klik = jalan ke titik · P jeda · M suara',
  ];
  instructions.forEach((line, index) => {
    ctx.fillText(line, VIEW.width / 2, 330 + index * 30);
  });
  ctx.fillStyle = Math.floor(time * 1.6) % 2 === 0 ? '#ffd640' : '#eaf3ff';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText('Tekan Enter atau klik untuk mulai', VIEW.width / 2, 560);
  ctx.fillStyle = '#7fa8cc';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('Game stealth orisinal — semua gambar digambar dari kode, semua suara disintesis.', VIEW.width / 2, 620);
  ctx.restore();
}

export function drawPaused(ctx) {
  drawOverlayPanel(ctx, 'JEDA', ['Tekan P atau Esc untuk lanjut', 'R untuk mulai level dari awal'], '#ffd640');
}

export function drawCaught(ctx, state) {
  ctx.save();
  ctx.fillStyle = 'rgba(120, 10, 10, 0.55)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 56px system-ui, sans-serif';
  ctx.fillText('TERTANGKAP!', VIEW.width / 2, 300);
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText(`Nyawa tersisa: ${state.carry.lives}`, VIEW.width / 2, 350);
  ctx.restore();
}

export function drawLevelClear(ctx, state) {
  drawOverlayPanel(
    ctx,
    `${state.level.name} SELESAI`,
    [`Inti data: ${state.coresCollected}/${state.level.cores.length} · Alarm: ${state.carry.alerts}`, 'Tekan Enter untuk lanjut ke level berikutnya'],
    '#7be3a8',
  );
}

export function drawGameOver(ctx, state) {
  drawOverlayPanel(
    ctx,
    'MISIMU GAGAL',
    [`Kamu tertangkap di ${state.level.name}.`, `Waktu: ${formatTime(state.carry.totalTime)} · Inti data: ${state.coresCollected}`, 'Tekan R untuk mencoba lagi'],
    '#ff5a5a',
  );
}

export function drawWin(ctx, state) {
  drawOverlayPanel(
    ctx,
    'KABUR!',
    [
      'Kamu lolos dari stasiun riset tanpa jejak.',
      `Waktu total: ${formatTime(state.carry.totalTime)} · Alarm yang berbunyi: ${state.carry.alerts}`,
      `Penjaga terdekat sempat ${Math.round(nearestGuardDistance(state))} px darimu di akhir.`,
      'Tekan R untuk bermain lagi',
    ],
    '#7be3a8',
  );
}

export function drawBanner(ctx, state) {
  if (!state.banner) return;
  const banner = state.banner;
  const fade = banner.age > banner.duration - 0.5 ? (banner.duration - banner.age) / 0.5 : 1;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, fade));
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(13, 32, 56, 0.85)';
  const width = 620;
  roundRect(ctx, VIEW.width / 2 - width / 2, 84, width, 64, 12);
  ctx.fill();
  ctx.fillStyle = '#ffd640';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText(banner.text, VIEW.width / 2, 110);
  ctx.fillStyle = '#eaf3ff';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText(banner.sub, VIEW.width / 2, 134);
  ctx.restore();
}
