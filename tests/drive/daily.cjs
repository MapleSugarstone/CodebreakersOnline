// Daily challenge: picks it on the gamemode row, starts from character select, wins round 1 by draining the
// challenger's HP, and checks round 2 starts with a new challenger and stage.
const { toFightSettings, key, vars } = require('./lib.cjs');
module.exports = async (h) => {
  await toFightSettings(h);
  await key(h, 'down arrow');
  await key(h, 'right arrow');
  await key(h, 'right arrow');
  await h.wait(500);
  await h.shot('daily-1-settings');
  h.log('settings:', await vars(h, ['weekly', 'menu', 'gamemode']));
  await key(h, 'n', 3500);
  await h.shot('daily-2-css');
  h.log('css:', await vars(h, ['weekly', 'menu', 'char2', 'Daily Champion:']));
  await h.setv('char1', '44');
  await key(h, 'n', 600);
  h.log('ready:', await vars(h, ['menu']));
  await key(h, 'n', 6000);
  await h.shot('daily-3-round1');
  h.log('round 1:', await vars(h, ['weekly', 'weeklyRounds', 'weeklyFighter', 'char2', 'stage', 'AIon?', 'AIIntensity', '2HPmod', '2HP']));
  // A ring-out: the engine KOs a fighter touching the edge below y -178.
  for (let i = 0; i < 40 && (await h.v('P2state')) !== 'Blowaway'; i++) {
    await h.eval(() => { const t = vm.runtime.targets.find(t => t.sprite.name === 'P2' && t.isOriginal); t.setXY(t.x, -260); });
    await h.wait(100);
  }
  h.log('after ring-out:', await vars(h, ['P2state', '2HP']));
  await h.wait(9000);
  await h.shot('daily-4-results');
  h.log('results:', await vars(h, ['whoWon?', 'Score:', 'weeklyRounds']));
  await key(h, 'n', 8000);
  await h.shot('daily-5-round2');
  h.log('round 2:', await vars(h, ['weekly', 'weeklyRounds', 'weeklyFighter', 'char2', 'stage', '2HPmod', '2HP']));
};
