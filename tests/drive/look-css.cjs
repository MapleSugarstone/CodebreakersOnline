// Screens from boot to character select, for comparing the two projects' menus.
module.exports = async (h) => {
  await h.wait(3000);
  await h.shot('boot');
  for (let i = 0; i < 6; i++) {
    await h.press('n');
    await h.wait(1500);
    await h.shot(`n${i}`);
    h.log('menu', await h.v('menu'), 'gamemode', await h.v('gamemode'), 'CurrentTab', await h.v('CurrentTab'));
  }
};
