// The pause menu's rules for this game. P (Escape on the page) pauses and resumes, and K while paused quits to
// character select. The game reads neither key. The match counts as running while the stage's menu step is 4 and
// either fighter can still move, so the countdown and the end of a match are not pausable.
import type { PauseRule, Runtime } from '../engine/runtime.ts';

function stageVar(rt: Runtime, name: string): string {
  return String(rt.stage.v[rt.stage.sprite.def.varNames?.[name] ?? name]);
}

export const pauseRule: PauseRule = {
  pauseKey: 'P',
  quitKey: 'K',
  canPause: (rt) => stageVar(rt, 'menu') === '4' && (stageVar(rt, '1pmov') === '0' || stageVar(rt, '2pmov') === '0'),
  // The game's QuitMatch script (added by tools/merge/hand.cjs) ends the match and opens character select.
  quit: (rt) => rt.broadcast('QuitMatch'),
};
