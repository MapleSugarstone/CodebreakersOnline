// Shared steps for driving the merged build.
// Restarts with CB's costume preload marked done, then waits on the title.
async function boot(h) {
  // Pages loaded before player.html mapped key names get the mapping here too.
  await h.eval(() => {
    const browserKey = k => ({ 'up arrow': 'ArrowUp', 'down arrow': 'ArrowDown', 'left arrow': 'ArrowLeft', 'right arrow': 'ArrowRight', space: ' ', enter: 'Enter' }[k] || k);
    window.press = (k, ms = 100) => new Promise(r => { vm.postIOData('keyboard', { key: browserKey(k), isDown: true }); setTimeout(() => { vm.postIOData('keyboard', { key: browserKey(k), isDown: false }); r(); }, ms); });
    window.hold = (k, down) => vm.postIOData('keyboard', { key: browserKey(k), isDown: down });
  });
  await h.eval(() => { vm.stopAll(); window.setv('Assetload', '18'); vm.greenFlag(); });
  await h.wait(2500);
}
async function key(h, k, waitMs = 400) { await h.press(k, 350); await h.wait(waitMs); }
// Title to main menu (menu 1 = Fight).
async function toMainMenu(h) { await boot(h); await key(h, 'n', 4000); }
async function toFightSettings(h) { await toMainMenu(h); await key(h, 'n', 3000); }
// From Fight Settings to character select.
async function toCSS(h) { await key(h, 'n', 3500); }
// Picks fighters, readies both sides, and starts the match. Works in versus (CPU on P2).
async function startMatch(h, c1, c2) {
  await h.setv('char1', String(c1));
  if (c2 !== undefined) await h.setv('char2', String(c2));
  await key(h, 'n', 600);
  await key(h, 'f', 600);
  await key(h, 'n', 6000);
}
const vars = (h, names) => Promise.all(names.map(n => h.v(n))).then(vals => Object.fromEntries(names.map((n, i) => [n, vals[i]])));
module.exports = { boot, key, toMainMenu, toFightSettings, toCSS, startMatch, vars };
