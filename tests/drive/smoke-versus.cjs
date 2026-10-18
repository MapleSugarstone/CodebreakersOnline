// Boots to the title, goes through the main menu and fight setup to character select, picks fighters by setting
// char1/char2 directly, and fights for a few seconds while both players press keys. Screenshots each step.
// Set SMOKE_C1 / SMOKE_C2 / SMOKE_STAGE in the environment to choose.
module.exports = async (h) => {
  const c1 = process.env.SMOKE_C1 || '44', c2 = process.env.SMOKE_C2 || '45', stage = process.env.SMOKE_STAGE || '1';
  const tag = `${c1}v${c2}s${stage}`;
  // CB preloads every costume on the first flag unless Assetload already reads 18; PK has no preload.
  await h.eval(() => { vm.stopAll(); window.setv('Assetload', '18'); vm.greenFlag(); });
  await h.wait(2500);
  await h.shot(`${tag}-0-title`);
  await h.press('n');
  await h.wait(4000);
  await h.shot(`${tag}-1-mainmenu`);
  h.log('after title: menu', await h.v('menu'), 'tutorial', await h.v('tutorial'));
  await h.press('n');
  await h.wait(3000);
  await h.shot(`${tag}-2-fightsetup`);
  await h.setv('stage', stage);
  await h.press('n');
  await h.wait(3500);
  await h.setv('char1', c1);
  await h.setv('char2', c2);
  await h.wait(500);
  await h.shot(`${tag}-3-css`);
  await h.press('n');
  await h.wait(600);
  await h.press('f');
  await h.wait(600);
  h.log('css menu', await h.v('menu'));
  await h.shot(`${tag}-4-ready`);
  await h.press('n');
  await h.wait(6000);
  await h.shot(`${tag}-5-countdown`);
  const keys = ['left arrow', 'right arrow', 'up arrow', 'n', 'm', 'a', 'd', 'w', 'f', 'g'];
  for (let i = 0; i < 40; i++) {
    const k = keys[i % keys.length];
    await h.press(k, 150);
    if (i % 3 === 0) await h.press(i % 2 ? 'n' : 'f', 80);
    await h.wait(100);
    if (i === 20) await h.shot(`${tag}-6-fight`);
  }
  await h.shot(`${tag}-7-fight`);
  h.log('state', await h.v('P1state'), await h.v('P2state'), 'HP', await h.v('1HP'), await h.v('2HP'), 'chars', await h.v('char1'), await h.v('char2'), 'stage', await h.v('stage'));
};
