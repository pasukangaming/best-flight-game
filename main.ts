// Solara Skies — the entrypoint (Node 22, standard library only).
//
// The grader runs this program in a fresh container with no network:
// it copies the game and its screenshots into the output directory and
// writes the dossier the judge reads, using the vendored make.fun
// library. Outside the grader, MAKEFUN_OUTPUT_DIR stands in for
// /output, so a local check is:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The dossier caps mirror the gate's own: at most 4 screenshots, each
// at most 256 KiB, game/ at most 993 files and 48 MiB, and the dossier
// text capped at 160 KiB. Anything over a cap fails loudly here rather
// than silently at the gate.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const GAME_DIR = join(repoRoot, 'game');
const SHOTS_DIR = join(repoRoot, 'screenshots');

function requireDir(path: string, label: string): void {
  if (!existsSync(path)) {
    throw new Error(`Solara Skies: ${label} is missing at ${path}`);
  }
}

requireDir(GAME_DIR, 'game/');
requireDir(SHOTS_DIR, 'screenshots/');

// Start from an empty output directory so a stale file can never leak in.
// Never remove the output directory itself: the grader runs as uid 65534
// on a read-only root, so removing /output would fail with EACCES.
// Clear only the entries inside it.
mkdirSync(outputDir, { recursive: true });
for (const entry of readdirSync(outputDir)) {
  rmSync(join(outputDir, entry), { recursive: true, force: true });
}

cpSync(GAME_DIR, join(outputDir, 'game'), { recursive: true });
cpSync(SHOTS_DIR, join(outputDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);

console.log(`Solara Skies handed in: game/ + screenshots/ + dossier.json in ${outputDir}`);
