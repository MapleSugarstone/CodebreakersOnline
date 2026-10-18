// Compares each assist's block (and each clone-script branch) across the older builds and the merged build.
// Prints line counts per version and marks the ones that differ.
const path = require('path');
const L = require('./merge/sb3.cjs');

const root = path.resolve(__dirname, '..');
// Oldest first, merged build last. Each row gives a letter per build, and builds with the same letter have the same code.
const versions = [['sss', 'work/old-sss'], ['srcast', 'work/old-srcast'], ['revival', 'work/old-revival'], ['remix', 'work/old-remix'], ['cb', 'work/cb'], ['now', 'out/merged']].map(([k, d]) => [k, L.loadProject(path.join(root, d))]);

function assistBlocks(p) {
  const t = L.getTarget(p, 'Assists');
  const out = new Map();
  for (const proc of ['Assist 1-20 %s %s', 'Assist 20-40 %s %s', 'Assist 40-70 %s %s']) {
    const top = L.findScript(t, `DEFINE "${proc}"`);
    for (const id of L.findStmts(t, top, 'if (arg(#) = "')) {
      const m = /^if \(arg\(#\) = "(\d+)"\) then$/.exec(L.stmtHead(t, id));
      if (m && t.blocks[id].parent && L.findStmts(t, top, '').length) out.set(`#${m[1]}`, L.stmtText(t, id));
    }
  }
  // Branches of the clone scripts keyed by their condition.
  for (const top of L.findScripts(t, 'WHEN I START AS A CLONE')) {
    const walk = (id, depth) => {
      while (id) {
        const head = L.stmtHead(t, id);
        if (/^if strcontains\(costume_name, "|^if \(strcontains\(costume_name, "|^if \(costume_name = "/.test(head)) out.set(`clone ${head}`, L.stmtText(t, id));
        const b = t.blocks[id];
        if (depth < 1 && b.inputs.SUBSTACK && b.inputs.SUBSTACK[1]) walk(b.inputs.SUBSTACK[1], depth + 1);
        id = b.next;
      }
    };
    walk(t.blocks[top].next, 0);
  }
  for (const top of L.topScripts(t)) {
    const h = L.hatText(t, top);
    if (h.startsWith('DEFINE') && !/Assist (1-20|20-40|40-70)/.test(h)) out.set(h.replace(/ \[.*$/, ''), L.scriptText(t, top));
  }
  return out;
}

const maps = versions.map(([k, p]) => [k, assistBlocks(p)]);
const keys = [...new Set(maps.flatMap(([, m]) => [...m.keys()]))];
const count = s => (s ? s.split('\n').length : 0);
const rows = [];
for (const key of keys) {
  const texts = maps.map(([, m]) => m.get(key));
  if (texts.every((t) => t === texts[texts.length - 1])) continue;
  const seen = [];
  const letters = texts.map((t) => {
    if (t === undefined) return '-';
    let i = seen.indexOf(t);
    if (i < 0) i = seen.push(t) - 1;
    return 'ABCDEFGH'[i];
  });
  rows.push(`${key.slice(0, 60).padEnd(60)} ${letters.join('')}  ${maps.map(([k], i) => `${k} ${String(count(texts[i])).padStart(3)}`).join('  ')}`);
}
console.log(`order: ${maps.map(([k]) => k).join(' ')}`);
console.log(rows.join('\n'));
