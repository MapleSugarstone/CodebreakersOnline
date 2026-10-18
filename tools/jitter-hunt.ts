// Moves through the menus in the port and lists sprites that step backwards: a move followed within a few frames
// by a move the other way, as a jittering selection bar would.
// Usage: npx tsx tools/jitter-hunt.ts
import { createPort } from './lib/port.ts';
import type { Target } from '../src/engine/target.ts';

const rt = createPort(9);
rt.logPen = false;
rt.greenFlag();
const v = (n: string) => String(rt.stage.v[rt.stage.sprite.def.varNames?.[n] ?? n]);
type Track = { x: number; y: number; dx: number; dy: number; lastMove: number; reversals: number; example: string };
const tracks = new Map<Target, Track>();
let phase = 'boot';
const step = (keys: string[] = []) => {
  rt.stepFrame([{ keys }]);
  for (const t of rt.drawList) {
    if (!t.visible) continue;
    let tr = tracks.get(t);
    if (!tr) {
      tracks.set(t, { x: t.x, y: t.y, dx: 0, dy: 0, lastMove: rt.frame, reversals: 0, example: '' });
      continue;
    }
    const dx = Math.sign(Math.round((t.x - tr.x) * 100)), dy = Math.sign(Math.round((t.y - tr.y) * 100));
    if (dx || dy) {
      const reversed = (dx && tr.dx && dx !== tr.dx) || (dy && tr.dy && dy !== tr.dy);
      if (reversed && rt.frame - tr.lastMove <= 3) {
        tr.reversals++;
        if (!tr.example) tr.example = `${phase} frame ${rt.frame}: ${t.costumeName()} (${tr.x.toFixed(1)},${tr.y.toFixed(1)}) -> (${t.x.toFixed(1)},${t.y.toFixed(1)})`;
      }
      if (dx) tr.dx = dx;
      if (dy) tr.dy = dy;
      tr.lastMove = rt.frame;
    }
    tr.x = t.x;
    tr.y = t.y;
  }
};
const run = (n: number, keys: string[] = []) => { for (let i = 0; i < n; i++) step(keys); };
const tap = (k: string, wait = 20) => { run(3, [k]); run(wait); };

run(60, ['`']);
run(240);
phase = 'main menu';
tap('N', 120);
for (let i = 0; i < 6; i++) tap('right arrow', 25);
for (let i = 0; i < 6; i++) tap('left arrow', 25);
phase = 'fight settings';
tap('N', 120);
for (let i = 0; i < 4; i++) tap('down arrow', 25);
for (let i = 0; i < 4; i++) tap('right arrow', 25);
for (let i = 0; i < 4; i++) tap('up arrow', 25);
phase = 'character select';
tap('N', 150);
for (let i = 0; i < 8; i++) tap('right arrow', 12);
run(120);
console.log(`menu=${v('menu')} frame=${rt.frame}`);
const rows = [...tracks.entries()].filter(([, tr]) => tr.reversals > 0).sort((a, b) => b[1].reversals - a[1].reversals);
for (const [t, tr] of rows.slice(0, 15)) console.log(`${t.name}${t.isOriginal ? '' : ' (clone)'}: ${tr.reversals} quick reversals, e.g. ${tr.example}`);
if (!rows.length) console.log('no sprite stepped backwards');
