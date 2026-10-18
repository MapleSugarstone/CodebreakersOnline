// Records the versus parity suite. Together the matches cover every selectable fighter, stages 1-26 and assists 1-64.
// Fighters 34-38 and 42 are blacklisted on the select screen, so no match uses them.
// Usage: npx tsx tools/cb-suite.ts [name filter]
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const filter = process.argv[2];

/** Fighter 1, fighter 2, stage, assist 1, assist 2. */
const MATCHES: [number, number, number, number, number][] = [];
for (let i = 0; i < 24; i++) {
  const a = 2 * i + 1, b = 2 * i + 2;
  if ([a, b].some((n) => (n >= 34 && n <= 38) || n === 42)) continue;
  MATCHES.push([a, b, i + 1, a, b]);
}
MATCHES.push(
  [33, 41, 17, 33, 34], [43, 44, 18, 35, 36], [45, 46, 19, 37, 38], [47, 1, 21, 41, 42],
  [2, 3, 25, 49, 50], [4, 5, 26, 51, 52], [6, 7, 1, 53, 54], [8, 9, 2, 55, 56],
  [10, 11, 3, 57, 58], [12, 13, 4, 59, 60], [14, 15, 5, 61, 62], [16, 17, 6, 63, 64],
);

/** Presses that move an assist selection from 0 to n; left wraps through -1 (random) to 64. */
function assistPresses(n: number, right: string, left: string): string[] {
  if (n <= 33) return Array(n).fill(`${right}*3/8`);
  return Array(64 - n + 2).fill(`${left}*3/8`);
}

const tsx = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
for (const [a, b, stage, h1, h2] of MATCHES) {
  const name = `vs-${a}-${b}-s${stage}`;
  if (filter && !name.includes(filter)) continue;
  const tokens = [
    'boot', 'N/120',
    ...Array(stage - 1).fill('right_arrow/8'),
    'N/150', `pick:${a}`, `pick2:${b}`,
    ...assistPresses(h1, 'right_arrow', 'left_arrow'),
    ...assistPresses(h2, 'D', 'A'),
    'N/240', 'fuzz/2400',
  ];
  const r = spawnSync(process.execPath, [tsx, 'tools/cb-drive.ts', tokens.join(' '), name], { cwd: ROOT, encoding: 'utf8' });
  const out = (r.stdout + r.stderr).trim().split('\n');
  console.log(`${name}: ${r.status === 0 ? 'ok' : 'FAILED'}  ${out.filter((l) => /^(N\/240|fuzz|saved)/.test(l) || /error/i.test(l)).join(' | ')}`);
}
