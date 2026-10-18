// Simulated network test for the rollback session: two peers on one virtual clock with latency,
// jitter, loss and clock drift. Each peer plays its seat's keys from a recorded scenario, and the
// test checks both end in the same state.
// Usage: npx tsx tools/netsim.ts [peers] [frames] [latencyMs] [jitterMs] [loss] [dropAt] [scenario]
import fs from 'node:fs';
import path from 'node:path';
import { createPort, InputTimeline, T0, type Scenario } from './lib/port.ts';
import { RollbackSession, snapshotHash } from '../src/net/rollback.ts';
import { saveSnapshot } from '../src/engine/snapshot.ts';
import { Rng } from '../src/engine/rng.ts';
import type { PlayerInput } from '../src/engine/io.ts';
import { SEAT_KEYS } from '../src/client/controls.ts';

const peers = Math.min(2, Number(process.argv[2] ?? 2));
const frames = Number(process.argv[3] ?? 2400);
const latency = Number(process.argv[4] ?? 60);
const jitter = Number(process.argv[5] ?? 20);
const loss = Number(process.argv[6] ?? 0.05);
const scenarioFile = process.argv[8] ?? 'tests/scenarios/vs-1-2-s1.json';
const scenario: Scenario = JSON.parse(fs.readFileSync(path.resolve(scenarioFile), 'utf8'));
const seed = scenario.seed;
const FRAME = 1000 / 30;

/** Seat 1 plays the scenario's Player 2 keys, and seat 0 plays every other key. */
function scriptFor(seat: number): (tick: number) => PlayerInput {
  const tl = new InputTimeline(scenario.events);
  const p2 = new Set(SEAT_KEYS[1]);
  return (tick) => {
    const keys = tl.inputsFor(tick + 1)[0]?.keys ?? [];
    return { keys: keys.filter((k) => p2.has(k) === (seat === 1)) };
  };
}

interface Ev {
  t: number;
  kind: 'tick' | 'packet';
  peer: number;
  data?: ArrayBuffer;
  seq: number;
}
const queue: Ev[] = [];
let seq = 0;
function push(e: Omit<Ev, 'seq'>): void {
  queue.push({ ...e, seq: seq++ });
}
function pop(): Ev | undefined {
  let best = 0;
  for (let i = 1; i < queue.length; i++) if (queue[i].t < queue[best].t || (queue[i].t === queue[best].t && queue[i].seq < queue[best].seq)) best = i;
  return queue.splice(best, 1)[0];
}

const netRng = new Rng(7);
let now = 0;
const seats = Array.from({ length: peers }, (_, i) => i);
const sessions = seats.map((seat) => {
  const rt = createPort(seed);
  rt.logPen = false;
  rt.greenFlag();
  return new RollbackSession({
    rt,
    local: seat,
    seats,
    delay: 2,
    maxPrediction: 10,
    now: () => now,
    transport: {
      send(to, data) {
        if (netRng.next() < loss) return;
        const delay = latency / 2 + netRng.next() * jitter;
        push({ t: now + delay, kind: 'packet', peer: to, data });
      },
    },
  });
});
const scripts = seats.map(scriptFor);
const ticks = seats.map(() => 0);
const stalledTicks = seats.map(() => 0);
const drift = seats.map((s) => 1 + (s - (peers - 1) / 2) * 0.002);
seats.forEach((s) => push({ t: s * 7, kind: 'tick', peer: s }));

// Optional 7th argument: the last seat disconnects at this tick, and the host drops it after 5 s.
const dropAt = Number(process.argv[7] ?? 0);
const leaver = peers - 1;
const gone = new Set<number>();
let dropSent = false;
const dropEvents: { t: number; peer: number; frame: number; data: ArrayBuffer }[] = [];

