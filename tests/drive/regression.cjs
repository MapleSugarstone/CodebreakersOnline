// CB content that must survive the merge: an original matchup on the moving-platform stage, a timed match,
// Randomizer, Training and the Extras screen.
const { toMainMenu, toFightSettings, toCSS, startMatch, key, vars } = require('./lib.cjs');
module.exports = async (h) => {
  // Original fighters on stage 23 (its platform moves) in a 2-minute timed match.
  await toFightSettings(h);
  await h.setv('stage', '23');
  await key(h, 'down arrow');
  await key(h, 'right arrow');
  await key(h, 'down arrow');
  await key(h, 'right arrow');
  h.log('timed settings:', await vars(h, ['stage', 'weekly']), JSON.stringify(await h.eval(() => Object.values(vm.runtime.getTargetForStage().variables).length)));
  await h.shot('reg-1-settings');
  await toCSS(h);
  await startMatch(h, 1, 2);
  for (let i = 0; i < 15; i++) await key(h, ['right arrow', 'n', 'up arrow', 'm'][i % 4], 150);
  await h.shot('reg-2-timed');
  h.log('timed match:', await vars(h, ['stage', 'time', 'memory', 'char1', 'char2', 'P1state', '1HP', '2HP']));

  // Randomizer from Minigames: fighters are rolled at the start.
  await toMainMenu(h);
  await key(h, 'right arrow');
  await key(h, 'n', 3000);
  await key(h, 'left arrow');
  h.log('minigames menu:', await vars(h, ['menu']));
  await key(h, 'n', 3500);
  await h.shot('reg-3-randomizer-settings');
  await key(h, 'n', 3500);
  await h.shot('reg-4-randomizer-css');
  h.log('randomizer:', await vars(h, ['gamemode', 'weekly', 'char1', 'char2', 'menu']));

  // Training from Minigames.
  await toMainMenu(h);
  await key(h, 'right arrow');
  await key(h, 'n', 3000);
  await key(h, 'right arrow');
  await key(h, 'n', 5000);
  await h.shot('reg-5-training');
  h.log('training:', await vars(h, ['gamemode', 'char1', 'char2', 'AIon?']));

  // Extras from the main menu (tile 4).
  await toMainMenu(h);
  for (let i = 0; i < 3; i++) await key(h, 'right arrow');
  await key(h, 'n', 3000);
  await h.shot('reg-6-extras');
  h.log('extras:', await vars(h, ['menu', 'CurrentTab']));
};
