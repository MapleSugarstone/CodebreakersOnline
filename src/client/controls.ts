// Seat keys for online games. The game reads fixed keys for each player, so online every player's own
// presses are translated to their seat's keys before they are sent. A player may use either player's
// layout on their own keyboard.

/** The fighter buttons, in the order the layouts below list their keys. */
export const ACTIONS = ['Left', 'Right', 'Up', 'Down', 'Attack', 'Special', 'Dodge'];

/** The keys the game reads for each seat: Player 1, then Player 2. */
export const SEAT_KEYS: string[][] = [
  ['left arrow', 'right arrow', 'up arrow', 'down arrow', 'N', 'M', 'B'],
  ['A', 'D', 'W', 'S', 'F', 'G', 'H'],
];

/** Player 1's second set of keys, which the game also reads (number keys and Z, X, C). */
const P1_ALT = ['4', '6', '8', '5', 'X', 'C', 'Z'];

/** Every layout a player may press online. Each maps to their own seat's keys. */
export const LAYOUTS: string[][] = [SEAT_KEYS[0], P1_ALT, SEAT_KEYS[1]];

const BOUND = new Set(LAYOUTS.flat());

/**
 * Replaces each pressed layout key with the seat's key for the same button. Other keys (space, E, Q and
 * the rest of the menu keys) pass through unchanged, so either player can press them.
 */
export function translateKeys(pressed: string[], seat: number): string[] {
  const out = new Set<string>();
  const target = SEAT_KEYS[seat];
  for (const layout of LAYOUTS) layout.forEach((k, i) => pressed.includes(k) && out.add(target[i]));
  for (const k of pressed) if (!BOUND.has(k)) out.add(k);
  return [...out];
}

/** The seat's keys for the buttons a controller or touch control holds, by action name. */
export function actionKeys(actions: string[], seat: number): string[] {
  return actions.map((a) => SEAT_KEYS[seat][ACTIONS.indexOf(a)]).filter((k) => k !== undefined);
}
