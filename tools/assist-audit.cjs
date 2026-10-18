// Audits the Assists sprite: for each assist, which of its costumes find a row in `assisthits` the way testforhit
// searches (first row whose name the costume name contains, case-insensitive), and how its script can deal damage.
const path = require('path');
const L = require('./merge/sb3.cjs');

const root = path.resolve(__dirname, '..');
const p = L.loadProject(path.join(root, process.argv[2] || 'out/merged'));
const t = L.getTarget(p, 'Assists');
const rows = Object.values(t.lists).find(l => l[0] === 'assisthits')[1];
const table = [];
for (let i = 0; i + 4 < rows.length; i += 5) table.push({ name: rows[i], dmg: rows[i + 1], x: rows[i + 2], y: rows[i + 3], iframes: rows[i + 4] });
const lookup = (costume) => table.find(r => costume.toLowerCase().includes(String(r.name).toLowerCase()));

// Rows no costume can ever match.
const names = t.costumes.map(c => c.name);
console.log('rows no costume matches:');
for (const r of table) if (!names.some(n => n.toLowerCase().includes(String(r.name).toLowerCase()))) console.log(`  "${r.name}" (${r.dmg} dmg)`);

// Each assist's block in the three dispatch procedures.
const blocks = new Map();
for (const proc of ['Assist 1-20 %s %s', 'Assist 20-40 %s %s', 'Assist 40-70 %s %s']) {
  const top = L.findScript(t, `DEFINE "${proc}"`);
  for (const id of L.findStmts(t, top, 'if (arg(#) = "')) {
    const m = /if \(arg\(#\) = "(\d+)"\) then/.exec(L.stmtHead(t, id));
    if (m) blocks.set(Number(m[1]), (blocks.get(Number(m[1])) || '') + L.stmtText(t, id) + '\n');
  }
}
const clone = L.findScripts(t, 'WHEN I START AS A CLONE').map(id => L.scriptText(t, id)).join('\n');
console.log('\nassist: damage paths | own costumes and the row each finds');
for (let n = 1; n <= 64; n++) {
  const text = blocks.get(n) || '';
  const paths = [];
  if (/call "SwitchCost[^"]*"\([^)]*"1", (arg\(#\)|"\d*")\)/.test(text)) paths.push('switchcost-dmg');
  if (/call "static move[^"]*"\(([^,]*,){4} "1"/.test(text)) paths.push('static-hit');
  if (/call "costumemove[^"]*"\(([^,]*,){6} "1"/.test(text)) paths.push('costumemove-hit');
  if (/call "Hit dmg/.test(text)) paths.push('direct-hit');
  if (/control_create_clone_of/.test(text)) paths.push('clones');
  if (/Heal Player/.test(text)) paths.push('heal');
  const own = names.filter(c => new RegExp(`^${n}Assist\\d`).test(c));
  const found = own.map(c => { const r = lookup(c); return `${c}=${r ? r.name : '-'}`; });
  console.log(`${String(n).padStart(2)}: ${paths.join(',') || '(none)'} | ${found.join(' ')}`);
}
console.log('\nclone script costume branches:', [...clone.matchAll(/costume_name, "([^"]+)"\)/g)].map(m => m[1]).filter((v, i, a) => a.indexOf(v) === i).join(', '));
