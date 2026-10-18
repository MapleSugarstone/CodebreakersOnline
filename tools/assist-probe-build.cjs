// Builds out/assist-probe.sb3: the merged build plus logging in the Assists sprite. Each time testforhit touches the
// opponent it adds "<costume>=<row found>" to the Stage list `assistlog`, and each direct "Hit dmg" call adds "hit <dmg>".
const fs = require('fs');
const path = require('path');
const L = require('./merge/sb3.cjs');
const { learnShapes, asm } = require('./merge/asm.cjs');

const root = path.resolve(__dirname, '..');
const src = path.join(root, process.argv[2] || 'out/merged');
const out = path.join(root, 'out/assist-probe');
const p = L.loadProject(src);
learnShapes(p);
const ids = new L.Ids(p);
const st = L.getTarget(p, 'Stage'), t = L.getTarget(p, 'Assists');
st.lists[ids.next()] = ['assistlog', []];

const test = L.findScript(t, 'DEFINE "testforhit %s"');
const loop = L.findStmt(t, test, 'repeat until (strcontains(costume_name, item($misca, @assisthits))');
L.insertAfter(t, loop, asm(p, t, ids, 'add join(costume_name, join("=", item($misca, @assisthits))) to @assistlog'));
const hit = L.findScript(t, 'DEFINE "Hit dmg: %s dx %s dy %s P %s iframes %s"');
L.insertBefore(t, t.blocks[hit].next, asm(p, t, ids, 'add join("hit ", arg(d)) to @assistlog'));

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const f of fs.readdirSync(src)) if (f !== 'project.json') fs.linkSync(path.join(src, f), path.join(out, f));
fs.writeFileSync(path.join(out, 'project.json'), JSON.stringify(p));
console.log('wrote', out);
