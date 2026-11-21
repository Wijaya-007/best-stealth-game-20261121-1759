// WHITEOUT — a top-down arctic stealth game (Node 22, standard library only).
// The game is this directory's game/ folder: plain static files a desktop browser
// loads offline (game/index.html and its ES modules, no library, no network
// request), and this program hands it in. It copies game/ and screenshots/ from
// beside this file to /output and writes /output/dossier.json, the summary the
// judge reads, with the vendored make.fun library.
//
// Serve it locally with a static server over game/ (for example `node --run` a
// one-file server, or any static host), then open the index page in a browser.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameDir = join(here, 'game');
const shotsDir = join(here, 'screenshots');

// The scorer's own caps, mirrored here so a bad bundle fails loudly at home
// instead of on the server: at most 4 screenshots, each at most 256 KiB; game/
// at most 993 files and 48 MiB in all, every path at most 1000 bytes; and the
// whole of /output under the platform's 1000-entry, 64 MiB cap, which game/,
// screenshots/ and dossier.json share.
const MAX_SCREENSHOTS = 4;
const MAX_SCREENSHOT_BYTES = 262144;
const MAX_GAME_FILES = 993;
const MAX_GAME_BYTES = 50331648;

function countGameFiles(directory, relative = '') {
  let files = 0;
  let bytes = 0;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      const child = countGameFiles(join(directory, entry.name), childRelative);
      files += child.files;
      bytes += child.bytes;
    } else if (entry.isFile()) {
      files += 1;
      // A directory entry carries no size; stat the file for its byte count.
      bytes += statSync(join(directory, entry.name)).size;
    }
  }
  return { files, bytes };
}

mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(shotsDir)) cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

const gameSize = countGameFiles(gameDir);
if (gameSize.files > MAX_GAME_FILES) {
  throw new Error(`game/ holds ${gameSize.files} files, over the ${MAX_GAME_FILES} cap`);
}
if (gameSize.bytes > MAX_GAME_BYTES) {
  throw new Error(`game/ is ${gameSize.bytes} bytes, over the ${MAX_GAME_BYTES} cap`);
}
const shotNames = existsSync(shotsDir)
  ? readdirSync(shotsDir).filter((name) => !name.startsWith('.'))
  : [];
if (shotNames.length > MAX_SCREENSHOTS) {
  throw new Error(`screenshots/ holds ${shotNames.length} images, over the ${MAX_SCREENSHOTS} cap`);
}
for (const shotName of shotNames) {
  const shotBytes = statSync(join(shotsDir, shotName)).size;
  if (shotBytes > MAX_SCREENSHOT_BYTES) {
    throw new Error(`screenshots/${shotName} is ${shotBytes} bytes, over the ${MAX_SCREENSHOT_BYTES} cap`);
  }
}

writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: MAX_SCREENSHOTS, max_bytes: MAX_SCREENSHOT_BYTES },
    game_max_files: MAX_GAME_FILES,
    game_max_bytes: MAX_GAME_BYTES,
    game_path_max_bytes: 1000,
  }),
);
