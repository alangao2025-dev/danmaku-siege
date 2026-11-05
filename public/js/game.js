// 游戏逻辑：对局阶段、单位 AI、战斗、技能、计分。纯逻辑 + 触发特效，不直接画 HUD
import { W, H, GROUND_TOP, GROUND_BOTTOM, CASTLE_X, CASTLE_BASE, TEAMS, ENEMY, UNITS, GIFTS, CLASS_BY_WORD,
  INTRO_TIME, ROUND_TIME, FINAL_TIME, OVER_TIME, CASTLE_HP, SIEGE_MUL, RAGE_TIME, RAGE_CD, MAX_SMALL_UNITS, ENERGY_MAX, castleFront, depthScale } from './config.js';
import { rand, pick, clamp, nickColor } from './util.js';
import { MUZZLE } from './art.js';
import * as F from './fx.js';
import { sfx } from './sfx.js';

export const game = {};
let uid = 0;

export function newRound() {
  Object.assign(game, {
    phase: 'intro', phaseT: 0, time: ROUND_TIME, round: (game.round || 0) + 1,
    castles: { red: mkCastle(), blue: mkCastle() },
    energy: { red: 0, blue: 0 }, rage: { red: 0, blue: 0 }, rageCd: { red: 0, blue: 0 },
    units: [], shots: [], strikes: [],
    players: new Map(),
    feed: [], banners: [], toasts: [],
    winner: null, mvp: null, slow: 1, finalAnnounced: false,
    stats: { red: { kills: 0, sent: 0 }, blue: { kills: 0, sent: 0 } },
  });
  F.resetFx();
  pushBanner({ kind: 'intro', text: `第 ${game.round} 局`, sub: '发 1 加入赤焰军 · 发 2 加入苍蓝军' });
}
function mkCastle() { return { hp: CASTLE_HP, shown: CASTLE_HP, trail: CASTLE_HP, hit: 0, towerCd: 1, level: 0 }; }

// ---------------- 观众事件 ----------------
function player(nick, team) {
  let p = game.players.get(nick);
  if (!p) {
    if (!team) team = count('red') <= count('blue') ? 'red' : 'blue';
    p = { nick, team, cls: pick(['sword', 'sword', 'archer', 'mage']), score: 0, kills: 0, color: nickColor(nick), joinT: performance.now() };
    game.players.set(nick, p);
    pushFeed({ team, nick, text: `加入了${TEAMS[team].name}`, color: p.color });
  }
  return p;
}
const count = team => { let n = 0; for (const p of game.players.values()) if (p.team === team) n++; return n; };
export const teamPlayers = count;

export function handleEvent(ev) {
  if (!ev || !ev.user || game.phase === 'over') return;
  const nick = String(ev.user.nick || '神秘观众').slice(0, 10);
  if (ev.type === 'comment') {
    const c = String(ev.content || '').trim();
    if (c === '1' || c === '2') {
      const p = player(nick, c === '1' ? 'red' : 'blue');
      spawnFor(p, p.cls);
    } else if (CLASS_BY_WORD[c[0]] && c.length <= 2) {
      const p = player(nick); p.cls = CLASS_BY_WORD[c[0]]; spawnFor(p, p.cls); p.score += 1;
    } else if (/冲|上|杀|go/i.test(c)) {
      const p = player(nick); spawnFor(p, p.cls); p.score += 1;
    } else if (c.includes('666')) {
      const p = player(nick);
      if (game.rageCd[p.team] <= 0) {
        pushFeed({ team: p.team, nick, text: '点燃了全军士气！攻击 ×1.5', color: p.color, hot: true });
        game.rage[p.team] = RAGE_TIME; game.rageCd[p.team] = RAGE_CD; p.score += 5;
      } else p.score += 1;
      addEnergy(p.team, 0.5);
    }
  } else if (ev.type === 'like') {
    const p = player(nick), n = clamp(ev.count | 0, 1, 100), c = game.castles[p.team];
    const heal = n;
    c.hp = Math.min(CASTLE_HP, c.hp + heal); p.score += n * 0.2; addEnergy(p.team, n * 0.06);
    const fx = CASTLE_X[p.team] + rand(-50, 50), fy = CASTLE_BASE - rand(80, 200);
    F.floatText(fx, fy, `+${heal}`, { color: '#9dffb0', size: 18, vy: -50 });
    F.sparks(fx, fy, '#7dffa0', 4, 70, 0.6, 10);
  } else if (ev.type === 'gift') {
    const g = GIFTS[ev.gift];
    if (!g) return;
    const p = player(nick), n = clamp(ev.count | 0, 1, 99);
    p.score += g.score * 10 * n; addEnergy(p.team, g.energy * n);
    for (let k = 0; k < n; k++) for (let i = 0; i < g.n; i++) {
      const u = spawnFor(p, g.unit || p.cls, true);
      if (u && !g.unit) u.atkMul = 1.3;
    }
    const item = { team: p.team, nick, gift: ev.gift, n, text: `送出 ${ev.gift}${n > 1 ? ' ×' + n : ''}，召唤${g.label}`, color: p.color, hot: g.score >= 5 };
    pushFeed(item);
    if (g.score >= 52) {
      pushBanner({ kind: 'gift', team: p.team, nick, gift: ev.gift, text: `${nick}`, sub: `召唤了 ${g.label}！`, big: g.score >= 500 });
      sfx('horn');
    } else if (g.score >= 5) game.toasts.push({ ...item, t: 0 });
  }
}

