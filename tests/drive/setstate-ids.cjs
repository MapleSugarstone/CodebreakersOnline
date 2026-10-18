// Shows how the running VM sees P2's setstate prototype and the calls to it.
module.exports = async (h) => {
  const r = await h.eval(() => {
    const t = vm.runtime.targets.find(t => t.sprite.name === 'P2' && t.isOriginal);
    const B = t.blocks._blocks;
    const pc = 'setstate %b %b %b %b %b %b';
    const protos = Object.values(B).filter(b => b.opcode === 'procedures_prototype' && b.mutation.proccode === pc).map(b => [b.id, b.mutation.argumentids, b.parent]);
    const calls = Object.values(B).filter(b => b.opcode === 'procedures_call' && b.mutation.proccode === pc).map(b => [b.id, b.mutation.argumentids, Object.keys(b.inputs)]);
    return { cached: t.blocks.getProcedureParamNamesIdsAndDefaults(pc), protos, calls };
  });
  h.log(JSON.stringify(r, null, 1));
};
