// Owns one simulation plus everything that presents it: renderer, audio and overlays.
import { Runtime, FRAME_MS } from '../engine/runtime.ts';
import type { PlayerInput } from '../engine/io.ts';
import { modules, monitors } from '../game/generated/index.ts';
import { skins } from '../game/assets.ts';
import { installSilhouettes, type SilhouetteData } from '../game/silhouettes.ts';
import silhouetteData from '../game/silhouettes-data.json';
import { WebGLRenderer } from '../render/webgl.ts';
import { AudioOut } from './audio.ts';
import { Bubbles, ListMonitors, QuestionBox, VarMonitors } from './overlays.ts';

export const ASSET_BASE = `${import.meta.env.BASE_URL}assets/`;

/**
 * Adds the game's own loading-screen skip key (backtick) for the first frames. The loading screen makes the
 * original editor rasterize every costume, which the page does behind the lobby instead. The game reads the
 * key once, at frame 40.
 */
export function skipLoadScreen(keys: string[], frame: number): string[] {
  return frame < 60 && !keys.includes('`') ? [...keys, '`'] : keys;
}

export interface GameOptions {
  seed: number;
  /** Simulation start time; also drives the date blocks. */
  t0: number;
}

export class Game {
  rt: Runtime;
  renderer: WebGLRenderer;
  audio: AudioOut;
  question: QuestionBox;
  lists: ListMonitors;
  vars: VarMonitors;
  bubbles: Bubbles;

  constructor(
    public canvas: HTMLCanvasElement,
    public overlay: HTMLElement,
    opts: GameOptions,
  ) {
    this.rt = Game.createRuntime(opts);
    this.renderer = new WebGLRenderer(canvas, skins);
    this.audio = new AudioOut();
    this.question = new QuestionBox(overlay);
    this.lists = new ListMonitors(overlay, monitors);
    this.vars = new VarMonitors(overlay, monitors);
    this.bubbles = new Bubbles(overlay);
  }

  static createRuntime(opts: GameOptions): Runtime {
    const rt = new Runtime(modules, skins, { seed: opts.seed, t0: opts.t0 });
    installSilhouettes(rt, silhouetteData as unknown as SilhouetteData);
    rt.greenFlag();
    return rt;
  }

  /**
   * Starts loading and decoding every image and sound, and resolves once the first screen's images are in.
   * `onProgress` hears about all of them, including those that finish after this resolves.
   */
  async load(onProgress: (done: number, total: number) => void): Promise<void> {
    const counts = { images: [0, skins.length], sounds: [0, this.rt.sprites.reduce((n, s) => n + s.sounds.length, 0)] };
    const report = () => onProgress(counts.images[0] + counts.sounds[0], counts.images[1] + counts.sounds[1]);
    this.renderer.startLoading(ASSET_BASE, (d, n) => ((counts.images = [d, n]), report()));
    this.audio.startLoading(this.rt, ASSET_BASE, (d, n) => ((counts.sounds = [d, n]), report()));
    const first = this.rt.drawList.filter((t) => t.visible).map((t) => t.sprite.costumes[t.currentCostume].skin);
    await this.renderer.loadNow([this.rt.stage.sprite.costumes[this.rt.stage.currentCostume].skin, ...first]);
  }

  step(inputs: PlayerInput[]): void {
    this.rt.stepFrame(inputs);
  }

  present(): void {
    this.audio.apply(this.rt.soundEvents);
    this.audio.sync(this.rt.currentMSecs);
    this.renderer.render(this.rt);
    this.question.update(this.rt);
    this.lists.update(this.rt);
    this.vars.update(this.rt);
    this.bubbles.update(this.rt);
  }
}

/**
 * Frame scheduler run in a worker: one message per frame, due every FRAME_MS, posted with its due
 * time. Due times advance by exactly FRAME_MS, so timer lateness never accumulates into drift.
 */
const PACER = `
const step = ${FRAME_MS};
const clock = () => performance.timeOrigin + performance.now();
let next = clock() + step;
const loop = () => {
  const now = clock();
  if (now - next > 250) next = now;
  while (now >= next) {
    postMessage(next);
    next += step;
  }
  setTimeout(loop, Math.max(0, Math.min(4, next - now)));
};
setTimeout(loop, 4);
`;

/**
 * Calls `tick` then `after` once per frame, every FRAME_MS like the original. A worker drives the
 * timing because animation frames stop and page timers slow down in background tabs, and an
 * online match must keep running there.
 */
export function startFixedLoop(tick: () => void, after: () => void): () => void {
  const clock = () => performance.timeOrigin + performance.now();
  const frame = (due: number) => {
    // Frames that waited behind a long main-thread stall are dropped rather than played back at once.
    if (clock() - due > 200) return;
    tick();
    after();
  };
  let stopped = false;
  let heard = false;
  let timer = 0;
  const worker = new Worker(URL.createObjectURL(new Blob([PACER], { type: 'text/javascript' })));
  worker.onmessage = (e: MessageEvent<number>) => {
    heard = true;
    frame(e.data);
  };
  // Some embedded browsers never start a worker made from a blob. The same pacing then runs on
  // the page's own timers, which slow down while the tab is in the background.
  const fallback = window.setTimeout(() => {
    if (heard || stopped) return;
    worker.terminate();
    let next = clock() + FRAME_MS;
    const loop = () => {
      if (stopped) return;
      const now = clock();
      if (now - next > 250) next = now;
      while (now >= next) {
        frame(next);
        next += FRAME_MS;
      }
      timer = window.setTimeout(loop, Math.max(0, Math.min(4, next - now)));
    };
    loop();
  }, 500);
  return () => {
    stopped = true;
    worker.terminate();
    clearTimeout(fallback);
    clearTimeout(timer);
  };
}