function spawnFor(p, type, gifted) {
  const small = !gifted && ['sword', 'archer', 'mage'].includes(type);
  if (small && aliveSmall(p.team) >= MAX_SMALL_UNITS) return null;
  game.stats[p.team].sent++;
  return spawn(p.team, type, p.nick);
}
const aliveSmall = team => game.units.reduce((n, u) => n + (u.team === team && u.hp > 0 && UNITS[u.type].size < 40), 0);

export function spawn(team, type, owner) {
  const d = UNITS[type], dir = TEAMS[team].dir;
  const u = {
    id: ++uid, type, team, owner, d,
    x: CASTLE_X[team] + dir * rand(40, 90), y: rand(GROUND_TOP + 20, GROUND_BOTTOM - 10),
    hp: d.hp, max: d.hp, atkMul: 1, cd: rand(d.cd), anim: 'walk', animT: rand(1), hit: 0,
    target: null, retarget: 0, dying: 0, born: 0, drop: 0, fly: d.fly || 0, breath: 0,
  };
  if (type === 'golem') { u.drop = 420; u.x = CASTLE_X[team] + dir * rand(150, 220); }
  if (type === 'dragon') { u.x = CASTLE_X[team] - dir * 120; u.y = rand(430, 560); u.entering = 1.6; F.flash(0.35, TEAMS[team].light); F.shake(0.5); sfx('roar'); }
  game.units.push(u);
  if (d.size < 40) { F.light(u.x, u.y - 14, TEAMS[team].light, 40, 0.3); F.dust(u.x, u.y, 2, 0.7); sfx('pop', 0.25); }
  else if (type === 'knight') { F.light(u.x, u.y - 30, TEAMS[team].light, 90, 0.5); F.ring(u.x, u.y, TEAMS[team].light, 6, 60, 0.5, 5); F.dust(u.x, u.y, 4); sfx('pop', 0.5); }
  return u;
}

function addEnergy(team, v) {
  if (game.phase !== 'play' && game.phase !== 'final') { game.energy[team] = Math.min(ENERGY_MAX, game.energy[team] + v); return; }
  game.energy[team] += v;
  if (game.energy[team] >= ENERGY_MAX) { game.energy[team] = 0; ultimate(team); }
}

