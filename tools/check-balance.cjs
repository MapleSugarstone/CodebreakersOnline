// Checks that the merged build carries PK's battle code, balance data and fighter art exactly: every script of the
// battle sprites prints the same as PK's, every balance list holds PK's rows, and costume and sound lists match in order.
const path = require('path');
const L = require('./merge/sb3.cjs');

const root = path.resolve(__dirname, '..');
const pk = L.loadProject(path.join(root, 'work/pk'));
const de = L.loadProject(path.join(root, process.argv[2] || 'out/merged'));
const SPRITES = ['P1', 'P2', 'Hitbox', 'Staleness Engine', 'Costumes', 'Puppet Anchor', 'Transition', 'SRCutscenes', 'v', '1'];
// The asset preload, which each project does its own way, and CB's training setup, which PK cut.
const CB_EXTRA = { Costumes: ['WHEN I RECEIVE "AssetLoad"', 'WHEN I RECEIVE "Training"'] };
const ASSET_SPRITES = ['P1', 'P2', 'Hitbox', 'Staleness Engine', 'Costumes', 'FX', 'SRCastGuests', 'Transition', 'CSS', 'BattleUI'];
const LISTS = ['stats', 'dmg', 'kback', 'dodgedata', 'charplaystyle', 'AirMdata', 'Outlier Moves', 'Gimmick Moves', 'heavyfreeze', 'lightfeeze',
  'fdataLOWERBOUND', 'fdataUPPERBOUND', 'disjointpresets', 'projectilepresets', 'actionpresets', 'armorpresets', 'customhitsounds',
  'customdashsounds', 'hitboxswitch', 'bouncingmoves', 'hascustomspecial', 'hascounter', 'Nofreefallaftermove', 'ReflectingMoves',
  'hasaerialcancel', 'uncontrollablemoves', 'autoswing'];
let problems = 0;
const bad = m => { problems++; console.log('  ' + m); };

for (const name of SPRITES) {
  const a = L.getTarget(pk, name), b = L.getTarget(de, name);
  const texts = t => L.topScripts(t).map(id => `${L.hatText(t, id)}\n${L.scriptText(t, id)}`).sort();
  const keep = s => !(CB_EXTRA[name] || []).some(h => s.startsWith(h));
  const ta = texts(a).filter(keep), tb = texts(b).filter(keep);
  const missing = ta.filter(s => !tb.includes(s)), extra = tb.filter(s => !ta.includes(s));
  if (missing.length || extra.length) bad(`${name}: ${missing.length} PK scripts missing or changed, ${extra.length} extra (${(missing[0] || extra[0]).split('\n')[0]})`);
}
for (const name of LISTS) {
  const get = p => Object.values(L.getTarget(p, 'Stage').lists).find(l => l[0] === name);
  if (JSON.stringify(get(pk)[1]) !== JSON.stringify(get(de)[1])) bad(`list ${name} differs from PK`);
}
for (const name of ASSET_SPRITES) {
  for (const kind of ['costumes', 'sounds']) {
    const sig = t => t[kind].map(c => `${c.name}:${c.md5ext}:${c.rotationCenterX}:${c.rotationCenterY}`).join('|');
    if (sig(L.getTarget(pk, name)) !== sig(L.getTarget(de, name))) bad(`${name} ${kind} differ from PK`);
  }
}
console.log(problems ? `${problems} differences from PK` : 'battle code, balance lists and fighter art match PK');
process.exit(problems ? 1 : 0);
