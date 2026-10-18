// Prints a line diff of one assist block or clone branch between two builds: node tools/assist-versions-diff.cjs <key> [from=sss] [to=now]
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const L = require('./merge/sb3.cjs');

const root = path.resolve(__dirname, '..');
const dirs = { sss: 'work/old-sss', srcast: 'work/old-srcast', revival: 'work/old-revival', remix: 'work/old-remix', cb: 'work/cb', now: 'out/merged' };
const [, , key, from = 'sss', to = 'now'] = process.argv;

function find(p, key) {
  const t = L.getTarget(p, 'Assists');
  const m = /^#(\d+)$/.exec(key);
  if (m) {
    for (const proc of ['Assist 1-20 %s %s', 'Assist 20-40 %s %s', 'Assist 40-70 %s %s']) {
      const top = L.findScript(t, `DEFINE "${proc}"`);
      const s = L.findStmts(t, top, `if (arg(#) = "${m[1]}") then`).filter(id => L.stmtHead(t, id) === `if (arg(#) = "${m[1]}") then`);
      if (s.length) return L.stmtText(t, s[0]);
    }
    return '';
  }
  for (const top of L.findScripts(t, 'WHEN I START AS A CLONE')) {
    const s = L.findStmts(t, top, key.replace(/^clone /, ''));
    if (s.length) return L.stmtText(t, s[0]);
  }
  return '';
}
const a = find(L.loadProject(path.join(root, dirs[from])), key), b = find(L.loadProject(path.join(root, dirs[to])), key);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'avd-'));
fs.writeFileSync(path.join(tmp, from), a + '\n');
fs.writeFileSync(path.join(tmp, to), b + '\n');
try { execFileSync('diff', ['-u', path.join(tmp, from), path.join(tmp, to)]); console.log('same'); }
catch (e) { console.log(e.stdout.toString().split('\n').slice(2).join('\n')); }
fs.rmSync(tmp, { recursive: true });