// ---------------- 大招 ----------------
function ultimate(team) {
  const foe = ENEMY[team], tm = TEAMS[team];
  const name = team === 'red' ? '陨石天降' : '雷霆审判';
  pushBanner({ kind: 'ult', team, text: name, sub: `${tm.name} 能量充满，释放大招！` });
  F.flash(0.5, tm.light); F.shake(0.4); game.slow = 0.35; sfx('ult');
  const enemies = game.units.filter(u => u.team === foe && u.hp > 0);
  const n = team === 'red' ? 10 : 14;
  for (let i = 0; i < n; i++) {
    let x, y;
    const e = enemies.length ? pick(enemies) : null;
    if (e && Math.random() < 0.8) { x = e.x + rand(-30, 30); y = e.y + rand(-20, 20); }
    else { x = castleFront(foe) - TEAMS[foe].dir * rand(0, 380); y = rand(GROUND_TOP + 20, GROUND_BOTTOM - 20); }
    game.strikes.push({ team, kind: team === 'red' ? 'meteor' : 'bolt', x, y: clamp(y, GROUND_TOP, GROUND_BOTTOM), t: -0.25 - i * 0.16, dur: team === 'red' ? 0.7 : 0.25 });
  }
  game.strikes.push({ team, kind: team === 'red' ? 'meteor' : 'bolt', x: CASTLE_X[foe], y: CASTLE_BASE - 6, t: -0.25 - n * 0.16, dur: 0.7, castle: true });
}
function strikeLand(s) {
  const tm = TEAMS[s.team], foe = ENEMY[s.team];
  const dmg = s.kind === 'meteor' ? 170 : 150, r = s.kind === 'meteor' ? 80 : 55;
  if (s.castle) { hitCastle(foe, 900, null); }
  for (const u of game.units) if (u.team === foe && u.hp > 0 && Math.hypot(u.x - s.x, (u.y - s.y) * 1.6) < r) damage(u, dmg, null);
  if (s.kind === 'meteor') {
    F.ring(s.x, s.y, '#ffb347', 10, r * 1.4, 0.6, 9); F.light(s.x, s.y - 20, '#ff8a3a', 180, 0.5);
    F.sparks(s.x, s.y - 10, '#ffa040', 18, 320, 0.7, 18); F.debris(s.x, s.y, ['#5a4636', '#7a5a42', '#ffb347'], 10, 260, 5, s.y);
    F.smoke(s.x, s.y - 10, 5, '#5b4a52', 70, 1.4, 40); F.shake(0.35); sfx('boom', 0.6);
  } else {
    F.bolt(s.x + rand(-40, 40), -10, s.x, s.y - 10, tm.light); F.light(s.x, s.y - 30, tm.light, 160, 0.4);
    F.ring(s.x, s.y, tm.light, 6, r * 1.5, 0.45, 6); F.sparks(s.x, s.y - 10, '#bfe6ff', 14, 260, 0.5, 14);
    F.flash(0.12, '#cfe8ff'); F.shake(0.25); sfx('zap', 0.6);
  }
}

// ---------------- 战斗 ----------------
function damage(u, dmg, src) {
  if (u.hp <= 0) return;
  const finalMul = game.phase === 'final' ? 1.5 : 1;
  dmg *= finalMul;
  u.hp -= dmg; u.hit = 0.1;
  if (src) { const p = game.players.get(src.owner); if (p) p.score += dmg * 0.04; }
  if (u.d.size >= 50 && Math.random() < 0.5) F.floatText(u.x, u.y - u.d.size * depthScale(u.y) - 6, Math.round(dmg), { color: '#ffe27a', size: 16 });
  if (u.hp <= 0) {
    u.dying = 0.001;
    game.stats[ENEMY[u.team]].kills++;
    if (src) { const p = game.players.get(src.owner); if (p) { p.kills++; p.score += u.d.bounty; } addEnergy(src.team, u.d.bounty * 0.12); }
    const tm = TEAMS[u.team], big = u.d.size >= 50;
    F.sparks(u.x, u.y - u.d.size * 0.4, tm.light, big ? 26 : 7, big ? 260 : 150, 0.6, big ? 18 : 10);
    F.debris(u.x, u.y - u.d.size * 0.4, u.type === 'golem' ? ['#9a9fae', '#5f6474', '#7fbf55'] : [tm.main, tm.dark, '#e4ebf3'], big ? 18 : 5, big ? 260 : 150, big ? 6 : 3.5, u.y);
    if (big) {
      F.smoke(u.x, u.y - 20, 6, '#6c6070', 80, 1.4); F.shake(0.4); sfx('boom', 0.7);
      pushFeed({ team: ENEMY[u.team], nick: src ? src.owner : TEAMS[ENEMY[u.team]].name, text: `击败了 ${u.owner} 的${u.d.name}！`, color: src ? (game.players.get(src.owner)?.color || '#fff') : '#fff', hot: true });
    }
  }
}
function hitCastle(team, dmg, src) {
  const c = game.castles[team];
  if (c.hp <= 0) return;
  dmg *= (game.phase === 'final' ? 1.5 : 1) * (src ? SIEGE_MUL : 1);
  c.hp = Math.max(0, c.hp - dmg); c.hit = 0.15;
  if (src) { const p = game.players.get(src.owner); if (p) p.score += dmg * 0.06; }
  if (Math.random() < 0.25 || dmg > 50) {
    const x = CASTLE_X[team] + TEAMS[team].dir * rand(10, 80), y = CASTLE_BASE - rand(40, 200);
    F.floatText(x, y, Math.round(dmg), { color: dmg > 50 ? '#ffb347' : '#ffe9a0', size: dmg > 50 ? 22 : 15 });
    F.debris(x, y, ['#9b8f8a', '#6f6670', '#c9bfb8'], 3, 120, 3, CASTLE_BASE);
  }
  if (c.hp <= 0) castleFall(team);
}
function castleFall(team) {
  const x = CASTLE_X[team];
  for (let i = 0; i < 6; i++) setTimeoutGame(i * 0.18, () => {
    const px = x + rand(-90, 90), py = CASTLE_BASE - rand(30, 260);
    F.light(px, py, '#ffa040', 220, 0.6); F.sparks(px, py, '#ffb347', 24, 360, 0.8, 22);
    F.debris(px, py, ['#9b8f8a', '#6f6670', '#c9bfb8', '#ffb347'], 16, 340, 7, CASTLE_BASE + rand(0, 40));
    F.smoke(px, py, 6, '#4f4450', 110, 2, 50); F.shake(1); sfx('boom', 1);
  });
}
const timers = [];
function setTimeoutGame(t, fn) { timers.push({ t, fn }); }

