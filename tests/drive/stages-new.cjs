// Fights on stages 25 and 26, with fighter 48 on one of them so its own track starts.
const { toFightSettings, toCSS, startMatch, vars, key } = require('./lib.cjs');
module.exports = async (h) => {
  for (const [stage, c1, c2] of [[25, 46, 47], [26, 48, 44]]) {
    await toFightSettings(h);
    await h.setv('stage', String(stage));
    await h.wait(500);
    await h.shot(`stage${stage}-settings`);
    await toCSS(h);
    await startMatch(h, c1, c2);
    for (let i = 0; i < 20; i++) { await key(h, ['left arrow', 'n', 'right arrow', 'm', 'up arrow'][i % 5], 150); }
    await h.shot(`stage${stage}-fight`);
    h.log(`stage ${stage}:`, await vars(h, ['stage', 'stagemax', 'music', 'MusicDisplay', 'char1', 'char2', 'P1state', 'P2state', '1HP', '2HP']));
  }
};
