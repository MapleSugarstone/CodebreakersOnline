// Prints the runtime's clock, thread count and both fighters' sprite state.
module.exports = async (h) => {
  const r = await h.eval(() => {
    const rt = vm.runtime;
    const sp = n => { const t = rt.targets.find(t => t.sprite.name === n && t.isOriginal); return t && { x: Math.round(t.x), y: Math.round(t.y), visible: t.visible, costume: t.getCostumes()[t.currentCostume].name }; };
    return { timer: rt.ioDevices.clock.projectTimer(), threads: rt.threads.length, P1: sp('P1'), P2: sp('P2'), errors: window.errors.slice(-5) };
  });
  h.log(JSON.stringify(r));
  const names = ['freezetime', 'menu', 'weekly', '1HP', '2HP', 'P1state', 'P2state', '1pmov', '2pmov', 'memory', 'time', 'outro'];
  const vals = {};
  for (const n of names) vals[n] = await h.v(n);
  h.log(JSON.stringify(vals));
  h.log('scores', JSON.stringify(await h.eval(() => { const s = vm.runtime.getTargetForStage(); return Object.values(s.lists).find(l => l.name === 'scores').value; })));
  await h.wait(2000);
  h.log('timer after 2 s', await h.eval(() => vm.runtime.ioDevices.clock.projectTimer()));
};