function retarget(u) {
  let best = null, bd = u.d.range + 110;
  for (const e of game.units) {
    if (e.team === u.team || e.hp <= 0 || e.drop > 0) continue;
    const dx = Math.abs(e.x - u.x);
    if (dx > bd) continue;
    const d = Math.hypot(e.x - u.x, (e.y - u.y) * 1.3) - e.d.r;
    if (d < bd) { bd = d; best = e; }
  }
  u.target = best; u.targetD = bd;
}

function attack(u) {
  const tm = TEAMS[u.team], foe = ENEMY[u.team], t = u.target, d = u.d, atk = d.atk * u.atkMul * (game.rage[u.team] > 0 ? 1.5 : 1);
  const s = depthScale(u.y), dir = tm.dir;
  const tx = t ? t.x : castleFront(foe) + dir * 30, ty = t ? t.y : u.y;
  if (d.kind === 'melee') {
    if (t) damage(t, atk, u); else hitCastle(foe, atk, u);
    F.slash(u.x + dir * (d.size * 0.35) * s, u.y - d.size * 0.4 * s, dir, tm.light, d.size * 0.5 * s);
    F.sparks(tx - dir * 6, (t ? t.y - t.d.size * 0.4 * depthScale(t.y) : u.y - 30), '#fff2c0', u.type === 'knight' ? 6 : 3, 120, 0.25, 8);
    if (Math.random() < 0.3) sfx('clink', 0.15);
  } else if (d.kind === 'slam') {
    const cx = u.x + dir * 30 * s;
    for (const e of game.units) if (e.team === foe && e.hp > 0 && Math.hypot(e.x - cx, (e.y - u.y) * 1.5) < d.splash) damage(e, atk, u);
    if (Math.abs(castleFront(foe) - cx) < d.splash) hitCastle(foe, atk * 2, u);
    F.ring(cx, u.y, '#e8d5a8', 10, d.splash * 1.3, 0.5, 8); F.dust(cx, u.y, 6, 1.6); F.debris(cx, u.y, ['#8d7a5a', '#6f5a40'], 8, 220, 4, u.y);
    F.shake(0.3); sfx('thud', 0.6);
  } else {
    const [mx, my] = MUZZLE[u.type] || [10, -20];
    const ox = u.x + dir * mx * s, oy = u.y + my * s - u.fly * s;
    if (d.kind === 'breath') { u.breath = 0.5; }
    const ty2 = t ? t.y - t.d.size * 0.45 * depthScale(t.y) - (t.fly || 0) * depthScale(t.y) : u.y - 80 - rand(0, 80);
    game.shots.push({ kind: d.kind, team: u.team, owner: u.owner, x: ox, y: oy, x0: ox, y0: oy, tx: t ? t.x : castleFront(foe) + dir * rand(10, 60), ty: ty2, gy: t ? t.y : u.y,
      t: 0, dur: d.kind === 'arrow' ? 0.5 : d.kind === 'fireball' ? 0.6 : 0.28, dmg: atk, target: t, splash: d.splash || 0, arc: d.kind === 'arrow' ? 60 : d.kind === 'fireball' ? 30 : 0 });
    if (d.kind === 'arrow' && Math.random() < 0.3) sfx('twang', 0.12);
    if (d.kind === 'fireball') sfx('whoosh', 0.12);
  }
}

