// Lists every visible sprite and clone with its costume, position and layer.
module.exports = async (h) => {
  const rows = await h.eval(() => {
    const r = vm.runtime;
    return r.targets.filter(t => t.visible && !t.isStage).map(t => {
      const d = r.renderer._allDrawables[t.drawableID];
      return [r.renderer._drawList.indexOf(t.drawableID), t.sprite.name, t.isOriginal ? '' : 'clone', t.getCostumes()[t.currentCostume].name,
        Math.round(t.x), Math.round(t.y), Math.round(t.size), d && d._uniforms ? Math.round(d._uniforms.u_ghost * 100) : ''];
    }).sort((a, b) => a[0] - b[0]);
  });
  for (const r of rows) h.log(r.join(' | '));
  h.log('stage backdrop', await h.eval(() => vm.runtime.getTargetForStage().getCostumes()[vm.runtime.getTargetForStage().currentCostume].name));
};
