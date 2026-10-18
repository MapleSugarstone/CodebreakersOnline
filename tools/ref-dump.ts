// Dumps costume metadata, normalized vector sources and touching silhouettes from the reference renderer.
// Writes out/ref-meta.json, out/svg/<md5ext> and src/game/silhouettes-data.json.
import fs from 'node:fs';
import path from 'node:path';
import { openReference, ROOT } from './lib/reference.ts';

// Every sprite that tests touching or is tested against.
const TOUCHING = ['P1', 'P2', 'Collision', 'Hitbox', 'Assists', 'Puppet Anchor', 'SRCastGuests', 'MenuUI', 'Costumes'];

const ref = await openReference();
const H = (fn: string, ...args: unknown[]) => ref.page.evaluate(([f, a]) => (window as any).H[f as string](...(a as unknown[])), [fn, args] as const);
const meta = await H('meta');
fs.mkdirSync(path.join(ROOT, 'out', 'svg'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'out', 'ref-meta.json'), JSON.stringify(meta));

let svgs = 0;
for (let start = 0; ; start += 200) {
  const { total, items } = (await H('svgSources', start, 200)) as { total: number; items: { md5ext: string; src: string }[] };
  for (const it of items) {
    const comma = it.src.indexOf(',');
    const body = it.src.slice(0, comma).includes(';base64') ? Buffer.from(it.src.slice(comma + 1), 'base64').toString('utf8') : decodeURIComponent(it.src.slice(comma + 1));
    fs.writeFileSync(path.join(ROOT, 'out', 'svg', it.md5ext), body);
    svgs++;
  }
  if (start + 200 >= total) break;
}

const sil: Record<string, unknown> = {};
for (const name of TOUCHING) Object.assign(sil, await H('silhouettes', [name]));
fs.writeFileSync(path.join(ROOT, 'src', 'game', 'silhouettes-data.json'), JSON.stringify(sil));
console.log('meta targets', (meta as unknown[]).length, 'svg sources', svgs, 'silhouette sprites', Object.keys(sil).length);
await ref.close();
