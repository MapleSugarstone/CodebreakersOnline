// Reproduces the report that Stick and Birdii (fighter 12) can only move after dying and switching forms.
// Usage: npx tsx tools/repro-stick.ts [frames to wait before switching after the death]
import { createPort } from './lib/port.ts';

const switchDelay = Number(process.argv[2] ?? 150);
const rt = createPort(5);
rt.logPen = false;
rt.greenFlag();
const v = (n: string) => String(rt.stage.v[rt.stage.sprite.def.varNames?.[n] ?? n]);
const setv = (n: string, x: string | number) => (rt.stage.v[rt.stage.sprite.def.varNames![n]] = x);
const states = new Set<string>();
const step = (keys: string[] = []) => {
  rt.stepFrame([{ keys }]);
  states.add(v('P1state'));
};
const run = (n: number, keys: string[] = []) => {
  for (let i = 0; i < n; i++) step(keys);
};
const tap = (keys: string[], wait = 15) => {
  run(4, keys);
  run(wait);
};
const report = (label: string) => {
  console.log(`${label.padEnd(26)} f=${rt.frame} state=${v('P1state')} pmov=${v('1pmov')} HP=${v('1HP')} form=${v('gimmick1')} f1=${v('f1')} s1=${v('s1')} actionframes=${v('1actionframes')} seen=[${[...states].join(',')}]`);
  states.clear();
};

run(60, ['`']);
run(240);
tap(['N'], 150);
tap(['N'], 150);
tap(['N'], 150);
// Fighter 12 for Player 1; Player 2 stays on fighter 1 with the computer off.
for (let i = 0; i < 11; i++) tap(['right arrow'], 8);
tap(['N'], 15);
tap(['F'], 15);
tap(['space'], 15);
tap(['N'], 260);
report(`match fighters ${v('char1')}/${v('char2')}`);
tap(['N'], 40);
report('attack before');
tap(['down arrow', 'M'], 60);
report('switch before death');
tap(['N'], 40);
report('attack after switch');
setv('1HP', 0);
run(switchDelay);
report('after death');
tap(['down arrow', 'M'], 60);
report('switch after death');
for (let i = 0; i < 3; i++) {
  tap(['N'], 40);
  report(`attack ${i + 1} after death`);
}
tap(['M'], 40);
report('special after death');
