// Plays fuzzed versus matches in the port and reports fighters left unable to act: controls locked (pmov not 0)
// or hidden for over 10 seconds during a match, with the grabs and deaths just before.
// Usage: npx tsx tools/stuck-hunt.ts [seeds] [frames per match] [--kill-grabbed]
import fs from 'node:fs';
import path from 'node:path';
import { createPort } from './lib/port.ts';
import { Rng } from '../src/engine/rng.ts';
import type { Runtime } from '../src/engine/runtime.ts';

const seeds = Number(process.argv[2] ?? 12);
const frames = Number(process.argv[3] ?? 9000);
const killGrabbed = process.argv.includes('--kill-grabbed');
const OUT = path.resolve(import.meta.dirname, '../out/logs/stuck-hunt.txt');
const P1KEYS = ['left arrow', 'right arrow', 'up arrow', 'down arrow', 'N', 'M', 'B'];
const P2KEYS = ['A', 'D', 'W', 'S', 'F', 'G', 'H'];
const lines: string[] = [];
const say = (s: string) => {
  lines.push(s);
  console.log(s);
  fs.writeFileSync(OUT, `${lines.join('\n')}\n`);
};

for (let seed = 1; seed <= seeds; seed++) {
  const rt: Runtime = createPort(seed);
  rt.logPen = false;
  rt.greenFlag();
  const rng = new Rng(seed * 977);
  const held = new Set<string>();
  const v = (n: string) => String(rt.stage.v[rt.stage.sprite.def.varNames?.[n] ?? n]);
  const step = (extra: string[] = []) => rt.stepFrame([{ keys: [...held, ...extra] }]);
  const tap = (k: string, wait = 12) => {
    for (let i = 0; i < 3; i++) step([k]);
    for (let i = 0; i < wait; i++) step();
  };
  // Boot past the loading screen to the select screen, pick two random fighters, start with the CPU on.
  for (let i = 0; i < 60; i++) step(['`']);
  for (let i = 0; i < 240; i++) step();
  tap('N', 150);
  tap('N', 150);
  tap('N', 150);
  const c1 = 1 + Math.floor(rng.next() * 47), c2 = 1 + Math.floor(rng.next() * 47);
  for (let i = 0; i < Math.floor(c1 / 16); i++) tap('down arrow', 8);
  for (let i = 0; i < c1 % 16; i++) tap('right arrow', 8);
  tap('N', 15);
  for (let i = 0; i < Math.floor(c2 / 16); i++) tap('S', 8);
  for (let i = 0; i < c2 % 16; i++) tap('D', 8);
  tap('F', 15);
  tap('N', 240);
  const fighters = `${v('char1')}/${v('char2')}`;
  const p = [rt.targets.find((t) => t.name === 'P1' && t.isOriginal)!, rt.targets.find((t) => t.name === 'P2' && t.isOriginal)!];
  const since = [0, 0];
  const hiddenSince = [0, 0];
  const events: string[] = [];
  const reported = [false, false];
  const wasGrabbed = [false, false];
  const zeroSeen = [false, false];
  const grabFrames = [0, 0];
  let grabs = 0;
  let zeroWhileGrabbed = 0;
  const prev: Record<string, string> = {};
  for (let f = 0; f < frames; f++) {
    // Player 1 mashes, and the CPU plays Player 2.
    if (rng.next() < 0.3) {
      const k = P1KEYS[Math.floor(rng.next() * P1KEYS.length)];
      held.has(k) ? held.delete(k) : held.add(k);
    }
    step();
    for (const n of ['P1Grabbed', 'P2Grabbed', 'P1state', 'P2state', '1pmov', '2pmov', 'menu']) {
      const now = v(n);
      if (prev[n] !== now && (n !== 'P1state' && n !== 'P2state' || /Blowaway|Fatal|Throw|Hurt/.test(now) === false ? n.includes('Grabbed') || n.includes('pmov') || n === 'menu' : true)) events.push(`${rt.frame}:${n}=${now}`);
      prev[n] = now;
    }
    if (events.length > 40) events.splice(0, events.length - 40);
    for (const s of [1, 2]) {
      const g = v(`P${s}Grabbed`) === '1';
      if (g && !wasGrabbed[s - 1]) grabs++;
      // With --kill-grabbed, a fighter's HP drops to 0 five frames into a grab, as when an assist hits them while held.
      grabFrames[s - 1] = g ? grabFrames[s - 1] + 1 : 0;
      if (killGrabbed && grabFrames[s - 1] === 5) rt.stage.v[rt.stage.sprite.def.varNames![`${s}HP`]] = 0;
      if (g && v(`${s}HP`) === '0' && !zeroSeen[s - 1]) zeroWhileGrabbed++;
      zeroSeen[s - 1] = g && v(`${s}HP`) === '0';
      wasGrabbed[s - 1] = g;
    }
    const inMatch = v('menu') === '4';
    for (const s of [0, 1]) {
      const locked = v(`${s + 1}pmov`) !== '0';
      since[s] = inMatch && locked ? since[s] + 1 : 0;
      hiddenSince[s] = inMatch && !p[s].visible ? hiddenSince[s] + 1 : 0;
      if (!reported[s] && (since[s] > 300 || hiddenSince[s] > 300)) {
        reported[s] = true;
        say(`seed ${seed} fighters ${fighters}: P${s + 1} stuck at frame ${rt.frame} (pmov ${v(`${s + 1}pmov`)}, visible ${p[s].visible}, HP ${v(`${s + 1}HP`)}, state ${v(`P${s + 1}state`)})`);
        say(`  recent: ${events.slice(-25).join(' ')}`);
      }
    }
  }
  say(`seed ${seed} fighters ${fighters}: done${reported.some(Boolean) ? '' : ', nobody stuck'}, grabs ${grabs}, zero HP while grabbed ${zeroWhileGrabbed}`);

}