function updateShots(dt) {
  for (const s of game.shots) {
    s.t += dt / s.dur;
    const k = Math.min(1, s.t);
    if (s.target && s.target.hp > 0) { s.tx = s.target.x; s.ty = s.target.y - s.target.d.size * 0.45 * depthScale(s.target.y) - s.target.fly * depthScale(s.target.y); s.gy = s.target.y; }
    const px = s.x, py = s.y;
    s.x = s.x0 + (s.tx - s.x0) * k; s.y = s.y0 + (s.ty - s.y0) * k - Math.sin(k * Math.PI) * s.arc;
    s.ang = Math.atan2(s.y - py, s.x - px);
    const tm = TEAMS[s.team];
    if (s.kind === 'fireball') { F.trail(s.x, s.y, s.team === 'red' ? '#ff7a2a' : '#5ab4ff', 12, 0.3); if (Math.random() < 0.5) F.ember(s.x, s.y, tm.light); }
    if (s.kind === 'breath') { F.trail(s.x, s.y, s.team === 'red' ? '#ff9a2a' : '#7fd8ff', 22, 0.35); F.ember(s.x, s.y, '#fff3b0'); }
    if (s.kind === 'bolt') F.trail(s.x, s.y, tm.light, 8, 0.2);
    if (s.t >= 1) {
      s.done = true;
      const foe = ENEMY[s.team];
      const src = { owner: s.owner, team: s.team };
      if (s.splash) {
        for (const e of game.units) if (e.team === foe && e.hp > 0 && Math.hypot(e.x - s.tx, (e.gy - e.y) + (e.y - s.gy) * 1.4) < s.splash) damage(e, s.dmg, src);
        F.light(s.tx, s.ty, s.team === 'red' ? '#ff7a2a' : '#5ab4ff', 70, 0.3); F.sparks(s.tx, s.ty, tm.light, 8, 150, 0.4, 12);
      } else if (s.target && s.target.hp > 0) damage(s.target, s.dmg, src);
      if (!s.target && Math.abs(s.tx - castleFront(foe)) < 120) hitCastle(foe, s.dmg, src);
      if (s.kind === 'breath') { if (s.target && s.target.hp > 0) for (const e of game.units) if (e.team === foe && e.hp > 0 && Math.hypot(e.x - s.tx, e.y - s.gy) < 40) damage(e, s.dmg * 0.5, src); F.sparks(s.tx, s.ty, '#ffb347', 3, 90, 0.3, 14); }
      if (s.kind === 'arrow') F.sparks(s.tx, s.ty, '#fff2c0', 2, 60, 0.2, 6);
    }
  }
  game.shots = game.shots.filter(s => !s.done);
}

function updateCastles(dt) {
  for (const team of ['red', 'blue']) {
    const c = game.castles[team], foe = ENEMY[team];
    c.hit = Math.max(0, c.hit - dt);
    c.shown += (c.hp - c.shown) * Math.min(1, dt * 10);
    c.trail = c.trail > c.shown ? Math.max(c.shown, c.trail - CASTLE_HP * 0.15 * dt) : c.shown;
    const lvl = c.hp / CASTLE_HP < 0.25 ? 3 : c.hp / CASTLE_HP < 0.5 ? 2 : c.hp / CASTLE_HP < 0.75 ? 1 : 0;
    if (lvl > c.level) { c.level = lvl; F.shake(0.35); F.smoke(CASTLE_X[team], CASTLE_BASE - 150, 8, '#5f5560', 90, 1.6); sfx('boom', 0.5); }
    c.level = lvl;
    if (c.level >= 2 && Math.random() < dt * 4) F.smoke(CASTLE_X[team] + rand(-60, 60), CASTLE_BASE - rand(120, 220), 1, '#4a4048', 50, 2.2, 40);
    if (c.level >= 3 && Math.random() < dt * 8) F.ember(CASTLE_X[team] + rand(-60, 60), CASTLE_BASE - rand(80, 200), '#ff8a3a');
    // 箭塔防御
    if (c.hp <= 0) continue;
    c.towerCd -= dt;
    if (c.towerCd <= 0) {
      c.towerCd = 1.3;
      const front = castleFront(team);
      let best = null, bd = 260;
      for (const e of game.units) if (e.team === foe && e.hp > 0 && !e.drop) { const d = Math.abs(e.x - front); if (d < bd) { bd = d; best = e; } }
      if (best) {
        const ox = CASTLE_X[team] + TEAMS[team].dir * 83, oy = CASTLE_BASE - 190;
        game.shots.push({ kind: 'bolt', team, owner: null, x: ox, y: oy, x0: ox, y0: oy, tx: best.x, ty: best.y - 20, gy: best.y, t: 0, dur: 0.35, dmg: 12, target: best, splash: 0, arc: 20 });
        F.light(ox, oy, TEAMS[team].light, 40, 0.2);
      }
    }
  }
}

