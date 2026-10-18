// The pause menu's rules for this game. P (Escape on the page) pauses and resumes a running fight, and K while
// paused quits to character select. The game reads neither key.
import type { PauseRule } from '../engine/runtime.ts';
import { fightRunning } from './screens.ts';

export const pauseRule: PauseRule = {
  pauseKey: 'P',
  quitKey: 'K',
  canPause: fightRunning,
  // The game's QuitMatch script (added by tools/merge/hand.cjs) ends the fight and opens character select.
  quit: (rt) => rt.broadcast('QuitMatch'),
};
