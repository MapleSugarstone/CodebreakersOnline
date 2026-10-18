// Round-trips every script body of a project through the assembler and reports the ones that do not print back the same.
const path = require('path');
const L = require('./sb3.cjs');
const { learnShapes, asm } = require('./asm.cjs');

const root = path.resolve(__dirname, '../..');
const p = L.loadProject(path.join(root, process.argv[2] || 'work/cb'));
learnShapes(p, L.loadProject(path.join(root, 'work/pk')));
const ids = new L.Ids(p);
let ok = 0, bad = 0, failed = 0;
const examples = [];
for (const t of p.targets) {
  for (const top of L.topScripts(t)) {
    const text = L.scriptText(t, top);
    if (!text.trim() || text.includes('?missing')) continue;
    try {
      const first = asm(p, t, ids, text);
      // Print the new chain the same way scriptText does: hang it off a throwaway hat.
      const hat = ids.next();
      t.blocks[hat] = { opcode: 'event_whenflagclicked', next: first, parent: null, inputs: {}, fields: {}, shadow: false, topLevel: true, x: 0, y: 0 };
      if (first) t.blocks[first].parent = hat;
      const back = L.scriptText(t, hat);
      L.removeScript(t, hat);
      if (back === text) ok++;
      else {
        bad++;
        if (examples.length < 5) {
          const a = text.split('\n'), b = back.split('\n');
          const i = a.findIndex((l, k) => l !== b[k]);
          examples.push(`${t.name} ${L.hatText(t, top).slice(0, 60)}\n  want: ${a[i]}\n  got:  ${b[i]}`);
        }
      }
    } catch (e) {
      failed++;
      if (examples.length < 8) examples.push(`${t.name} ${L.hatText(t, top).slice(0, 60)}: ${e.message}`);
    }
  }
}
console.log(`same ${ok}, different ${bad}, failed ${failed}`);
console.log(examples.join('\n'));