function updateUnits(dt) {
  for (const u of game.units) {
    u.born += dt;
    if (u.dying) { u.dying += dt; continue; }
    const d = u.d, dir = TEAMS[u.team].dir, foe = ENEMY[u.team];
    u.hit = Math.max(0, u.hit - dt); u.breath = Math.max(0, u.breath - dt);
    if (u.drop > 0) { // 从天而降
      u.drop = Math.max(0, u.drop - dt * 900);
      if (u.drop === 0) { F.ring(u.x, u.y, '#ffe3a8', 10, 140, 0.6, 10); F.dust(u.x, u.y, 10, 2); F.debris(u.x, u.y, ['#8d7a5a', '#6f5a40'], 14, 300, 5, u.y); F.shake(0.6); F.light(u.x, u.y - 40, TEAMS[u.team].light, 200, 0.5); sfx('thud', 1);
        for (const e of game.units) if (e.team === foe && e.hp > 0 && Math.hypot(e.x - u.x, (e.y - u.y) * 1.5) < 110) damage(e, 80, u); }
      continue;
    }
    if (u.entering > 0) { u.entering -= dt; u.x += dir * 160 * dt; u.animT += dt * 1.3; continue; }
    u.retarget -= dt;
    if (u.retarget <= 0) { u.retarget = 0.2 + rand(0.15); retarget(u); }
    let t = u.target;
    if (t && (t.hp <= 0 || t.dying)) { t = u.target = null; u.retarget = 0; }
    const frontDist = Math.abs(castleFront(foe) - u.x);
    const reach = d.range + d.r;
    let dist = t ? Math.hypot(t.x - u.x, (t.y - u.y) * 1.3) - t.d.r : Infinity;
    const atCastle = frontDist <= reach + 4 && (!t || dist > reach);
    if (t && dist <= reach || atCastle) {
      if (atCastle) u.target = null;
      if (u.anim !== 'attack') { u.anim = 'attack'; u.animT = 0; u.fired = false; }
    } else if (u.anim === 'attack' && u.animT < 0.99 && u.fired) {
      // 让攻击动作播完
    } else {
      u.anim = 'walk';
      let mx = dir, my = 0;
      if (t) { const dx = t.x - u.x, dy = t.y - u.y, l = Math.hypot(dx, dy) || 1; mx = dx / l; my = dy / l; }
      else my = clamp((u.home ?? (u.home = u.y)) - u.y, -1, 1) * 0.2;
      const spd = d.spd * (game.rage[u.team] > 0 ? 1.25 : 1);
      u.x += mx * spd * dt; u.y += my * spd * dt * 0.8;
      if (frontDist < reach) u.x -= dir * spd * dt; // 不穿过城墙
    }
    // 动画推进
    if (u.anim === 'walk') u.animT = (u.animT + dt * d.spd / (d.size * 0.9)) % 1;
    else {
      u.cd -= dt;
      const cycle = d.cd;
      u.animT += dt / Math.min(cycle, 0.6);
      if (!u.fired && u.animT >= 0.55 && u.cd <= 0) { u.fired = true; attack(u); u.cd = cycle; }
      if (u.animT >= 1) { u.animT = u.cd > 0 && u.fired ? 0.999 : 0; if (u.cd <= 0) { u.animT = 0; u.fired = false; } }
    }
    if (u.type === 'dragon' && Math.random() < dt * 6) F.ember(u.x - dir * 30, u.y - u.fly - 20, TEAMS[u.team].light);
    if (u.anim === 'walk' && d.size >= 50 && Math.random() < dt * 4) F.dust(u.x - dir * 10, u.y, 1, d.size / 60);
    u.y = clamp(u.y, GROUND_TOP + 6, GROUND_BOTTOM - 4);
  }
  // 同队分离：按 x 排序后只比较附近的单位
  const alive = game.units.filter(u => !u.dying && !u.drop && !u.fly).sort((a, b) => a.x - b.x);
  for (let i = 0; i < alive.length; i++) {
    const a = alive[i];
    for (let j = i + 1; j < alive.length; j++) {
      const b = alive[j], min = a.d.r + b.d.r;
      if (b.x - a.x > min) break;
      const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
      if (d2 > 0.01 && d2 < min * min) {
        const dd = Math.sqrt(d2), push = (min - dd) / dd * 0.5, wa = b.d.r / min, wb = a.d.r / min;
        a.x -= dx * push * wa * 0.5; a.y -= dy * push * wa; b.x += dx * push * wb * 0.5; b.y += dy * push * wb;
      }
    }
  }
  game.units = game.units.filter(u => !u.dying || u.dying < 0.45);
}

