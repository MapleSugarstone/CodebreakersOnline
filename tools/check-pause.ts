// Checks the pause menu in the port: pausing freezes the match and its clock, resuming continues it, and quitting
// goes to character select, from which a new match starts.
// Usage: npx tsx tools/check-pause.ts
import { createPort } from './lib/port.ts';

const rt = createPort(3);
rt.logPen = false;
rt.greenFlag();
const v = (n: string) => String(rt.stage.v[rt.stage.sprite.def.varNames?.[n] ?? n]);
const run = (n: number, keys: string[] = []) => {
  for (let i = 0; i < n; i++) rt.stepFrame([{ keys }]);
};
const tap = (key: string, wait = 15) => {
  run(3, [key]);
  run(wait);
};
const p1 = () => rt.targets.find((t) => t.name === 'P1' && t.isOriginal)!;
const show = (label: string) =>
  console.log(`${label.padEnd(22)} f=${rt.frame} paused=${rt.paused} clock=${rt.currentMSecs - rt.t0} menu=${v('menu')} P1=${v('P1state')} x=${p1().x.toFixed(1)} HP=${v('1HP')}/${v('2HP')}`);
let failures = 0;
const expect = (ok: boolean, what: string) => {
  if (!ok) failures++;
  console.log(`  ${ok ? 'ok' : 'FAILED'}: ${what}`);
};

run(60, ['`']);
run(240);
tap('N', 150);
tap('N', 150);
tap('N', 150);
tap('N', 15);
tap('F', 15);
tap('N', 300);
show('match');
tap('P', 5);
show('paused');
expect(rt.paused, 'P pauses the match');
const clock = rt.currentMSecs, x = p1().x, hp = v('2HP');
run(90, ['right arrow', 'N']);
show('paused 90 frames');
expect(rt.currentMSecs === clock && p1().x === x && v('2HP') === hp, 'nothing moves and the clock stands still while paused');
tap('P', 30);
show('resumed');
expect(!rt.paused && rt.currentMSecs > clock, 'P again resumes and the clock runs');
tap('P', 5);
tap('K', 300);
show('quit');
expect(!rt.paused && v('menu') !== '4', 'K while paused leaves the match');
tap('N', 15);
tap('F', 15);
tap('N', 300);
show('new match');
expect(v('menu') === '4' && v('quitmatch') === '0', 'a new match starts from character select');
console.log(failures ? `${failures} checks failed` : 'pause checks pass');
process.exitCode = failures ? 1 : 0;
