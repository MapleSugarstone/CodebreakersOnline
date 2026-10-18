// Renders the site's favicon, touch icon and link preview image from the game's own costumes.
// Usage: npx tsx tools/site-images.ts
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { allCostumes, skins } from '../src/game/assets.ts';
import { modules } from '../src/game/generated/index.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'public');

/** A costume as a data URL, with its shared fonts put back (see tools/assets.ts). */
function costume(sprite: string, name: string, drop?: RegExp): { src: string; w: number; h: number } {
  const ti = modules.findIndex((m) => m.def.name === sprite);
  const c = allCostumes[ti]?.find((x) => x.name === name);
  if (!c) throw new Error(`missing costume ${sprite}/${name}`);
  const skin = skins[c.skin];
  let svg = fs.readFileSync(path.join(OUT, 'assets', skin.file), 'utf8');
  svg = svg.replace(/cbfont:([0-9a-f]+)/g, (_m, id: string) => fs.readFileSync(path.join(OUT, 'assets/fonts', `${id}.txt`), 'utf8'));
  if (drop) svg = svg.replace(drop, '');
  return { src: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`, w: skin.w, h: skin.h };
}

// The extras menu's logo without the "hold" label under it.
const logo = costume('Xtras', 'codebreakers logo', /<text[^>]*><tspan[^>]*>hold<\/tspan><\/text>/);
// The title screen without its prompt: halftone bands with the logo in the middle.
const title = costume('MenuUI', 'costume1', /<text[^>]*><tspan[^>]*>press \[n\] to start<\/tspan><\/text>/);

function page(w: number, h: number, body: string): string {
  return `<!doctype html><html><body style="margin:0;background:transparent"><div style="position:relative;width:${w}px;height:${h}px;overflow:hidden">${body}</div></body></html>`;
}

/** The logo fitted into a square with a small margin. */
function icon(size: number): string {
  const scale = (size * 0.96) / Math.max(logo.w, logo.h);
  const w = logo.w * scale;
  const h = logo.h * scale;
  return page(size, size, `<img src="${logo.src}" style="position:absolute;left:${(size - w) / 2}px;top:${(size - h) / 2}px;width:${w}px;height:${h}px">`);
}

// The title screen's 480x360 stage area across the preview's width, centered on the logo. The costume is a
// little larger than the stage, so its edges fall outside the image.
const PREVIEW_SCALE = 1200 / 480;
const preview = page(
  1200,
  630,
  `<img src="${title.src}" style="position:absolute;left:${600 - (title.w / 2) * PREVIEW_SCALE}px;top:${315 - (title.h / 2) * PREVIEW_SCALE}px;width:${title.w * PREVIEW_SCALE}px;height:${title.h * PREVIEW_SCALE}px">`,
);

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const tab = await browser.newPage();
const jobs: [string, number, number, string, boolean][] = [
  ['favicon.png', 64, 64, icon(64), true],
  ['apple-touch-icon.png', 180, 180, icon(180), true],
  ['preview.png', 1200, 630, preview, false],
];
for (const [file, w, h, html, transparent] of jobs) {
  await tab.setViewportSize({ width: w, height: h });
  await tab.setContent(html);
  await tab.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
  await tab.screenshot({ path: path.join(OUT, file), clip: { x: 0, y: 0, width: w, height: h }, omitBackground: transparent });
  console.log(`wrote public/${file} (${w}x${h})`);
}
await browser.close();
