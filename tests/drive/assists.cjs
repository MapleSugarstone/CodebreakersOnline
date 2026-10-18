// Summons each assist for P1 against an idle P2 at the spawn positions and records the damage dealt, healing, and
// every hit testforhit logged. Needs out/assist-probe.sb3 (tools/assist-probe-build.cjs). ASSISTS="1,39,54" limits the run.
const fs = require('fs');
const path = require('path');
const { toFightSettings, toCSS, startMatch } = require('./lib.cjs');

module.exports = async (h) => {
  const list = (process.env.ASSISTS || Array.from({ length: 64 }, (_, i) => i + 1).join(',')).split(',').map(Number);
  const seconds = Number(process.env.ASSIST_SECONDS || 10);
  await toFightSettings(h);
  await h.setv('stage', '1');
  await toCSS(h);
  await h.setv('AIon?', '0');
  await startMatch(h, 1, 2);
  await h.wait(3000);
  const list_ = n => `Object.values(vm.runtime.getTargetForStage().variables).find(l => l.name === '${n}' && l.type === 'list')`;
  const start = await h.eval(new Function(`${list_('scores')}.value = ['99', '99'];
    const P = k => vm.runtime.targets.find(t => t.sprite.name === k && t.isOriginal);
    return { p1: window.v('1HP'), p2: window.v('2HP'), x1: P('P1').x, y1: P('P1').y, x2: P('P2').x, y2: P('P2').y };`));
  const results = [];
  for (const n of list) {
    await h.eval(new Function('n', `
      const rt = vm.runtime;
      for (const c of rt.targets.filter(t => t.sprite.name === 'Assists' && !t.isOriginal)) { rt.stopForTarget(c); rt.disposeTarget(c); }
      const P = k => rt.targets.find(t => t.sprite.name === k && t.isOriginal);
      P('P1').setXY(${start.x1}, ${start.y1}); P('P2').setXY(${start.x2}, ${start.y2});
      for (const v of ["1x'", "1y'", "2x'", "2y'"]) window.setv(v, '0');
      window.setv('1dir', '1'); window.setv('2dir', '-1');
      window.setv('1HP', ${start.p1}); window.setv('2HP', ${start.p2}); window.setv('1iframes', '0'); window.setv('2iframes', '0');
      window.setv('helper1', String(n));
      ${list_('assistlog')}.value = [];
      rt.startHats('event_whenbroadcastreceived', { BROADCAST_OPTION: 'SummonAssist1' });
    `), n);
    await h.wait(seconds * 1000);
    const r = await h.eval(new Function(`const P = k => vm.runtime.targets.find(t => t.sprite.name === k && t.isOriginal);
      return { p1: window.v('1HP'), p2: window.v('2HP'), x2: Math.round(P('P2').x), log: ${list_('assistlog')}.value.slice() };`));
    const counts = {};
    for (const e of r.log) counts[e] = (counts[e] || 0) + 1;
    const row = { n, dealt: +(start.p2 - r.p2).toFixed(2), healed: +(r.p1 - start.p1).toFixed(2), p2x: r.x2, hits: counts };
    results.push(row);
    h.log(JSON.stringify(row));
  }
  fs.writeFileSync(path.resolve(__dirname, '../../out/assist-results.json'), JSON.stringify(results, null, 1));
};
