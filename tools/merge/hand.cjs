// Statement-level merges for scripts where neither project's whole version is right.
const { learnShapes, asm } = require('./asm.cjs');

function run({ dst, src, M, L, log }) {
  const T = (p, n) => L.getTarget(p, n);
  const listOf = (t, name) => Object.values(t.lists).find(v => v[0] === name);
  learnShapes(dst, src);
  const code = (t, text) => asm(dst, t, M.ids, text);
  const replaceWith = (t, id, text) => L.replaceStmt(t, id, code(t, text));
  const before = (t, id, text) => L.insertBefore(t, id, code(t, text));
  const after = (t, id, text) => L.insertAfter(t, id, code(t, text));
  // Swaps an if block's condition for a new one, keeping its branches.
  const condition = (t, id, text) => {
    const tmp = code(t, `if ${text} then\nend`);
    const old = t.blocks[id].inputs.CONDITION && t.blocks[id].inputs.CONDITION[1];
    if (old) L.removeIds(t, L.branchIds(t.blocks, old));
    const c = t.blocks[tmp].inputs.CONDITION[1];
    t.blocks[id].inputs.CONDITION = [2, c];
    t.blocks[c].parent = id;
    delete t.blocks[tmp].inputs.CONDITION;
    L.removeIds(t, new Set([tmp]));
  };
  // Moves a C block's substack under a new if/else: the old body runs after `head` in the then branch.
  const wrapBody = (t, cblock, ifText) => {
    const body = t.blocks[cblock].inputs.SUBSTACK[1];
    const iff = code(t, ifText);
    L.appendToSubstack(t, iff, body);
    t.blocks[cblock].inputs.SUBSTACK = [2, iff];
    t.blocks[iff].parent = cblock;
  };
  const scriptWith = (t, hat, text) => {
    const s = L.findScripts(t, hat).filter(id => L.scriptText(t, id).includes(text));
    if (s.length !== 1) throw new Error(`${t.name}: ${s.length} scripts "${hat}" containing ${text}`);
    return s[0];
  };
  const stmtWith = (t, top, head, text) => {
    const s = L.findStmts(t, top, head).filter(id => L.stmtText(t, id).includes(text));
    if (s.length !== 1) throw new Error(`${t.name}: ${s.length} statements ${head} containing ${text}`);
    return s[0];
  };

  // BattleUI: CB's clone script plus the gimmick UI branches PK added for its new fighters.
  // PK's own clone script repeats 15 of CB's branches verbatim, which is not taken.
  {
    const ta = T(dst, 'BattleUI'), tb = T(src, 'BattleUI');
    const gimmickClone = t => {
      const s = L.findScripts(t, 'WHEN I START AS A CLONE').filter(id => L.scriptText(t, id).includes('strcontains(costume_name, "Papa")'));
      if (s.length !== 1) throw new Error(`${t.name}: ${s.length} gimmick clone scripts`);
      return s[0];
    };
    const topA = gimmickClone(ta), topB = gimmickClone(tb);
    const anchor = L.findStmt(ta, topA, 'looks_show()', 0, null);
    if (ta.blocks[topA].next !== anchor) throw new Error('BattleUI clone script no longer starts with looks_show');
    let at = anchor;
    for (const name of ['CrysTimer', 'Samiche', 'Leon']) {
      const b = L.findStmt(tb, topB, `if strcontains(costume_name, "${name}") then`);
      const nb = M.copyBranch(tb, b, ta);
      L.insertAfter(ta, at, nb);
      at = nb;
    }
    log.push('BattleUI: added CrysTimer, Samiche and Leon branches to the clone script');
  }

  // MenuUI: PK's 16 by 4 select grid geometry for the cursors, and CB's locked-boss overlays moved onto it.
  {
    const ta = T(dst, 'MenuUI'), tb = T(src, 'MenuUI');
    const cloneA = L.findScript(ta, 'WHEN I START AS A CLONE'), cloneB = L.findScript(tb, 'WHEN I START AS A CLONE');
    for (const who of ['$char1', '$char2']) {
      const needle = `motion_gotoxy(X=((((((${who} - "1") mod "16")`;
      const a = L.findStmt(ta, cloneA, needle), b = L.findStmt(tb, cloneB, needle);
      L.replaceStmt(ta, a, M.copyBranch(tb, b, ta));
    }
    const css = L.findScript(ta, 'DEFINE "css"');
    L.replaceLiteral(ta, L.findStmt(ta, css, 'motion_sety(Y="69")'), '69', '83');
    const setx = L.findStmt(ta, css, 'motion_setx(X=(((item($usc, @Unlocks) - "33") * "29") - "218"))');
    L.replaceLiteral(ta, setx, '29', '27.4');
    L.replaceLiteral(ta, setx, '218', '205');
    // The unlock-everything code blacklists the empty cells after the last fighter: 49 to 64 on the new grid.
    const cheat = L.findScripts(ta, 'WHEN I RECEIVE "MainMenu"').find(id => L.scriptText(ta, id).includes('keyPressed("t")'));
    L.replaceLiteral(ta, L.findStmt(ta, cheat, '$tempChar = "43"'), '43', '48');
    L.replaceLiteral(ta, L.findStmt(ta, cheat, 'repeat "7"'), '7', '16');
    // The bosses (34 to 38 and 42) start unlocked, as after that code: no locked overlays and only the empty cells
    // blacklisted. Campaign still turns them away, since they have no routes.
    const bl = listOf(ta, 'blacklistedtrainingchar');
    bl[1] = [];
    for (let i = 49; i <= 64; i++) bl[1].push(String(i));
    listOf(T(dst, 'Stage'), 'Unlocks')[1] = [];
    log.push('MenuUI: PK cursor grid, locked overlays at 27.4 x 24.5 spacing, bosses unlocked, blacklist 49-64');
  }

  // Stages 25 and 26: PK's two new collision layouts on PK's backdrop. Stage n uses backdrop n + 5, Collision
  // costume n, MenuUI costume n + 22 (its thumbnail) and music n + 2, so each list gains entries at the end of its run.
  {
    const st = T(dst, 'Stage'), pst = T(src, 'Stage');
    const clone = o => JSON.parse(JSON.stringify(o));
    const pkBackdrop = pst.costumes.find(c => c.name === 'stage1');
    for (const n of ['stage25', 'stage26']) st.costumes.push(Object.assign(clone(pkBackdrop), { name: n }));
    if (st.costumes.findIndex(c => c.name === 'stage25') !== 25 + 4) throw new Error('stage backdrops are not where stage 25 expects');

    const col = T(dst, 'Collision'), pcol = T(src, 'Collision');
    if (col.costumes.length !== 24) throw new Error('Collision costume count changed');
    for (const [n, from] of [['stage25', 'costume3'], ['stage26', 'costume4']]) col.costumes.push(Object.assign(clone(pcol.costumes.find(c => c.name === from)), { name: n }));

    // Thumbnails from tools/stage-thumbs.cjs, inserted after stage 24's; later MenuUI costumes are addressed by name
    // or, for the AI level badge, by 33 + stagemax + level, which moves with them.
    const menu = T(dst, 'MenuUI');
    const thumbs = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'stage-thumbs.json'), 'utf8'));
    const after = menu.costumes.findIndex(c => c.name === 'costume66');
    if (after !== 45) throw new Error('stage 24 thumbnail is not costume 46');
    const tmpl = menu.costumes[after];
    menu.costumes.splice(after + 1, 0, ...thumbs.map(t => Object.assign(clone(tmpl), { name: t.name, md5ext: t.md5ext, assetId: t.md5ext.split('.')[0] })));

    // Music: s25 is PK's new track (PK plays it whenever fighter 48 fights), s26 is the track PK uses for every stage.
    const cbS1 = st.sounds.find(s => s.name === 's1'), pkS1 = pst.sounds.find(s => s.name === 's1');
    st.sounds.push(Object.assign(clone(pkS1), { name: 's25' }), Object.assign(clone(cbS1), { name: 's26' }));
    const names = listOf(st, 'MusicDisplayNames')[1];
    if (names.length !== 29) throw new Error('MusicDisplayNames length changed');
    names.push('[Glacier_Stratus] - Titan Souls', '[Battle In The Heavens] - DQ', process.env.FIGHTER48_THEME || '[Project K] - Tinmanfish', '[Updator] - Fresh Turf');

    // The jukebox steps through music -4 to 25; it now reaches the new track at 27.
    const xt = T(dst, 'Xtras');
    for (const id of L.findStmts(xt, L.findScript(xt, 'WHEN I RECEIVE "Soundtrack"'), 'call "mu %s %s %s"')) {
      L.replaceLiteral(xt, id, '25', '27');
    }

    // Fighter 48 brings its track, as in PK: the music loop starts it during the countdown and plays it to the end.
    const cd = L.findScript(st, 'WHEN I RECEIVE "Countdown"');
    const pcd = L.findScript(pst, 'WHEN I RECEIVE "Countdown"');
    const b = M.copyBranch(pst, L.findStmt(pst, pcd, 'if (($char1 = "48") or ($char2 = "48")) then'), st);
    L.replaceLiteral(st, L.findStmt(st, b, '$music = "3"', 0, null), '3', '27');
    L.insertBefore(st, st.blocks[cd].next, b);
    log.push('Stages 25-26, thumbnails, music s25/s26, jukebox to 27, fighter 48 track');
  }

  // Campaign routes for fighters 44 to 48. DRAFT for the user's review (Notes/campaign-draft.md).
  // A route is five opponents (two digits each), then the boss from bosslist. "dd" in campaignstage means the
  // opponent's entry in defaultcampaignstage, which for the new fighters is one of the new stages.
  {
    const st = T(dst, 'Stage');
    const ROUTES = [
      // fighter, opponents, boss, home stage
      [44, [7, 12, 22, 27, 45], 37, 25],
      [45, [4, 9, 17, 47, 44], 36, 26],
      [46, [2, 14, 25, 48, 45], 34, 25],
      [47, [10, 11, 19, 39, 46], 35, 26],
      [48, [1, 21, 23, 47, 44], 38, 25],
    ];
    const lists = ['campaignlist', 'campaignstage', 'bosslist', 'defaultcampaignstage'].map(n => listOf(st, n)[1]);
    for (const l of lists) if (l.length !== 43) throw new Error('campaign list length changed');
    for (const [, opp, boss, home] of ROUTES) {
      lists[0].push(opp.map(o => String(o).padStart(2, '0')).join(''));
      lists[1].push('dddddddddddd');
      lists[2].push(String(boss));
      lists[3].push(String(home));
    }
    // Campaign select cards from tools/classic-cards.cjs, after Classic43 (MenuUI shows join("Classic", char1)).
    const menu = T(dst, 'MenuUI');
    const cards = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'classic-cards.json'), 'utf8'));
    const at = menu.costumes.findIndex(c => c.name === 'Classic43');
    const tmpl = menu.costumes[at];
    menu.costumes.splice(at + 1, 0, ...cards.map(c => Object.assign(JSON.parse(JSON.stringify(tmpl)), { name: c.name, md5ext: c.md5ext, assetId: c.md5ext.split('.')[0] })));
    log.push('Campaign: draft routes and cards for 44-48');
  }

  // Daily challenge (PK's weekly mode): a third gamemode in Fight Settings after Stock and Timer. `weekly` = 1 marks it,
  // with scores item 1 kept at "stock". PK's own entry was the m key on character select, which CB uses for going back.
  {
    const menu = T(dst, 'MenuUI'), pmenu = T(src, 'MenuUI');
    const row = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'daily-row.json'), 'utf8'));
    menu.costumes.push(Object.assign(JSON.parse(JSON.stringify(menu.costumes.find(c => c.name === 'costume11'))), { name: row.name, md5ext: row.md5ext, assetId: row.md5ext.split('.')[0] }));

    for (const [hat, text] of [['DEFINE "generateSeed"', 'weeklyRounds'], ['WHEN I RECEIVE "nextChallenger"', 'generateSeed'], ['WHEN I RECEIVE "Countdown"', 'Daily Highscore']]) {
      const id = scriptWith(pmenu, hat, text);
      M.copyScript(pmenu, id, menu, pmenu.blocks[id].x, pmenu.blocks[id].y);
    }
    // PK rotates its four stages between rounds; here the rounds walk through every stage.
    const next = L.findScript(menu, 'WHEN I RECEIVE "nextChallenger"');
    replaceWith(menu, L.findStmt(menu, next, '$stage = (($stage mod "4") + "1")'), '$stage = (($stage mod $stagemax) + "1")');

    // Fight Settings: left and right on the gamemode row cycle Stock, Timer, Daily. Randomizer (gamemode 1) keeps two.
    const fight = scriptWith(menu, 'WHEN I RECEIVE "Fight"', 'call "fight"()');
    const [left, right] = L.findStmts(menu, fight, 'if (item("1", @scores) = "stock") then');
    replaceWith(menu, left, `
if ($weekly = "1") then
  $weekly = "0"
  replace item "1" of @scores with "timer"
else
  if ((item("1", @scores) = "stock") and ($gamemode = "0")) then
    $weekly = "1"
  else
    if (item("1", @scores) = "stock") then
      replace item "1" of @scores with "timer"
    else
      replace item "1" of @scores with "stock"
    end
  end
end`);
    replaceWith(menu, right, `
if ($weekly = "1") then
  $weekly = "0"
  replace item "1" of @scores with "stock"
else
  if (item("1", @scores) = "stock") then
    replace item "1" of @scores with "timer"
  else
    replace item "1" of @scores with "stock"
    if ($gamemode = "0") then
      $weekly = "1"
    end
  end
end`);
    const clone = L.findScript(menu, 'WHEN I START AS A CLONE');
    const [modeRow, ruleRow] = L.findStmts(menu, clone, 'if (item("1", @scores) = "stock") then');
    replaceWith(menu, modeRow, `
if ($weekly = "1") then
  looks_switchcostumeto(COSTUME="DailyMode")
else
  if (item("1", @scores) = "stock") then
    looks_switchcostumeto(COSTUME="costume11")
  else
    looks_switchcostumeto(COSTUME="costume12")
  end
end`);
    replaceWith(menu, ruleRow, `
if ($weekly = "1") then
  looks_switchcostumeto(COSTUME="costume13")
else
  if (item("1", @scores) = "stock") then
    looks_switchcostumeto(COSTUME=(item("2", @scores) + "12"))
  else
    looks_switchcostumeto(COSTUME=(item("2", @scores) + "17"))
  end
end`);
    // Character select: P2's cursor and the CPU level badge hide, as in PK.
    for (const c of ['costume26', 'costume35']) {
      const branch = L.findStmt(menu, clone, `if (costume_name = "${c}") then`);
      wrapBody(menu, L.findStmt(menu, branch, 'forever', 0, null), 'if ($weekly = "0") then\n  looks_show()\nelse\n  looks_hide()\nend');
    }
    const css = scriptWith(menu, 'WHEN I RECEIVE "CSS"', 'call "css"()');
    after(menu, L.findStmt(menu, css, 'call "css"()'), `
if ($weekly = "1") then
  $char2 = "999"
  $helper2 = "-1"
  broadcast and wait bcast("decodeChamp")
  data_showvariable(VARIABLE:"Daily Champion:")
  data_showvariable(VARIABLE:"☁ Daily Highscore")
end`);
    condition(menu, L.findStmt(menu, css, 'if (keyPressed("g") and not(($gamemode = "2"))) then'), '(keyPressed("g") and not((($gamemode = "2") or ($weekly = "1"))))');
    condition(menu, L.findStmt(menu, css, 'if (keyPressed("f") and not(($gamemode = "2"))) then'), '(keyPressed("f") and not((($gamemode = "2") or ($weekly = "1"))))');
    // P2's assist picker stays shut: the challenger fights without an assist.
    for (const k of ['a', 'd']) {
      condition(menu, L.findStmt(menu, css, `if (keyPressed("${k}") and ((($menu = "2") or ($menu = "3")) and (not(($gamemode = "1")) and not(($gamemode = "2"))))) then`),
        `(keyPressed("${k}") and ((($menu = "2") or ($menu = "3")) and ((not(($gamemode = "1")) and not(($gamemode = "2"))) and ($weekly = "0"))))`);
    }
    const back = L.findStmt(menu, css, 'if (($menu = "0") or (($gamemode = "2") and ($menu = "2"))) then');
    condition(menu, back, '((($menu = "0") or (($gamemode = "2") and ($menu = "2"))) or (($weekly = "1") and ($menu = "2")))');
    before(menu, menu.blocks[back].inputs.SUBSTACK[1], 'data_hidevariable(VARIABLE:"Daily Champion:")\ndata_hidevariable(VARIABLE:"☁ Daily Highscore")');
    before(menu, stmtWith(menu, css, 'if ($gamemode = "2") then', 'Campaignstart'), `
data_hidevariable(VARIABLE:"Daily Champion:")
if ($weekly = "1") then
  $stage = "1"
  $weeklyRounds = "0"
  $myCurrentDay = floor(daysSince2000)
  $AIon? = "1"
  $AIIntensity = "8"
  call "generateSeed"()
  $char2 = $weeklyFighter
end`);
    const menuSet = scriptWith(menu, 'WHEN I RECEIVE "CSS"', '$ae = "0"');
    condition(menu, L.findStmt(menu, menuSet, 'if ($gamemode = "2") then'), '(($gamemode = "2") or ($weekly = "1"))');

    // Daily reset of the cloud scores (from PK's flag script), and the mode switching off on the main menu.
    const flag = scriptWith(menu, 'WHEN FLAG CLICKED', 'TitleScreenAnim');
    before(menu, menu.blocks[flag].next, `
$weekly = "0"
$weeklyRounds = "0"
$myCurrentDay = floor(daysSince2000)
if not((\${☁ globalCurrentDay} = $myCurrentDay)) then
  \${☁ Daily Highscore} = "0"
  \${☁ Champion} = ""
  \${☁ globalCurrentDay} = $myCurrentDay
end
data_hidevariable(VARIABLE:"Score:")
data_hidevariable(VARIABLE:"Daily Champion:")
data_hidevariable(VARIABLE:"☁ Daily Highscore")`);
    const mm = scriptWith(menu, 'WHEN I RECEIVE "MainMenu"', 'add "3" to @scores');
    before(menu, menu.blocks[mm].next, '$weekly = "0"');

    // Match setup: the challenger gains HP each round and both players get one stock.
    const st = T(dst, 'Stage');
    const cd = L.findScript(st, 'WHEN I RECEIVE "Countdown"');
    before(st, L.findStmt(st, cd, '$1HP = ($1HPmod *'), `
if ($weekly = "1") then
  $2HPmod = ("1" + ($weeklyRounds / "11"))
  replace item "2" of @scores with "1"
end`);

    // PK's monitors for the score and the champion, and its two popup sprites.
    const vid = (t, name) => Object.entries(t.variables).find(([, v]) => v[0] === name);
    for (const m of src.monitors.filter(m => m.opcode === 'data_variable' && ['Score:', 'Daily Champion:', '☁ Daily Highscore'].includes(m.params.VARIABLE))) {
      const [id] = vid(st, m.params.VARIABLE);
      dst.monitors.push(Object.assign(JSON.parse(JSON.stringify(m)), { id, visible: false }));
    }
    let layer = Math.max(...dst.targets.map(t => t.layerOrder || 0));
    for (const name of ['desync', 'newhigh']) {
      const t = JSON.parse(JSON.stringify(T(src, name)));
      t.layerOrder = ++layer;
      for (const b of Object.values(t.blocks)) if (L.isBlock(b) && (b.fields.VARIABLE || b.fields.LIST || b.fields.BROADCAST_OPTION)) throw new Error(`${name} uses data`);
      Object.defineProperty(t, '__stage', { value: st, enumerable: false });
      dst.targets.push(t);
    }
    log.push('Daily challenge: Fight Settings gamemode, select screen, rounds, cloud reset, monitors, popups');
  }

  // Assists. testforhit takes the first `assisthits` row (name, damage, x, y, invincibility frames) whose name the
  // costume name contains. Rows holding several names never match, so those assists fell through to shorter rows
  // ("4Assist", "9Assist") or dealt nothing. Each name gets its own row in the same place, before those shorter rows.
  {
    const as = T(dst, 'Assists');
    const rows = listOf(as, 'assisthits')[1];
    const split = (packed, names) => {
      const i = rows.indexOf(packed);
      if (i < 0 || i % 5) throw new Error(`assisthits row ${packed} not found`);
      const vals = rows.slice(i + 1, i + 5);
      rows.splice(i, 5, ...names.flatMap(n => [n, ...vals]));
    };
    // The older builds matched any "39Assist" costume; the packed row listed only some, and the rest fell to "9Assist".
    split("39AssistRN'39Assist3'39Assist4'39Assist5'", ['39Assist']);
    split('54Assist5,54Assist9,54Assist13', ['54Assist5', '54Assist9', '54Assist13']);
    split('54Assist14,54Assist15', ['54Assist14', '54Assist15']);
    split('54Assist16,54Assist17', ['54Assist16', '54Assist17']);
    // Appel's costume names are inside other assists' names (21Assist2, 31Assist2), so a row would hit for them too.
    // Its jump hits with an exact-name check instead, after the table, as testforhit already does for a few assists.
    const appel = rows.indexOf("1Assist1'1Assist2'1Assist3'");
    rows.splice(appel, 5);
    const test = L.findScript(as, 'DEFINE "testforhit %s"');
    const special = L.findStmt(as, test, 'if strcontains(costume_name, "41Assist") then');
    after(as, special, `
if (costume_name = "1Assist2") then
  call "Hit dmg: %s dx %s dy %s P %s iframes %s"("${process.env.APPEL_DMG || '0.8'}", "12", "10", arg(1/2), "12")
end`);
    // Restored from the older builds in Older Versions/: Ming's and Alex's punches called HeavyFreeze (hit-stop and a
    // forced hurt state) until the hit checks became the table, and Black Jack's opening sound was dropped.
    const old = L.loadProject(require('path').join(__dirname, '../../work/old-sss'));
    const fromOld = new L.Merger(dst, old);
    fromOld.ids = M.ids;
    const oldAs = T(old, 'Assists');
    const hf = L.findScript(oldAs, 'DEFINE "HeavyFreeze"');
    fromOld.copyScript(oldAs, hf, as, oldAs.blocks[hf].x, oldAs.blocks[hf].y);
    before(as, L.findStmt(as, test, 'if contains(@deleters, costume_name) then'), `
if (strcontains(costume_name, "Ming") or strcontains(costume_name, "AlexPunch")) then
  call "HeavyFreeze"()
end`);
    const bomb = oldAs.sounds.find(s => s.name === 'se_common_bomb_s');
    as.sounds.push(JSON.parse(JSON.stringify(bomb)));

    // CB trimmed these assists to fit the project under the upload limit. The user wants the fuller versions back,
    // taken from the oldest build: intros and outros (2, 9, 15), Sharky's shake (18), wind-ups
    // (32, 56), Turtle Animator's three random attacks (37) and Cube One copying its owner's attacks (39).
    // Kept from CB: 36 (fixed distance check), 53, 57 and 60 (Hurtbox renamed Hitbox), 61 (CB added to it).
    const assistIf = (t, n) => {
      for (const proc of ['Assist 1-20 %s %s', 'Assist 20-40 %s %s', 'Assist 40-70 %s %s']) {
        const top = L.findScript(t, `DEFINE "${proc}"`);
        const s = L.findStmts(t, top, `if (arg(#) = "${n}") then`).filter(id => L.stmtHead(t, id) === `if (arg(#) = "${n}") then`);
        if (s.length === 1) return s[0];
      }
      throw new Error(`${t.name}: no block for assist ${n}`);
    };
    for (const n of [2, 9, 15, 18, 32, 37, 39, 56]) L.replaceStmt(as, assistIf(as, n), fromOld.copyBranch(oldAs, assistIf(oldAs, n), as));
    // The oldest build played a clipping scream as three sounds at once. Later builds play CB's quieter file once (user's choice).
    for (const name of ['AAAAAA2', 'AAAAAA3']) L.deleteStmt(as, L.findStmt(as, assistIf(as, 18), `sound_play(SOUND_MENU="${name}")`));
    // Explosions played the bomb sound before CB reused the fighters' explosion sounds in its place.
    const clone = L.findScripts(as, 'WHEN I START AS A CLONE').find(id => L.scriptText(as, id).includes('strcontains(costume_name, "explosion")'));
    const boom = L.findStmt(as, L.findStmt(as, clone, 'if strcontains(costume_name, "explosion") then'), 'sound_play(SOUND_MENU=join("expl", random("1", "3")))');
    replaceWith(as, boom, 'sound_play(SOUND_MENU="se_common_bomb_s")');
    // HeavyFreeze plays crit_hit, which only the Hitbox sprite has now.
    as.sounds.push(JSON.parse(JSON.stringify(T(dst, 'Hitbox').sounds.find(s => s.name === 'crit_hit'))));
    // Frank's lemon plays a sound whose name lost its last characters; the sprite has it as "lemon".
    const menus = Object.values(as.blocks).filter(b => L.isBlock(b) && b.opcode === 'sound_sounds_menu' && b.fields.SOUND_MENU[0] === 'lémon?????');
    if (menus.length !== 1 || !as.sounds.some(s => s.name === 'lemon')) throw new Error('lemon sound fix no longer applies');
    menus[0].fields.SOUND_MENU[0] = 'lemon';
    log.push('Assists: split packed hit rows for 39 and 54, exact hit for Appel, lemon sound');
  }

  // Grabs. The held fighter is pinned to the grabber until the grabber's Grab flag comes back, but the match ending
  // stops the script that sets it. A kill that ends the match during a grab (an assist hitting the held fighter, say)
  // left the loser pinned into the next match, unable to move. `fix` clears the grabbed flags on every death, on the
  // results screen and at the controls screen, so the pin now also ends there and frees the held fighter unthrown.
  {
    const se = T(dst, 'Staleness Engine');
    for (const [victim, grabber] of [['1', '2'], ['2', '1']]) {
      const head = `repeat until ($${grabber}Grab = "1")`;
      const top = L.findScripts(se, `WHEN I RECEIVE "GrabP${victim}"`).find(id => L.scriptText(se, id).includes(head));
      if (!top) throw new Error(`Staleness Engine: no pin loop for GrabP${victim}`);
      const loop = L.findStmt(se, top, head);
      replaceWith(se, loop, L.stmtText(se, loop).replace(head, `repeat until (($${grabber}Grab = "1") or ($P${victim}Grabbed = "0"))`));
      replaceWith(se, L.findStmt(se, top, `$${victim}pmov = "3"`), `if ($P${victim}Grabbed = "0") then\n  $${victim}pmov = "0"\nelse\n  $${victim}pmov = "3"\nend`);
    }
    log.push('Staleness Engine: grabs end when a death or the results screen clears the grabbed flags');
  }

  // Canvas (31). PK has no head sprite, so it drew a default head into every Canvas costume. This build keeps CB's
  // Hats B) sprite, which draws the head picked in Extras, so Canvas takes CB's headless costumes again. PK also reset
  // Canvas's color and moves at every countdown and cycled them on every hit; those go, so the Extras picks hold.
  {
    const cbProject = L.loadProject(require('path').join(__dirname, '../../work/cb'));
    const mine = T(dst, 'Costumes'), cbCostumes = T(cbProject, 'Costumes');
    // The "[n]" prefix is the frame's speed, which PK retuned, so frames match on the rest of the name and keep PK's.
    const frame = name => name.replace(/^\[\d+\]/, '');
    let n = 0;
    for (const c of mine.costumes) {
      if (!c.name.includes('31`')) continue;
      const old = cbCostumes.costumes.find(x => frame(x.name) === frame(c.name));
      if (!old) throw new Error(`Costumes: CB has no ${c.name}`);
      for (const k of ['assetId', 'md5ext', 'dataFormat', 'bitmapResolution', 'rotationCenterX', 'rotationCenterY']) c[k] = old[k];
      n++;
    }
    const se = T(dst, 'Staleness Engine');
    const cd = L.findScripts(se, 'WHEN I RECEIVE "Countdown"').find(id => L.scriptText(se, id).includes('@Canvas'));
    for (const [item, v] of [['2', '0'], ['3', '1'], ['4', '1']]) L.deleteStmt(se, L.findStmt(se, cd, `replace item "${item}" of @Canvas with "${v}"`));
    for (const msg of ['1Hit', '2Hit']) {
      const s = L.findScripts(se, `WHEN I RECEIVE "${msg}"`).find(id => L.scriptText(se, id).includes('@Canvas'));
      if (!s) throw new Error(`Staleness Engine: no Canvas script for ${msg}`);
      L.removeScript(se, s);
    }
    log.push(`Canvas: CB's ${n} headless costumes, Extras picks kept through matches`);
  }

  // Pause menu. Its "Character select" broadcasts QuitMatch (see src/game/pause.ts). One script runs the whole quit,
  // so it works in every mode: Endgame and ResultsScreen let every sprite clean up as after a normal finish, while
  // the KO effect and the results screen stand aside, and then character select opens. The script lives in the
  // Transition sprite because the stage stops its own other scripts on ResultsScreen. The wait lets the first
  // transition finish sliding out; two at once fight over the sprite and take seconds.
  {
    const st = T(dst, 'Stage'), tr = T(dst, 'Transition');
    st.variables[M.ids.next()] = ['quitmatch', 0];
    const body = code(tr, [
      '$quitmatch = "1"',
      'broadcast bcast("Endgame")',
      'broadcast and wait bcast("Transition")',
      'broadcast bcast("ResultsScreen")',
      'control_wait(DURATION="1")',
      'broadcast and wait bcast("Transition")',
      '$music = "1"',
      'broadcast bcast("CSS")',
      '$quitmatch = "0"',
    ].join('\n'));
    const bid = Object.entries(st.broadcasts).find(([, n]) => n === 'QuitMatch')?.[0] ?? M.ids.next();
    st.broadcasts[bid] = 'QuitMatch';
    const hat = M.ids.next();
    tr.blocks[hat] = { opcode: 'event_whenbroadcastreceived', next: body, parent: null, inputs: {}, fields: { BROADCAST_OPTION: ['QuitMatch', bid] }, shadow: false, topLevel: true, x: 0, y: 0 };
    tr.blocks[body].parent = hat;
    const cd = L.findScripts(st, 'WHEN I RECEIVE "Countdown"')[0];
    before(st, st.blocks[cd].next, '$quitmatch = "0"');

    const fx = T(dst, 'FX');
    const end = L.findScripts(fx, 'WHEN I RECEIVE "Endgame"').find(id => L.scriptText(fx, id).includes('COSTUME="final"'));
    if (!end) throw new Error('FX: no Endgame script with the KO effect');
    after(fx, L.findStmt(fx, end, 'control_stop(STOP_OPTION:"other scripts in sprite")'),
      'if ($quitmatch = "1") then\n  looks_hide()\n  control_stop(STOP_OPTION:"this script")\nend');

    const ui = T(dst, 'BattleUI');
    const res = L.findScripts(ui, 'WHEN I RECEIVE "ResultsScreen"').find(id => L.scriptText(ui, id).includes('call "Results"()'));
    if (!res) throw new Error('BattleUI: no results screen script');
    before(ui, L.findStmt(ui, res, 'if ($char1 = "32") then'), 'if ($quitmatch = "1") then\n  control_stop(STOP_OPTION:"this script")\nend');
    log.push('Pause menu: QuitMatch ends the match and goes to character select');
  }
}

module.exports = { run };
