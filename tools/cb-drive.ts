// Drives the port through Codebreakers with a token script and records the key presses as a parity scenario.
// Usage: npx tsx tools/cb-drive.ts "<tokens>" [save-as] [seed]
// Tokens:
//   KEY*h/w      tap KEY for h frames (default 3), then run w frames (default 20); 2-word keys use _ (left_arrow)
//   hold:KEY/n   hold KEY for n frames
//   wait/n       run n frames
//   until:VAR=V/n  run until stage variable VAR equals V (at most n frames)
//   pick:N       move P1's select cursor to fighter N and confirm it; pick2:N does the same for P2 (wasd, f)
//   fuzz/n       random presses of both players' game keys for n frames
//   boot         skip the costume preload, wait for the title and press n into the main menu
import fs from 'node:fs';
import path from 'node:path';
import { createPort } from './lib/port.ts';
import type { ScenarioEvent, Scenario } from './lib/port.ts';
import type { PlayerInput } from '../src/engine/io.ts';
import { Rng } from '../src/engine/rng.ts';
import type { Runtime } from '../src/engine/runtime.ts';

const tokens = (process.argv[2] ?? '').split(/\s+/).filter(Boolean);
const saveAs = process.argv[3];
const seed = Number(process.argv[4] ?? 7);
const fuzzRng = new Rng(seed * 31 + 7);
const P1KEYS = ['left arrow', 'right arrow', 'up arrow', 'down arrow', 'N', 'M', 'B'];
const P2KEYS = ['A', 'D', 'W', 'S', 'F', 'G', 'H'];

const rt: Runtime = createPort(seed);
rt.logPen = false;
rt.greenFlag();
const events: ScenarioEvent[] = [];
const held = new Set<string>();
let f = 0;

const stageVar = (name: string) => {
  const prop = rt.stage.sprite.def.varNames?.[name];
  return prop === undefined ? undefined : rt.stage.v[prop];
};
const step = () => {
  f++;
  for (const e of events) if (e.f === f && e.type === 'key') (e.down ? held.add(e.key) : held.delete(e.key));
  const inp: PlayerInput[] = [{ keys: [...held] }];
  rt.stepFrame(inp);
};
const run = (n: number) => { for (let i = 0; i < n; i++) step(); };
const press = (key: string, hold: number, wait: number) => {
  events.push({ f: f + 1, type: 'key', key, down: true }, { f: f + 1 + hold, type: 'key', key, down: false });
  run(hold + wait);
};
const until = (name: string, value: string, max: number): boolean => {
  for (let i = 0; i < max; i++) {
    if (String(stageVar(name)) === value) return true;
    step();
  }
  return String(stageVar(name)) === value;
};
const show = (label: string) => {
  const v = (n: string) => String(stageVar(n));
  console.log(`${label.padEnd(16)} f=${f} menu=${v('menu')} gamemode=${v('gamemode')} char1=${v('char1')} char2=${v('char2')} stage=${v('stage')} helpers=${v('helper1')}/${v('helper2')} Assetload=${v('Assetload')} P1=${v('P1state')} P2=${v('P2state')} HP=${v('1HP')}/${v('2HP')}`);
};

// The select grid is 16 wide; right and left wrap within the 48 fighters and skip blacklisted cells.
function pick(n: number, p: 1 | 2): void {
  const keys = p === 1 ? { r: 'right arrow', d: 'down arrow', ok: 'N' } : { r: 'D', d: 'S', ok: 'F' };
  const cur = () => Number(stageVar(p === 1 ? 'char1' : 'char2'));
  for (let tries = 0; tries < 80 && cur() !== n; tries++) {
    const c = cur();
    const rowDiff = Math.floor((n - 1) / 16) - Math.floor((c - 1) / 16);
    if (rowDiff !== 0 && Math.floor((n - 1) / 16) !== Math.floor((c - 1) / 16) && ((c - 1) % 16) === ((n - 1) % 16)) press(keys.d, 3, 8);
    else press(keys.r, 3, 8);
  }
  if (cur() !== n) throw new Error(`could not reach fighter ${n} for P${p} (at ${cur()})`);
  press(keys.ok, 3, 15);
}

for (const tok of tokens) {
  if (tok === 'boot') {
    // Holding ` while the title loads skips the costume preload pass.
    events.push({ f: 1, type: 'key', key: '`', down: true });
    if (!until('Assetload', '18', 2000)) throw new Error('preload was not skipped');
    events.push({ f: f + 1, type: 'key', key: '`', down: false });
    run(240);
    press('N', 4, 150);
  } else if (tok.startsWith('until:')) {
    const m = tok.match(/^until:([^=]+)=([^/]*)(?:\/(\d+))?$/)!;
    if (!until(m[1], m[2], Number(m[3] ?? 600))) throw new Error(`timed out on ${tok}`);
  } else if (tok.startsWith('hold:')) {
    const m = tok.match(/^hold:([^/]+)\/(\d+)$/)!;
    press(m[1].replace(/_/g, ' '), Number(m[2]), 0);
  } else if (tok.startsWith('wait/')) {
    run(Number(tok.slice(5)));
  } else if (tok.startsWith('pick:') || tok.startsWith('pick2:')) {
    pick(Number(tok.split(':')[1]), tok.startsWith('pick2') ? 2 : 1);
  } else if (tok.startsWith('fuzz/')) {
    const end = f + Number(tok.slice(5));
    const down = new Set<string>();
    while (f < end) {
      const keys = fuzzRng.next() < 0.5 ? P1KEYS : P2KEYS;
      const k = keys[Math.floor(fuzzRng.next() * keys.length)];
      events.push({ f: f + 1, type: 'key', key: k, down: !down.has(k) });
      if (down.has(k)) down.delete(k);
      else down.add(k);
      run(1 + Math.floor(fuzzRng.next() * 8));
    }
    for (const k of down) events.push({ f: f + 1, type: 'key', key: k, down: false });
    run(1);
  } else {
    const m = tok.match(/^([^*/]+)(?:\*(\d+))?(?:\/(\d+))?$/);
    if (!m) throw new Error(`bad token ${tok}`);
    press(m[1].replace(/_/g, ' '), Number(m[2] ?? 3), Number(m[3] ?? 20));
  }
  show(tok);
}
if (saveAs) {
  const sc: Scenario = { name: saveAs, seed, frames: f + 30, events };
  fs.mkdirSync(path.resolve(import.meta.dirname, '../tests/scenarios'), { recursive: true });
  fs.writeFileSync(path.resolve(import.meta.dirname, `../tests/scenarios/${saveAs}.json`), JSON.stringify(sc));
  console.log(`saved tests/scenarios/${saveAs}.json (${sc.frames} frames)`);
}
