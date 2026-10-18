// Summons one assist during a match and samples the assist clones, both fighters and the hit log every half second.
const { toFightSettings, toCSS, startMatch } = require('./lib.cjs');
module.exports = async (h) => {
  const n = String(JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'params.json'), 'utf8')).assist);
  await toFightSettings(h);
  await h.setv('stage', '1');
  await toCSS(h);
  await h.setv('AIon?', '0');
  await startMatch(h, 1, 2);
  await h.wait(3000);
  await h.shot('assist-debug-0');
  await h.eval((n) => {
    const rt = vm.runtime;
    window.setv('helper1', String(n));
    rt.startHats('event_whenbroadcastreceived', { BROADCAST_OPTION: 'SummonAssist1' });
  }, n);
  for (let i = 0; i < 16; i++) {
    await h.wait(500);
    const s = await h.eval(() => {
      const rt = vm.runtime;
      const a = rt.targets.filter(t => t.sprite.name === 'Assists');
      const P = k => { const t = rt.targets.find(t => t.sprite.name === k && t.isOriginal); return `${Math.round(t.x)},${Math.round(t.y)}`; };
      const log = Object.values(rt.getTargetForStage().variables).find(l => l.name === 'assistlog' && l.type === 'list');
      return { clones: a.map(t => `${t.isOriginal ? 'O' : 'C'}:${t.getCostumes()[t.currentCostume].name}@${Math.round(t.x)},${Math.round(t.y)}${t.visible ? '' : '(h)'}`), P1: P('P1'), P2: P('P2'), hp: [window.v('1HP'), window.v('2HP')], log: log && log.value.slice(-4), states: [window.v('P1state'), window.v('P2state')], helper1: window.v('helper1') };
    });
    h.log(JSON.stringify(s));
    if (i === 3) await h.shot('assist-debug-1');
  }
};