const started = performance.now();
let lastProbe = 0;
while (queue.length || dropEvents.length) {
  dropEvents.sort((a, b) => a.t - b.t);
  if (dropEvents.length && (!queue.length || dropEvents[0].t <= Math.min(...queue.map((q) => q.t)))) {
    const d = dropEvents.shift()!;
    now = d.t;
    if (!sessions[d.peer].applyDrop(leaver, d.frame, d.data)) console.log(`seat ${d.peer} could not apply the drop`);
    continue;
  }
  const e = pop()!;
  now = e.t;
  if (gone.has(e.peer)) continue;
  const s = sessions[e.peer];
  if (e.kind === 'packet') {
    s.receive(e.data!);
    continue;
  }
  if (dropAt && e.peer === leaver && ticks[e.peer] >= dropAt) {
    gone.add(e.peer);
    continue;
  }
  // Like the page, a tick that does not advance offers the same input again next time.
  if (s.tick(scripts[e.peer](ticks[e.peer]))) ticks[e.peer]++;
  else stalledTicks[e.peer]++;
  if (dropAt && e.peer === 0 && !dropSent && gone.has(leaver) && s.stats.silentFor[leaver] > 5000) {
    const offer = s.dropOffer(leaver);
    s.applyDrop(leaver, offer.frame, offer.data);
    for (const p of seats) if (p !== 0 && p !== leaver) dropEvents.push({ t: now + latency, peer: p, frame: offer.frame, data: offer.data });
    dropSent = true;
    console.log(`host dropped seat ${leaver} after frame ${offer.frame} (host at frame ${s.frame})`);
  }
  if (now - lastProbe > 1000) {
    sessions.forEach((x, i) => !gone.has(i) && x.probe());
    lastProbe = now;
  }
  const done = sessions.every((x, i) => gone.has(i) || x.confirmedFrame() >= frames);
  if (!done && ticks[e.peer] + stalledTicks[e.peer] < frames * 3) push({ t: now + FRAME * drift[e.peer], kind: 'tick', peer: e.peer });
}

// Every remaining peer's state at the common confirmed frame must agree.
const live = sessions.filter((_, i) => !gone.has(i));
const target = Math.min(...live.map((x) => x.confirmedFrame()));
const hashes = live.map((x) => {
  const snap = (x as unknown as { snaps: Map<number, ReturnType<typeof saveSnapshot>> }).snaps.get(target);
  return snap ? snapshotHash(snap) : -1;
});
const agree = hashes.every((h) => h === hashes[0] && h !== -1);
if (!agree) {
  // Find the first retained frame where seat 0 and seat 1 differ, and show what differs.
  const a = (sessions[0] as unknown as { snaps: Map<number, any> }).snaps;
  const b = (sessions[1] as unknown as { snaps: Map<number, any> }).snaps;
  const common = [...a.keys()].filter((f) => b.has(f)).sort((x, y) => x - y);
  for (const f of common) {
    if (snapshotHash(a.get(f)) !== snapshotHash(b.get(f))) {
      const ja = a.get(f);
      const jb = b.get(f);
      console.log(`first retained differing frame ${f} (retained ${common[0]}..${common[common.length - 1]})`);
      for (const k of Object.keys(ja)) {
        const sa = JSON.stringify(ja[k]);
        const sb = JSON.stringify(jb[k]);
        if (sa !== sb) {
          let i = 0;
          while (i < sa.length && sa[i] === sb[i]) i++;
          console.log(`  ${k} differs at char ${i}: ...${sa.slice(Math.max(0, i - 150), i + 150)}\n  vs ...${sb.slice(Math.max(0, i - 150), i + 150)}`);
        }
      }
      break;
    }
  }
  console.log('menu', sessions.map((x) => x.rt.stage.v.menu));
}
const st = sessions.map((x) => x.stats);
console.log(`peers=${peers} frames=${target} latency=${latency}+${jitter}ms loss=${loss} wall=${((performance.now() - started) / 1000).toFixed(1)}s`);
st.forEach((x, i) => console.log(`  seat ${i}: frame ${x.frame} rollbacks ${x.rollbacks} rolled ${x.rolledFrames} stalls ${x.stalls} adv ${x.advantage.toFixed(2)} desync ${x.desync ? JSON.stringify(x.desync) : 'none'}`));
const v = (x: RollbackSession, n: string) => String(x.rt.stage.v[x.rt.stage.sprite.def.varNames?.[n] ?? n]);
live.forEach((x, i) => console.log(`  seat ${i} game: menu ${v(x, 'menu')} fighters ${v(x, 'char1')}/${v(x, 'char2')} stage ${v(x, 'stage')} HP ${v(x, '1HP')}/${v(x, '2HP')}`));
console.log(agree ? `STATES AGREE at frame ${target} (${hashes[0].toString(16)})` : `STATES DIFFER at frame ${target}: ${hashes.map((h) => h.toString(16)).join(' ')}`);
if (!agree || st.some((x) => x.desync)) process.exitCode = 1;
void T0;
