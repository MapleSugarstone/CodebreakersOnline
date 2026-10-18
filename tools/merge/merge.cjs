// Builds out/merged (project.json plus assets) from pristine Codebreakers 1.5.1 (base) and Project K 1.3.1. See Notes/porting-plan.md.
const fs = require('fs');
const path = require('path');
const L = require('./sb3.cjs');
const hand = require('./hand.cjs');

const ROOT = path.resolve(__dirname, '../..');
const CB = path.join(ROOT, 'work/cb'), PK = path.join(ROOT, 'work/pk'), OUT = path.join(ROOT, 'out/merged');

const dst = L.loadProject(CB);
const src = L.loadProject(PK);
const M = new L.Merger(dst, src);
const log = [];
const T = (p, n) => L.getTarget(p, n);

// ---------------------------------------------------------------- scripts

// Rebuilds a target's block table so its scripts run in the given order (the VM runs hats in table order).
function reorder(t, tops) {
  const nb = {}, seen = new Set();
  for (const top of tops) for (const id of L.scriptIds(t.blocks, top)) if (!seen.has(id)) { nb[id] = t.blocks[id]; seen.add(id); }
  for (const [id, b] of Object.entries(t.blocks)) if (!seen.has(id)) nb[id] = b;
  t.blocks = nb;
}

// Changed scripts take PK's body, PK-only scripts come across, CB-only scripts stay unless dropped.
// Scripts run in PK's order, with CB-only scripts after them.
function takePkScripts(name, { dropCB = [], skipPK = [], keepCB = [] } = {}) {
  const ta = T(dst, name), tb = T(src, name);
  const cbTops = L.topScripts(ta);
  const { pairs, onlyA, onlyB } = L.pairScripts(ta, tb);
  const pkToDst = new Map();
  let changed = 0, added = 0, dropped = 0;
  for (const [x, y] of pairs) {
    if (x.text === y.text || keepCB.includes(x.hat)) { pkToDst.set(y.id, x.id); continue; }
    const b = ta.blocks[x.id];
    const nid = M.copyScript(tb, y.id, ta, b.x, b.y);
    L.removeScript(ta, x.id);
    pkToDst.set(y.id, nid);
    changed++;
  }
  for (const y of onlyB) {
    if (skipPK.includes(y.hat)) continue;
    const b = tb.blocks[y.id];
    pkToDst.set(y.id, M.copyScript(tb, y.id, ta, b.x, b.y));
    added++;
  }
  for (const x of onlyA) if (dropCB.includes(x.hat)) { L.removeScript(ta, x.id); dropped++; }
  const order = L.topScripts(tb).map(id => pkToDst.get(id)).filter(Boolean);
  for (const id of cbTops) if (ta.blocks[id] && !order.includes(id)) order.push(id);
  reorder(ta, order);
  log.push(`${name}: ${changed} scripts from PK, ${added} added, ${dropped} dropped, ${onlyA.length - dropped} CB-only kept`);
}

takePkScripts('P1');
takePkScripts('P2');
takePkScripts('Hitbox', { dropCB: ['DEFINE "SCALARproj x %s y %s collide? %s pierce? %s reflect? %s Player %s physics? %s explosive? %s t\' %s" args=["x","y","c","p","r","1/2","ph","kaboom","dt"] warp=false'] });
takePkScripts('Staleness Engine');
takePkScripts('Costumes');
takePkScripts('FX');
takePkScripts('SRCastGuests');
takePkScripts('Transition');
takePkScripts('Puppet Anchor');
takePkScripts('SRCutscenes');
takePkScripts('v');
takePkScripts('1');
// These keep CB's version of the scripts PK cut down; hand.cjs edits some of them further.
takePkScripts('Stage', { keepCB: ['WHEN I RECEIVE "Controls"', 'WHEN I RECEIVE "Countdown"'] });
takePkScripts('BattleUI', { keepCB: ['WHEN I START AS A CLONE'] });
takePkScripts('Collision', { skipPK: ['WHEN KEY 9 PRESSED'] });
takePkScripts('CSS', { keepCB: ['DEFINE "randompick char %s" args=["1/2"] warp=true'] });

// ---------------------------------------------------------------- data

