import './style.css';
import { Game, startFixedLoop } from './game.ts';
import { LocalInput } from './input.ts';
import type { PlayerInput } from '../engine/io.ts';

const stageWrap = document.getElementById('stage-wrap')!;
const canvas = document.getElementById('stage') as HTMLCanvasElement;
const overlay = document.getElementById('overlay')!;
const status = document.getElementById('status')!;
const start = document.getElementById('start') as HTMLButtonElement;

function fitStage(): void {
  const pad = 16;
  const hudSpace = 28;
  const w = Math.max(240, window.innerWidth - pad * 2);
  const h = Math.max(180, window.innerHeight - pad * 2 - hudSpace);
  const scale = Math.min(w / 480, h / 360);
  const cssW = Math.floor(480 * scale);
  const cssH = Math.floor(360 * scale);
  stageWrap.style.width = `${cssW}px`;
  stageWrap.style.height = `${cssH}px`;
  document.documentElement.style.setProperty('--stage-w', `${cssW}px`);
  document.documentElement.style.setProperty('--stage-h', `${cssH}px`);
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
}

/** Local time expressed in UTC fields, so the date blocks read the player's wall clock. */
function localT0(): number {
  const now = Date.now();
  return now - new Date(now).getTimezoneOffset() * 60_000;
}

fitStage();
window.addEventListener('resize', fitStage);

const game = new Game(canvas, overlay, { seed: crypto.getRandomValues(new Uint32Array(1))[0], t0: localT0() });
const input = new LocalInput(stageWrap);
game.question.onFocusChange = (f) => (input.enabled = !f);
const resumeAudio = () => game.audio.resume();
window.addEventListener('pointerdown', resumeAudio);
window.addEventListener('keydown', resumeAudio);
(window as unknown as { __game: Game }).__game = game;

function sampleLocal(): PlayerInput {
  const p0: PlayerInput = { keys: input.sampleKeys() };
  if (input.mouseDirty) {
    p0.mouse = { ...input.mouse };
    input.mouseDirty = false;
  }
  if (game.question.pendingAnswer !== undefined) {
    p0.answer = game.question.pendingAnswer;
    game.question.pendingAnswer = undefined;
  }
  return p0;
}

status.hidden = false;
await game.load((text) => (status.textContent = text));
status.textContent = 'Images keep loading in the background.';
start.hidden = false;
start.focus();
// Browsers allow sound only after the player interacts with the page, so the game starts on a click or key.
const begin = () => {
  start.hidden = true;
  game.audio.resume();
  startFixedLoop(
    () => game.step([sampleLocal()]),
    () => game.present(),
  );
};
start.addEventListener('click', begin, { once: true });
