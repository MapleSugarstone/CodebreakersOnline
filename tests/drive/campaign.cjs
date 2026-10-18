// Campaign with fighter 44: main menu, Minigames, campaign, select, difficulty, route screen, first fight.
const { toMainMenu, key, vars } = require('./lib.cjs');
module.exports = async (h) => {
  const c = process.env.CAMPAIGN_FIGHTER || '44';
  await toMainMenu(h);
  await key(h, 'right arrow');
  await key(h, 'n', 3000);
  await h.shot(`campaign${c}-1-minigames`);
  h.log('minigames:', await vars(h, ['menu']));
  await key(h, 'n', 3500);
  await h.setv('char1', c);
  await h.wait(800);
  await h.shot(`campaign${c}-2-css`);
  h.log('css:', await vars(h, ['gamemode', 'menu', 'char1']));
  await key(h, 'n', 600);
  await key(h, 'n', 4000);
  await h.shot(`campaign${c}-3-difficulty`);
  await key(h, 'n', 4000);
  await h.shot(`campaign${c}-4-roadmap`);
  h.log('roadmap:', await vars(h, ['campaignfight#', 'campaigndiff', 'char2', 'stage']));
  await key(h, 'n', 7000);
  await h.shot(`campaign${c}-5-fight1`);
  h.log('fight 1:', await vars(h, ['campaignfight#', 'char1', 'char2', 'stage', 'music', '1HP', '2HP']));
};
