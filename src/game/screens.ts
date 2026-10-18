// Which screen the game shows, for the page's pause menu and online key handling. Character select and fights
// read Player 1's and Player 2's keys separately. Every other menu reads only Player 1's, so online both players'
// keys become Player 1's there and either player can move the selection.
import type { Runtime } from '../engine/runtime.ts';

function stageVar(rt: Runtime, name: string): string {
  return String(rt.stage.v[rt.stage.sprite.def.varNames?.[name] ?? name]);
}

/** A fight in any mode (versus, training, campaign, daily). Every fight backdrop is named stage<n>. */
export function inFight(rt: Runtime): boolean {
  return rt.stage.costumeName().startsWith('stage');
}

/** A fight that is still being played: one of the fighters can move, so it is not ending. */
export function fightRunning(rt: Runtime): boolean {
  return inFight(rt) && (stageVar(rt, '1pmov') === '0' || stageVar(rt, '2pmov') === '0');
}

/** Character select, or a fight. MenuUI wears costume24 on character select (and on the results screen, from menu step 4). */
export function seatScreen(rt: Runtime): boolean {
  if (inFight(rt)) return true;
  const menuUI = rt.sprites.find((s) => s.name === 'MenuUI')?.original;
  return !!menuUI && menuUI.costumeName() === 'costume24' && menuUI.visible && stageVar(rt, 'menu') !== '4';
}
