// Builds the campaign select cards (MenuUI Classic<n>) for fighters 44 to 48 from CB's card for fighter 43,
// with each fighter's results-screen render clipped into the card's corner triangle.
// Writes assets/<md5>.svg and tools/merge/classic-cards.json. The titles and blurbs are drafts for review.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('playwright-core');

const root = path.resolve(__dirname, '..');
const TEMPLATE = path.join(root, 'work/cb/c95a9a47a043054bae37fed5f2b93919.svg');
// Each line stays well under the template's first line (79 characters), which some renderers already draw
// up to the card's edge.
const LINE_MAX = 62;
const CARDS = [
  { n: 44, name: 'LEON &amp; JUSEPPE', title: 'Lock and Load', lines: ['Leon and Juseppe are short on bullets and long on nerve.', 'Take on the other duos and prove that two fighters beat one!'], colors: ['#ff9a4d', '#e0662e'], art: '4feed6e437a54b4c4d01b7bf08f1dbcd.svg' },
  { n: 45, name: 'KUPPA', title: 'Samiche Run', lines: ['Someone took Kuppa\'s Samiche. Fight through the usual suspects', 'and get it back before Dark Papa eats every last one!'], colors: ['#ffe14d', '#f2b200'], art: 'db07750df9230143b1f2205b04c860aa.svg' },
  { n: 46, name: 'ARCHA', title: 'New Challenger', lines: ['Archa has joined the tournament with something to prove.', 'Climb the ranks and face Christopher at the top!'], colors: ['#9a9a9a', '#5e5e5e'], art: '237eff7ec35c7a21d2be822ae74a7f26.svg' },
  { n: 47, name: 'CRYSTAL', title: 'Out of Time!', lines: ['Thirteen seconds is all it takes. Outduel the roster\'s', 'spellcasters and stop Lavanator before time runs out!'], colors: ['#d27bff', '#9b45e0'], art: '4cd71ab7f5800251be0f2a3026cac2ff.svg' },
  { n: 48, name: 'TINMANFISH', title: 'Slippery Fish', lines: ['Tinmanfish slipped out of the tank and into the tournament.', 'Swim past the roster and land the biggest catch: Soulstealer!'], colors: ['#ff6b6b', '#d93a3a'], art: '0c6078ddd3321ff92727e264c7494269.svg' },
];
for (const c of CARDS) for (const l of c.lines) if (l.length > LINE_MAX) throw new Error(`card ${c.n}: line over ${LINE_MAX} characters: ${l}`);
// Corner triangle of the template card, in its own coordinates.
const TRI = 'M240.00008,321.3333v-109.3333l80.3333,109.3333z';
const BOX = { x: 240, y: 212, w: 80.4, h: 109.4 };

(async () => {
  const tmpl = fs.readFileSync(TEMPLATE, 'utf8');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  const out = [];
  for (const c of CARDS) {
    const artSvg = fs.readFileSync(path.join(root, 'work/pk', c.art)).toString('base64');
    // The render fills the triangle's height and keeps to its left edge, at 4 pixels per unit.
    const png = await page.evaluate(async ({ src, box }) => {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
      const k = 4, cw = Math.round(box.w * k), ch = Math.round(box.h * k);
      const cv = document.createElement('canvas');
      cv.width = cw; cv.height = ch;
      const g = cv.getContext('2d');
      const s = Math.min((ch * 0.72) / img.naturalHeight, (cw * 0.62) / img.naturalWidth);
      g.drawImage(img, cw * 0.02, ch - img.naturalHeight * s, img.naturalWidth * s, img.naturalHeight * s);
      return cv.toDataURL('image/png').split(',')[1];
    }, { src: `data:image/svg+xml;base64,${artSvg}`, box: BOX });
    let s = tmpl;
    const tri = s.indexOf(`<path d="${TRI}" fill="url(#color-3)"`);
    const triEnd = s.indexOf('/>', tri) + 2;
    const tail = s.lastIndexOf('</g></g></svg>');
    if (tri < 0 || tail < triEnd) throw new Error('template changed');
    const image = `<image x="${BOX.x}" y="${BOX.y}" width="${BOX.w}" height="${BOX.h}" clip-path="url(#corner-art)" xlink:href="data:image/png;base64,${png}"/>`
      + `<path d="${TRI}" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-linecap="butt"/>`;
    s = s.slice(0, triEnd) + image + s.slice(tail);
    s = s.replace('</defs>', `<clipPath id="corner-art"><path d="${TRI}"/></clipPath></defs>`);
    s = s.replace('stop-color="#54c0ff"', `stop-color="${c.colors[0]}"`).replace('stop-color="#54a6ff"', `stop-color="${c.colors[1]}"`);
    const rep = (from, to) => { if (!s.includes(from)) throw new Error(`missing ${from}`); s = s.replace(from, to); };
    rep('>JOCERS</tspan>', `>${c.name}</tspan>`);
    rep('>Mid-air DECIMATOR</tspan>', `>${c.title}</tspan>`);
    rep(">Jocers and his mid-air spike grabs! pfft! Who cares about it! Obviously you do,</tspan>", `>${c.lines[0]}</tspan>`);
    rep(">of course. Show the rest of the grabbers who's boss!</tspan>", `>${c.lines[1]}</tspan>`);
    const md5 = crypto.createHash('md5').update(s).digest('hex');
    fs.mkdirSync(path.join(root, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(root, 'assets', `${md5}.svg`), s);
    out.push({ name: `Classic${c.n}`, md5ext: `${md5}.svg` });
  }
  await browser.close();
  fs.writeFileSync(path.join(root, 'tools/merge/classic-cards.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(out.map(o => `${o.name} ${o.md5ext}`).join('\n'));
})().catch(e => { console.error(e); process.exit(1); });