// ---------------- 主更新 ----------------
export function update(rawDt) {
  game.slow += (1 - game.slow) * Math.min(1, rawDt * 1.5);
  const dt = rawDt * game.slow;
  game.phaseT += dt;
  for (let i = timers.length - 1; i >= 0; i--) { timers[i].t -= dt; if (timers[i].t <= 0) { timers[i].fn(); timers.splice(i, 1); } }

  if (game.phase === 'intro' && game.phaseT >= INTRO_TIME) { game.phase = 'play'; game.phaseT = 0; sfx('horn'); }
  if (game.phase === 'play' || game.phase === 'final') {
    game.time -= dt;
    if (game.phase === 'play' && game.time <= FINAL_TIME) {
      game.phase = 'final'; pushBanner({ kind: 'final', text: '决战时刻', sub: '最后 30 秒 · 全军伤害 ×1.5' }); F.flash(0.3, '#ff6060'); sfx('horn');
    }
    for (const t of ['red', 'blue']) {
      game.rage[t] = Math.max(0, game.rage[t] - dt); game.rageCd[t] = Math.max(0, game.rageCd[t] - dt);
      if (game.energy[t] >= ENERGY_MAX) { game.energy[t] = 0; ultimate(t); }
    }
    const r = game.castles.red.hp, b = game.castles.blue.hp;
    if (r <= 0 || b <= 0 || game.time <= 0) endRound(r === b ? 'draw' : r > b ? 'red' : 'blue');
  }
  if (game.phase === 'over' && game.phaseT >= OVER_TIME) newRound();

  if (game.phase !== 'over' || game.phaseT < 3) {
    updateUnits(dt); updateShots(dt); updateCastles(dt);
    for (const s of game.strikes) { s.t += dt; if (s.t >= s.dur && !s.done) { s.done = true; strikeLand(s); } }
    game.strikes = game.strikes.filter(s => !s.done);
  }
  F.updateFx(dt);
  for (const f of game.feed) f.t += rawDt;
  game.feed = game.feed.filter(f => f.t < 9);
  for (const b of game.banners) if (b === game.banners[0]) b.t += rawDt;
  game.banners = game.banners.filter(b => b.t < (b.kind === 'intro' ? INTRO_TIME : 2.8));
  for (const t of game.toasts) t.t += rawDt;
  game.toasts = game.toasts.filter(t => t.t < 2.4).slice(-4);
  return dt;
}

function endRound(winner) {
  game.phase = 'over'; game.phaseT = 0; game.winner = winner;
  const ranked = [...game.players.values()].sort((a, b) => b.score - a.score);
  game.podium = (winner === 'draw' ? ranked : ranked.filter(p => p.team === winner)).slice(0, 3);
  game.mvp = game.podium[0] || null;
  F.flash(0.6, '#fff'); game.slow = 0.25; sfx('win');
}

function pushFeed(f) { game.feed.push({ ...f, t: 0 }); if (game.feed.length > 7) game.feed.shift(); }
function pushBanner(b) {
  if (b.kind === 'gift' || b.kind === 'ult') { // 同类横幅排队，最多积压 4 条
    if (game.banners.length > 4) return;
  }
  game.banners.push({ ...b, t: 0 });
}

export function leaderboard(n = 5) { return [...game.players.values()].sort((a, b) => b.score - a.score).slice(0, n); }
