// Builds stage-select thumbnails for the stages added from Project K, in the layout of CB's own thumbnails.
// Writes assets/<md5>.svg and prints a JSON list of {name, md5ext, rotationCenterX, rotationCenterY}.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('playwright-core');

const root = path.resolve(__dirname, '..');
const cb = path.join(root, 'work/cb'), pk = path.join(root, 'work/pk');
const TEMPLATE = 'c3e1c5fe89903e3de1db3222c7490e2b.svg';
const BACKDROP = '9629cad1385eb112e812a956b05a789a.png';
const STAGES = [
  { name: 'stage25-thumb', title: process.env.STAGE25_NAME || 'SKY RUINS', music: '[Codebreakers OST] - Fresh Turf', collision: '1828735fc167633835c29a3b2e991ae3.svg', cx: 183.95962527100278, cy: 4.604156666666654 },
  { name: 'stage26-thumb', title: process.env.STAGE26_NAME || 'SKY RUINS II', music: '[Codebreakers OST] - Fresh Turf', collision: '3ad10d6b568b607199ce7903f3d47317.svg', cx: 216.17411546070468, cy: 6.345480460704522 },
];

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  const b64 = f => fs.readFileSync(f).toString('base64');
  const template = fs.readFileSync(path.join(cb, TEMPLATE), 'utf8');
  const out = [];
  for (const s of STAGES) {
    // Backdrop is 960x720 at resolution 2; the collision costume sits with its rotation center on the stage center.
    const png = await page.evaluate(async ({ bd, col, cx, cy }) => {
      const load = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
      const [a, b] = await Promise.all([load(bd), load(col)]);
      const c = document.createElement('canvas');
      c.width = 960; c.height = 720;
      const g = c.getContext('2d');
      g.drawImage(a, 0, 0, 960, 720);
      g.drawImage(b, 2 * (240 - cx), 2 * (180 - cy), 2 * b.naturalWidth, 2 * b.naturalHeight);
      return c.toDataURL('image/png').split(',')[1];
    }, { bd: `data:image/png;base64,${b64(path.join(pk, BACKDROP))}`, col: `data:image/svg+xml;base64,${b64(path.join(pk, s.collision))}`, cx: s.cx, cy: s.cy });
    let svg = template.replace(/<g><image[\s\S]*?<\/g>/, `<g><image x="117.77778" y="297.77778" transform="matrix(0.15,0,0,0.15,-5.74999,-38.5)" width="960" height="720" xlink:href="data:image/png;base64,${png}" stroke-width="0.5" fill="none" stroke="none" style="image-rendering: optimizespeed; image-rendering: pixelated;"/></g>`);
    const tspans = [...svg.matchAll(/<tspan x="0" dy="0">([^<]*)<\/tspan>/g)];
    if (tspans.length !== 2) throw new Error('template text changed');
    svg = svg.replace(`>${tspans[0][1]}</tspan>`, `>${s.title}</tspan>`).replace(`>${tspans[1][1]}</tspan>`, `>${s.music}</tspan>`);
    const md5 = crypto.createHash('md5').update(svg).digest('hex');
    fs.mkdirSync(path.join(root, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(root, 'assets', `${md5}.svg`), svg);
    out.push({ name: s.name, md5ext: `${md5}.svg` });
  }
  await browser.close();
  fs.writeFileSync(path.join(root, 'tools/merge/stage-thumbs.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify(out));
})().catch(e => { console.error(e); process.exit(1); });
