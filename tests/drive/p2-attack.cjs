// From PK's character select: P2 becomes human, both confirm, and the fight starts. Then each player presses
// their light attack and the script records the state each one reaches.
module.exports = async (h) => {
  await h.setv('AIon?', '0');
  await h.press('n'); await h.wait(500);
  await h.press('f'); await h.wait(500);
  h.log('menu', await h.v('menu'), 'AIon', await h.v('AIon?'));
  await h.press('n');
  await h.wait(7000);
  const watch = async (who, key) => {
    const seen = new Set();
    await h.hold(key, true);
    for (let i = 0; i < 12; i++) { seen.add(await h.v(`P${who}state`)); await h.wait(40); }
    await h.hold(key, false);
    for (let i = 0; i < 12; i++) { seen.add(await h.v(`P${who}state`)); await h.wait(40); }
    return [...seen];
  };
  h.log('P1 light (n):', await watch(1, 'n'));
  await h.wait(800);
  h.log('P2 light (f):', await watch(2, 'f'));
  await h.wait(800);
  h.log('P2 special (g):', await watch(2, 'g'));
  await h.wait(800);
  h.log('P1 special (m):', await watch(1, 'm'));
  await h.shot('p2-attack');
};