const STAGE_TAKE_PK = [
  'stats', 'dmg', 'kback', 'dodgedata', 'charplaystyle', 'AirMdata',
  'Outlier Moves', 'Gimmick Moves', 'heavyfreeze', 'lightfeeze', 'fdataLOWERBOUND', 'fdataUPPERBOUND', 'disjointpresets',
  'projectilepresets', 'actionpresets', 'armorpresets', 'customhitsounds', 'customdashsounds', 'hitboxswitch', 'bouncingmoves',
  'hascustomspecial', 'hascounter', 'Nofreefallaftermove', 'ReflectingMoves', 'hasaerialcancel', 'AI seed', 'debugList',
  'SRFunny Sayings', 'uncontrollablemoves', 'autoswing',
];
function listEntry(t, name) {
  const e = Object.entries(t.lists).find(([, v]) => v[0] === name);
  return e ? e[1] : null;
}
for (const name of STAGE_TAKE_PK) {
  const s = listEntry(T(src, 'Stage'), name), d = listEntry(T(dst, 'Stage'), name);
  if (!s || !d) throw new Error(`list ${name} missing (${!!s}, ${!!d})`);
  d[1] = JSON.parse(JSON.stringify(s[1]));
}
for (const [sprite, name] of [['BattleUI', 'UIcheck']]) {
  listEntry(T(dst, sprite), name)[1] = JSON.parse(JSON.stringify(listEntry(T(src, sprite), name)[1]));
}

// ---------------------------------------------------------------- art and sound

// Per sprite: 'pk' takes PK's costume or sound list whole, in PK's order (frame order and speed digits are timing).
const ASSETS = {
  P1: { costumes: 'pk', sounds: 'pk' },
  P2: { costumes: 'pk', sounds: 'pk' },
  Hitbox: { costumes: 'pk', sounds: 'pk' },
  'Staleness Engine': { costumes: 'pk', sounds: 'pk' },
  Costumes: { costumes: 'pk', sounds: 'pk' },
  FX: { costumes: 'pk', sounds: 'pk' },
  SRCastGuests: { costumes: 'pk', sounds: 'pk' },
  Transition: { costumes: 'pk', sounds: 'pk' },
  CSS: { costumes: 'pk', sounds: 'pk' },
  BattleUI: { costumes: 'pk', sounds: 'pk' },
};
for (const [name, kinds] of Object.entries(ASSETS)) {
  const ta = T(dst, name), tb = T(src, name);
  for (const [kind, mode] of Object.entries(kinds)) {
    if (mode !== 'pk') continue;
    const lost = ta[kind].map(a => a.name).filter(n => !tb[kind].some(b => b.name === n));
    ta[kind] = JSON.parse(JSON.stringify(tb[kind]));
    if (lost.length) log.push(`${name} ${kind}: PK list drops ${lost.join(', ')}`);
  }
  ta.currentCostume = Math.min(ta.currentCostume, ta.costumes.length - 1);
}
// Same names, PK's redrawn select-screen cursors.
for (const n of ['costume25', 'costume26', 'costume27', 'costume28']) {
  const a = T(dst, 'MenuUI').costumes.find(c => c.name === n), b = T(src, 'MenuUI').costumes.find(c => c.name === n);
  Object.assign(a, JSON.parse(JSON.stringify(b)));
}

// ---------------------------------------------------------------- hand merges

hand.run({ dst, src, M, L, log });

// ---------------------------------------------------------------- finish

for (const t of dst.targets) L.fixCalls(t, log);

// Blocks no top-level block reaches never run or show; CB carries some, and removing scripts strands more.
for (const t of dst.targets) {
  const live = new Set();
  for (const [id, b] of Object.entries(t.blocks)) if (Array.isArray(b) || b.topLevel) for (const x of L.scriptIds(t.blocks, id)) live.add(x);
  const dead = Object.keys(t.blocks).filter(id => !live.has(id));
  if (dead.length) { L.removeIds(t, new Set(dead)); log.push(`${t.name}: removed ${dead.length} unreachable blocks`); }
  for (const [id, b] of Object.entries(t.blocks)) {
    if (!L.isBlock(b)) continue;
    const kids = [b.next, ...Object.values(b.inputs).flatMap(i => i.slice(1))].filter(k => typeof k === 'string');
    for (const k of kids) if (L.isBlock(t.blocks[k]) && !t.blocks[k].parent) { t.blocks[k].parent = id; log.push(`${t.name}: relinked ${k} to ${id}`); }
  }
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const need = new Set();
for (const t of dst.targets) for (const a of [...t.costumes, ...t.sounds]) need.add(a.md5ext || `${a.assetId}.${a.dataFormat}`);
for (const f of need) {
  const from = [CB, PK, path.join(ROOT, 'assets')].map(d => path.join(d, f)).find(p => fs.existsSync(p));
  if (!from) { log.push(`asset ${f} not found`); continue; }
  fs.copyFileSync(from, path.join(OUT, f));
}
dst.meta = { semver: '3.0.0', vm: '15.1.1', agent: 'codebreakers-merge' };
fs.writeFileSync(path.join(OUT, 'project.json'), JSON.stringify(dst));
log.push(`created: ${M.created.join('; ')}`);
fs.writeFileSync(path.join(ROOT, 'out/merge-log.txt'), log.join('\n') + '\n');
console.log(log.join('\n'));
console.log(`wrote ${OUT} (${need.size} assets)`);
