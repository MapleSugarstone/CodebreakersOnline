// Builds the Fight Settings gamemode row for the daily challenge from CB's STOCK row. Writes assets/<md5>.svg and tools/merge/daily-row.json.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
let s = fs.readFileSync(path.join(root, 'work/cb/7ae904b77ad3137f4f60ae65ddfa3642.svg'), 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error(`missing ${a}`); s = s.split(a).join(b); };
rep('#790000', '#5c3d8f');
rep('>STOCK</tspan>', '>DAILY</tspan>');
rep('>KO your opponent until</tspan>', '>Beat as many challengers</tspan>');
rep('>they run out of lives!</tspan>', '>as you can today!</tspan>');
const md5 = crypto.createHash('md5').update(s).digest('hex');
fs.writeFileSync(path.join(root, 'assets', `${md5}.svg`), s);
fs.writeFileSync(path.join(root, 'tools/merge/daily-row.json'), JSON.stringify({ name: 'DailyMode', md5ext: `${md5}.svg` }, null, 1) + '\n');
console.log(md5);
