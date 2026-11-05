// 渲染：场景 → 城堡 → 单位（按纵深排序）→ 投射物 → 特效 → HUD
import { W, H, HORIZON, CASTLE_X, CASTLE_BASE, TEAMS, UNITS, CASTLE_HP, ENERGY_MAX, FINAL_TIME, INTRO_TIME, OVER_TIME, depthScale } from './config.js';
import { TAU, clamp, rrect, linGrad, radGrad, rgba, text, measure, easeOut, easeOutBack, rand } from './util.js';
import { frame, flashOf, FRAMES, S, drawCastle, CASTLE_FLAGS, crestIcon, giftIcon, glowSprite } from './art.js';
import { buildScene, drawSky, drawMotes, drawVignette, drawFlag } from './scene.js';
import { fx, drawFx } from './fx.js';
import { game, leaderboard, teamPlayers } from './game.js';

const castleImgs = { red: [], blue: [] };
const icons = {};
let T = 0;
export const quality = { low: false };

export function initRender() {
  buildScene();
  for (const t of ['red', 'blue']) for (let lv = 0; lv <= 3; lv++) castleImgs[t][lv] = drawCastle(t, lv);
  for (const t of ['red', 'blue']) { icons[t] = crestIcon(t, 44); icons[t + 's'] = crestIcon(t, 22); }
  for (const g of ['小心心', '玫瑰', '甜甜圈', '火箭']) icons[g] = giftIcon(g, 40);
}

export function render(ctx, dt) {
  T += dt;
  ctx.save();
  if (fx.shake > 0) { const s = fx.shake * fx.shake * 14; ctx.translate(rand(-s, s), rand(-s, s)); }
  drawSky(ctx, T, dt);
  drawFx(ctx, 'ground');
  // 城堡（在单位后面）
  for (const t of ['red', 'blue']) drawCastleAt(ctx, t);
  drawShadows(ctx);
  const list = game.units.slice().sort((a, b) => a.y - b.y);
  for (const u of list) if (!u.fly) drawUnit(ctx, u);
  drawShots(ctx);
  for (const u of list) if (u.fly) drawUnit(ctx, u);
  drawStrikes(ctx);
  drawFx(ctx, 'top');
  if (!quality.low) drawMotes(ctx, T, dt);
  drawNames(ctx, list);
  ctx.restore();
  drawVignette(ctx);
  if (game.rage.red > 0 || game.rage.blue > 0) drawRageEdges(ctx);
  if (game.phase === 'final') drawFinalTint(ctx);
  drawHUD(ctx);
  drawFeed(ctx);
  drawToasts(ctx);
  drawBanner(ctx);
  if (game.phase === 'over') drawResult(ctx);
  if (fx.flash > 0) { ctx.globalAlpha = fx.flash * 0.7; ctx.fillStyle = fx.flashColor; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
}

// ---------------- 世界 ----------------
function drawCastleAt(ctx, team) {
  const c = game.castles[team], img = castleImgs[team][c.level];
  const x = CASTLE_X[team], y = CASTLE_BASE;
  ctx.save();
  if (c.hit > 0) ctx.translate(rand(-2, 2), 0);
  if (c.hp <= 0) { ctx.translate(0, Math.min(60, game.phaseT * 40)); ctx.globalAlpha = Math.max(0.35, 1 - game.phaseT * 0.2); }
  ctx.drawImage(img.c, x - img.ax / S, y - img.ay / S, img.w / S, img.h / S);
  if (c.hit > 0) {
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = c.hit * 2;
    ctx.drawImage(glowSprite('#ffffff', 128), x - 110, y - 260, 220, 260);
  }
  ctx.restore();
  const dir = TEAMS[team].dir;
  for (const [fx0, fy] of CASTLE_FLAGS) drawFlag(ctx, x + fx0 * dir, y + fy, team, T + (team === 'red' ? 0 : 1.3), 1);
  // 能量满前，城堡顶上的能量水晶
  const e = game.energy[team] / ENERGY_MAX, cx = x - 6 * dir, cy = y - 352 + Math.sin(T * 2) * 4;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.3 + e * 0.7;
  ctx.drawImage(glowSprite(TEAMS[team].light, 64), cx - 30 - e * 20, cy - 30 - e * 20, 60 + e * 40, 60 + e * 40);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.moveTo(cx, cy - 12); ctx.lineTo(cx + 7, cy); ctx.lineTo(cx, cy + 12); ctx.lineTo(cx - 7, cy); ctx.closePath();
  ctx.fillStyle = linGrad(ctx, cx - 7, cy - 12, cx + 7, cy + 12, ['#ffffff', TEAMS[team].light, TEAMS[team].main]); ctx.fill();
  ctx.strokeStyle = 'rgba(30,15,40,0.8)'; ctx.lineWidth = 1.2; ctx.stroke();
}

function drawShadows(ctx) {
  ctx.fillStyle = 'rgba(25,15,35,0.32)';
  for (const u of game.units) {
    if (u.drop > 0 && u.drop > 300) continue;
    const s = depthScale(u.y), r = (u.d.r + 4) * s * (u.fly ? 1.6 : 1) * (u.dying ? 1 - u.dying * 2 : 1);
    if (r <= 0) continue;
    ctx.beginPath(); ctx.ellipse(u.x, u.y + 1, r, r * 0.32, 0, 0, TAU); ctx.fill();
  }
}

function drawUnit(ctx, u) {
  const s = depthScale(u.y) / S;
  const n = FRAMES[u.anim];
  const fi = Math.min(n - 1, Math.floor(u.animT * n));
  const f = frame(u.type, u.team, u.anim, fi);
  let x = u.x, y = u.y - (u.drop || 0) - (u.fly ? u.fly * depthScale(u.y) + Math.sin(T * 2 + u.id) * 6 : 0);
  ctx.save();
  if (u.dying) { const k = u.dying / 0.45; ctx.globalAlpha = 1 - k; y -= k * 10; }
  const pop = u.born < 0.2 ? easeOutBack(u.born / 0.2) : 1;
  ctx.translate(x, y); ctx.scale(pop, pop);
  ctx.drawImage(u.hit > 0 || u.dying ? flashOf(f) : f.c, -f.ax * s, -f.ay * s, f.w * s, f.h * s);
  if (game.rage[u.team] > 0 && u.d.size < 50 && (u.id + Math.floor(T * 8)) % 6 === 0) {
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5;
    ctx.drawImage(glowSprite(TEAMS[u.team].light, 64), -16, -40 * s * S, 32, 32);
  }
  ctx.restore();
  // 大单位血条
  if (u.d.size >= 50 && !u.dying && !u.drop) {
    const w = u.d.size * 0.7 * depthScale(u.y), by = y - u.d.size * depthScale(u.y) - 8;
    ctx.fillStyle = 'rgba(20,10,30,0.75)'; rrect(ctx, x - w / 2 - 1, by - 1, w + 2, 7, 3); ctx.fill();
    ctx.fillStyle = linGrad(ctx, 0, by, 0, by + 5, [TEAMS[u.team].light, TEAMS[u.team].main]);
    rrect(ctx, x - w / 2, by, w * clamp(u.hp / u.max, 0, 1), 5, 2.5); ctx.fill();
  } else if (u.hp < u.max && !u.dying) {
    const w = 18, by = y - u.d.size * depthScale(u.y) - 3;
    ctx.fillStyle = 'rgba(20,10,30,0.6)'; ctx.fillRect(x - w / 2, by, w, 3);
    ctx.fillStyle = TEAMS[u.team].light; ctx.fillRect(x - w / 2, by, w * clamp(u.hp / u.max, 0, 1), 3);
  }
}

function drawNames(ctx, list) {
  // 只给刚出场 2 秒内的小兵和所有大单位显示名字，避免人多时糊成一片
  let shown = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    const u = list[i];
    if (u.dying || u.drop > 0) continue;
    const big = u.d.size >= 50;
    if (!big && (u.born > 2 || quality.low || shown >= 30)) continue;
    if (!big) { shown++; ctx.globalAlpha = clamp((2 - u.born) * 2, 0, 1); }
    const s = depthScale(u.y);
    const y = u.y - u.d.size * s - (u.fly ? u.fly * s : 0) - (big ? 14 : 8);
    const p = game.players.get(u.owner);
    text(ctx, u.owner, u.x, y, { size: big ? 15 : 11, align: 'center', color: big ? '#fff3c4' : '#ffffff', stroke: rgba(TEAMS[u.team].deep, 0.9), sw: big ? 4 : 3, shadow: false });
    if (big && p) text(ctx, `${u.d.name}`, u.x, y - 15, { size: 11, align: 'center', color: TEAMS[u.team].light, stroke: 'rgba(0,0,0,0.7)', sw: 3, shadow: false });
    ctx.globalAlpha = 1;
  }
}

function drawShots(ctx) {
  for (const s of game.shots) {
    if (s.kind === 'arrow') {
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.ang || 0);
      ctx.strokeStyle = '#5a3a1e'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(4, 0); ctx.stroke();
      ctx.fillStyle = '#e8edf5'; ctx.beginPath(); ctx.moveTo(4, -2); ctx.lineTo(8, 0); ctx.lineTo(4, 2); ctx.fill();
      ctx.fillStyle = TEAMS[s.team].light; ctx.fillRect(-11, -1.8, 3, 3.6);
      ctx.restore();
    } else {
      const col = s.kind === 'bolt' ? TEAMS[s.team].light : s.team === 'red' ? '#ff8a2a' : '#5ab4ff';
      const sz = s.kind === 'breath' ? 26 : s.kind === 'fireball' ? 16 : 10;
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(glowSprite(col, 64), s.x - sz, s.y - sz, sz * 2, sz * 2);
      ctx.drawImage(glowSprite('#ffffff', 64), s.x - sz * 0.35, s.y - sz * 0.35, sz * 0.7, sz * 0.7);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
}

function drawStrikes(ctx) {
  for (const s of game.strikes) {
    if (s.t < 0) continue;
    const k = s.t / s.dur;
    // 地面预警圈
    ctx.globalAlpha = 0.6; ctx.strokeStyle = TEAMS[s.team].light; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(s.x, s.y, 50 * (1 - k * 0.4), 18 * (1 - k * 0.4), 0, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
    if (s.kind === 'meteor') {
      const sx = s.x - 260 * (1 - k), sy = s.y - 520 * (1 - k);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) { const tk = i / 6; ctx.globalAlpha = 0.5 * (1 - tk); const r = 30 * (1 - tk); ctx.drawImage(glowSprite('#ff7a2a', 64), sx - 260 * tk * 0.15 - r, sy - 520 * tk * 0.15 - r, r * 2, r * 2); }
      ctx.globalAlpha = 1; ctx.drawImage(glowSprite('#ffe9a0', 64), sx - 16, sy - 16, 32, 32);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = radGrad(ctx, sx - 3, sy - 3, 1, 10, ['#ffe0a0', '#a2502a', '#3a1a10']);
      ctx.beginPath(); ctx.arc(sx, sy, 9, 0, TAU); ctx.fill();
    }
  }
}

function drawRageEdges(ctx) {
  for (const t of ['red', 'blue']) {
    if (game.rage[t] <= 0) continue;
    const a = 0.25 + 0.15 * Math.sin(T * 10), left = t === 'red';
    ctx.fillStyle = linGrad(ctx, left ? 0 : W, 0, left ? 120 : W - 120, 0, [rgba(TEAMS[t].main, a), rgba(TEAMS[t].main, 0)]);
    ctx.fillRect(left ? 0 : W - 120, 0, 120, H);
  }
}
function drawFinalTint(ctx) {
  const a = 0.08 + 0.06 * Math.sin(T * 5);
  ctx.fillStyle = radGrad(ctx, W / 2, H / 2, H * 0.4, W * 0.7, [[0, 'rgba(255,0,0,0)'], [1, `rgba(255,30,40,${a * 2})`]]);
  ctx.fillRect(0, 0, W, H);
}

// ---------------- 矢量小图标（不依赖 emoji 字体）----------------
function glyph(ctx, kind, x, y, s = 14) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s / 16, s / 16);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(20,10,30,0.9)'; ctx.lineWidth = 1.6;
  const fs = (c, st = true) => { ctx.fillStyle = c; ctx.fill(); if (st) ctx.stroke(); };
  ctx.beginPath();
  if (kind === 'bolt') { ctx.moveTo(2, -8); ctx.lineTo(-5, 1); ctx.lineTo(0, 1); ctx.lineTo(-2, 8); ctx.lineTo(5, -1); ctx.lineTo(0, -1); ctx.closePath(); fs('#ffe36a'); }
  else if (kind === 'people') { ctx.arc(-3.5, -3, 3, 0, TAU); ctx.moveTo(6.5, -3); ctx.arc(3.5, -3, 3, 0, TAU); fs('#e9e2ff');
    ctx.beginPath(); ctx.ellipse(-3.5, 5, 4.5, 3.5, 0, Math.PI, 0); ctx.ellipse(3.5, 5, 4.5, 3.5, 0, Math.PI, 0); fs('#e9e2ff'); }
  else if (kind === 'sword') { for (const d of [1, -1]) { ctx.beginPath(); ctx.moveTo(-6 * d, 6); ctx.lineTo(6 * d, -6); ctx.lineWidth = 4.4; ctx.strokeStyle = 'rgba(20,10,30,0.9)'; ctx.stroke(); ctx.lineWidth = 2.2; ctx.strokeStyle = '#e4ebf3'; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-6 * d + 3 * d, 1); ctx.lineTo(-6 * d - 1 * d, 5 + 0); ctx.lineWidth = 2; ctx.strokeStyle = '#ffd55e'; ctx.stroke(); } }
  else if (kind === 'skull') { ctx.arc(0, -1.5, 6.5, 0, TAU); ctx.rect(-3.5, 3, 7, 4); fs('#f4efe6');
    ctx.beginPath(); ctx.arc(-2.4, -1.5, 1.7, 0, TAU); ctx.arc(2.4, -1.5, 1.7, 0, TAU); ctx.fillStyle = '#2a1834'; ctx.fill(); }
  else if (kind === 'fire') { ctx.moveTo(0, 8); ctx.bezierCurveTo(-8, 7, -7, -2, -2, -8); ctx.bezierCurveTo(-2, -3, 1, -2, 1, -5); ctx.bezierCurveTo(5, -2, 8, 6, 0, 8); ctx.closePath(); fs('#ff8a3a');
    ctx.beginPath(); ctx.moveTo(0, 7); ctx.bezierCurveTo(-4, 6, -3, 1, 0, -2); ctx.bezierCurveTo(3, 2, 4, 6, 0, 7); ctx.fillStyle = '#ffe36a'; ctx.fill(); }
  else if (kind === 'trophy') { ctx.moveTo(-6, -7); ctx.lineTo(6, -7); ctx.lineTo(5, 0); ctx.quadraticCurveTo(0, 5, -5, 0); ctx.closePath(); fs('#ffd55e');
    ctx.beginPath(); ctx.rect(-1.5, 2, 3, 3); ctx.rect(-4.5, 5, 9, 2.6); fs('#d9a43a');
    ctx.beginPath(); ctx.arc(-6.5, -3.5, 2.6, Math.PI * 0.5, Math.PI * 1.5); ctx.moveTo(6.5, -6.1); ctx.arc(6.5, -3.5, 2.6, -Math.PI * 0.5, Math.PI * 0.5); ctx.strokeStyle = '#ffd55e'; ctx.lineWidth = 1.6; ctx.stroke(); }
  else if (kind === 'crown') { ctx.moveTo(-8, 5); ctx.lineTo(-8, -4); ctx.lineTo(-4, 0); ctx.lineTo(0, -7); ctx.lineTo(4, 0); ctx.lineTo(8, -4); ctx.lineTo(8, 5); ctx.closePath(); fs('#ffd55e');
    ctx.beginPath(); ctx.arc(0, 1.5, 1.6, 0, TAU); ctx.fillStyle = '#ff4f7a'; ctx.fill(); }
  ctx.restore();
}
// 一行「图标 + 数字」，align 为 left / right
function glyphRow(ctx, items, x, y, align, o) {
  const gap = 14, iw = 18;
  const widths = items.map(([, s]) => iw + measure(ctx, s, o.size));
  let total = widths.reduce((a, b) => a + b, 0) + gap * (items.length - 1);
  let cx = align === 'left' ? x : x - total;
  items.forEach(([k, s], i) => {
    glyph(ctx, k, cx + 7, y - o.size * 0.35, o.size + 1);
    text(ctx, s, cx + iw, y, { ...o, align: 'left' });
    cx += widths[i] + gap;
  });
  return total;
}

// ---------------- HUD ----------------
function panel(ctx, x, y, w, h, r = 10, a = 0.62) {
  ctx.fillStyle = `rgba(16,10,34,${a})`; rrect(ctx, x, y, w, h, r); ctx.fill();
  ctx.strokeStyle = 'rgba(255,220,150,0.25)'; ctx.lineWidth = 1.2; ctx.stroke();
}

function drawHUD(ctx) {
  const bw = 430, bh = 26, top = 18;
  for (const team of ['red', 'blue']) {
    const tm = TEAMS[team], c = game.castles[team], left = team === 'red';
    const x = left ? 92 : W - 92 - bw;
    // 底板
    ctx.fillStyle = 'rgba(16,10,34,0.75)'; rrect(ctx, x - 4, top - 4, bw + 8, bh + 8, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(255,215,120,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
    // 掉血拖尾 + 血量
    const fill = (v, style) => { const w = bw * clamp(v / CASTLE_HP, 0, 1); ctx.fillStyle = style; rrect(ctx, left ? x : x + bw - w, top, w, bh, 7); ctx.fill(); };
    fill(c.trail, '#fff1c2');
    fill(c.shown, linGrad(ctx, 0, top, 0, top + bh, [tm.light, tm.main, tm.dark]));
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; rrect(ctx, x + 3, top + 2, bw - 6, bh * 0.35, 5); ctx.fill();
    for (const q of [0.25, 0.5, 0.75]) { ctx.fillStyle = 'rgba(20,10,30,0.35)'; ctx.fillRect(x + bw * q, top + 3, 1.5, bh - 6); }
    if (c.hit > 0) { ctx.globalAlpha = c.hit * 4; ctx.fillStyle = '#fff'; rrect(ctx, x, top, bw, bh, 7); ctx.fill(); ctx.globalAlpha = 1; }
    text(ctx, `${tm.name}`, left ? x + 12 : x + bw - 12, top + 19, { size: 16, align: left ? 'left' : 'right', stroke: tm.deep, sw: 4 });
    text(ctx, `${Math.ceil(c.hp)}`, left ? x + bw - 10 : x + 10, top + 19, { size: 15, align: left ? 'right' : 'left', stroke: tm.deep, sw: 4, color: '#fff3c4' });
    // 徽章
    const ix = left ? 30 : W - 74;
    ctx.drawImage(icons[team], ix, 6, 44, 44);
    // 能量条
    const ey = top + bh + 10, ew = 260, ex = left ? x : x + bw - ew, e = game.energy[team] / ENERGY_MAX;
    panel(ctx, ex - 3, ey - 3, ew + 6, 16, 8, 0.7);
    const eg = linGrad(ctx, ex, 0, ex + ew, 0, left ? ['#ff9a3a', '#ffe36a'] : ['#7fe3ff', '#3f8cff']);
    ctx.fillStyle = eg; rrect(ctx, left ? ex : ex + ew * (1 - e), ey, ew * e, 10, 5); ctx.fill();
    if (e > 0.85) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(T * 12); ctx.fillStyle = eg; rrect(ctx, ex, ey, ew, 10, 5); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
    glyphRow(ctx, [['bolt', `大招 ${Math.floor(e * 100)}%`]], left ? ex + ew + 10 : ex - 10, ey + 10, left ? 'left' : 'right', { size: 12, color: '#ffe9a0', stroke: 'rgba(0,0,0,0.7)', sw: 3, shadow: false });
    // 人数 / 兵力
    let units = 0; for (const u of game.units) if (u.team === team && !u.dying) units++;
    const so = { size: 13, color: '#e9e2ff', stroke: 'rgba(0,0,0,0.65)', sw: 3, shadow: false };
    const used = glyphRow(ctx, [['people', String(teamPlayers(team))], ['sword', String(units)], ['skull', String(game.stats[team].kills)]], left ? x : x + bw, ey + 32, left ? 'left' : 'right', so);
    if (game.rage[team] > 0) glyphRow(ctx, [['fire', `士气高涨 ${Math.ceil(game.rage[team])}s`]], left ? x + used + 24 : x + bw - used - 24, ey + 32, left ? 'left' : 'right', { ...so, color: '#ffb36a' });
  }
  // 计时器
  const s = Math.max(0, Math.ceil(game.time)), final = game.phase === 'final';
  const pulse = final ? 1 + 0.06 * Math.sin(T * 10) : 1;
  ctx.save(); ctx.translate(W / 2, 34); ctx.scale(pulse, pulse);
  ctx.fillStyle = linGrad(ctx, 0, -26, 0, 26, final ? ['#7a1020', '#2a0610'] : ['#3a2a60', '#150c2a']);
  ctx.beginPath(); ctx.moveTo(-62, -24); ctx.lineTo(62, -24); ctx.lineTo(52, 24); ctx.lineTo(-52, 24); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#ffd55e'; ctx.lineWidth = 2; ctx.stroke();
  text(ctx, `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`, 0, 10, { size: 30, align: 'center', color: final ? '#ffb0b0' : '#fff3c4', stroke: '#1a0a20', sw: 5 });
  ctx.restore();
  text(ctx, `第 ${game.round} 局`, W / 2, 74, { size: 12, align: 'center', color: '#d9cfff', stroke: 'rgba(0,0,0,0.6)', sw: 3, shadow: false });
  // 指令提示条
  const tip = '弹幕 1/2 选阵营 · 冲 出兵 · 剑/弓/法 换职业 · 666 鼓舞 · 点赞 修城墙';
  const tw = measure(ctx, tip, 14) + 36;
  panel(ctx, W / 2 - tw / 2, 84, tw, 26, 13, 0.55);
  text(ctx, tip, W / 2, 102, { size: 14, align: 'center', color: '#ffe9a0', shadow: false });
  drawBoard(ctx);
}

function drawBoard(ctx) {
  const top = leaderboard(5);
  if (!top.length) return;
  const w = 220, x = W - w - 14, y = H - 30 - top.length * 26 - 34;
  panel(ctx, x, y, w, top.length * 26 + 44, 12);
  glyphRow(ctx, [['trophy', '贡献榜']], x + 14, y + 24, 'left', { size: 15, color: '#ffd55e' });
  const medals = ['#ffd55e', '#d9e2f0', '#e0965a'];
  top.forEach((p, i) => {
    const ry = y + 50 + i * 26;
    if (i < 3) { ctx.fillStyle = medals[i]; ctx.beginPath(); ctx.arc(x + 22, ry - 5, 9, 0, TAU); ctx.fill(); }
    text(ctx, `${i + 1}`, x + 22, ry, { size: 12, align: 'center', color: i < 3 ? '#2a1a10' : '#fff', shadow: false });
    ctx.drawImage(icons[p.team + 's'], x + 36, ry - 16, 20, 20);
    text(ctx, p.nick, x + 60, ry, { size: 14, color: '#fff', shadow: false });
    text(ctx, fmt(p.score), x + w - 14, ry, { size: 13, align: 'right', color: '#ffe9a0', shadow: false });
  });
}
const fmt = v => v >= 10000 ? (v / 10000).toFixed(1) + '万' : String(Math.floor(v));

function drawFeed(ctx) {
  const items = game.feed, x = 16;
  items.forEach((f, i) => {
    const y = H - 24 - (items.length - 1 - i) * 30;
    const a = clamp(Math.min(f.t * 5, (9 - f.t) / 1.2), 0, 1), slide = (1 - easeOut(Math.min(1, f.t * 4))) * -40;
    ctx.globalAlpha = a;
    const nw = measure(ctx, f.nick, 14), tw = measure(ctx, f.text, 14, 'normal');
    const w = 40 + nw + tw + 12 + (f.gift ? 26 : 0);
    ctx.fillStyle = linGrad(ctx, x + slide, 0, x + slide + w, 0, [rgba(TEAMS[f.team].deep, 0.85), rgba(TEAMS[f.team].deep, f.hot ? 0.6 : 0.35)]);
    rrect(ctx, x + slide, y - 19, w, 26, 13); ctx.fill();
    if (f.hot) { ctx.strokeStyle = rgba(TEAMS[f.team].light, 0.8); ctx.lineWidth = 1.4; ctx.stroke(); }
    ctx.drawImage(icons[f.team + 's'], x + slide + 6, y - 17, 22, 22);
    text(ctx, f.nick, x + slide + 32, y, { size: 14, color: f.color || '#fff', shadow: false });
    text(ctx, f.text, x + slide + 38 + nw, y, { size: 14, weight: 'normal', color: '#f4efff', shadow: false });
    if (f.gift) ctx.drawImage(icons[f.gift], x + slide + 42 + nw + tw, y - 18, 24, 24);
  });
  ctx.globalAlpha = 1;
}

function drawToasts(ctx) { // 中档礼物：左侧中部弹出的礼物条
  game.toasts.forEach((t, i) => {
    const k = t.t, y = 260 + i * 54;
    const a = clamp(Math.min(k * 6, (2.4 - k) * 3), 0, 1), slide = (1 - easeOutBack(Math.min(1, k * 3.5))) * -260;
    ctx.globalAlpha = a;
    const nw = measure(ctx, t.nick, 16), w = Math.max(200, nw + 110);
    const x = 14 + slide;
    ctx.fillStyle = linGrad(ctx, x, 0, x + w, 0, [rgba(TEAMS[t.team].main, 0.95), rgba(TEAMS[t.team].dark, 0.0)]);
    rrect(ctx, x, y, w, 46, 23); ctx.fill();
    ctx.fillStyle = t.color; ctx.beginPath(); ctx.arc(x + 23, y + 23, 18, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    text(ctx, t.nick[0], x + 23, y + 29, { size: 16, align: 'center', shadow: false });
    text(ctx, t.nick, x + 48, y + 20, { size: 15, color: '#fff' });
    text(ctx, `送出 ${t.gift}`, x + 48, y + 39, { size: 12, weight: 'normal', color: '#ffe9c0', shadow: false });
    const pop = easeOutBack(Math.min(1, Math.max(0, k * 3 - 0.3)));
    ctx.drawImage(icons[t.gift], x + nw + 56, y + 23 - 20 * pop, 40 * pop, 40 * pop);
    if (t.n > 1) text(ctx, `×${t.n}`, x + nw + 100, y + 34, { size: 22, color: '#ffe36a', stroke: '#5a2a00', sw: 4 });
  });
  ctx.globalAlpha = 1;
}

function drawBanner(ctx) {
  const b = game.banners[0];
  if (!b || game.phase === 'over') return;
  const dur = b.kind === 'intro' ? INTRO_TIME : 2.8, k = b.t;
  const inK = easeOutBack(clamp(k * 3, 0, 1)), out = clamp((dur - k) * 3, 0, 1);
  ctx.save(); ctx.globalAlpha = out;
  const cy = 300;
  if (b.kind === 'intro') {
    ctx.fillStyle = 'rgba(10,5,25,0.45)'; ctx.fillRect(0, 0, W, H);
    const n = Math.ceil(INTRO_TIME - k);
    ctx.translate(W / 2, cy); ctx.scale(inK, inK);
    text(ctx, b.text, 0, -60, { size: 40, align: 'center', color: '#ffe9a0', stroke: '#2a1040', sw: 7 });
    const nk = 1 + (1 - ((INTRO_TIME - k) % 1)) * 0.4;
    ctx.save(); ctx.scale(nk, nk); text(ctx, n > 0 ? String(n) : '开战！', 0, 34, { size: 90, align: 'center', color: '#ffffff', stroke: '#6a1a30', sw: 10 }); ctx.restore();
    text(ctx, b.sub, 0, 100, { size: 20, align: 'center', color: '#ffe9c0', stroke: 'rgba(0,0,0,0.7)', sw: 4 });
    ctx.restore(); return;
  }
  const tm = b.team ? TEAMS[b.team] : { main: '#ff4848', dark: '#5a0a18', light: '#ffb0b0', deep: '#2a0610' };
  const bh = b.big ? 130 : 100;
  // 横幅底带
  ctx.fillStyle = linGrad(ctx, 0, 0, W, 0, [[0, rgba(tm.deep, 0)], [0.2, rgba(tm.dark, 0.92)], [0.5, rgba(tm.main, 0.95)], [0.8, rgba(tm.dark, 0.92)], [1, rgba(tm.deep, 0)]]);
  ctx.fillRect(0, cy - bh / 2 * inK, W, bh * inK);
  ctx.fillStyle = linGrad(ctx, 0, 0, W, 0, [[0, 'rgba(255,215,120,0)'], [0.5, 'rgba(255,215,120,1)'], [1, 'rgba(255,215,120,0)']]);
  ctx.fillRect(0, cy - bh / 2 * inK - 2, W, 2); ctx.fillRect(0, cy + bh / 2 * inK, W, 2);
  // 光束扫过
  const sweep = ((k * 1.2) % 1.4) * W * 1.2 - 200;
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = linGrad(ctx, sweep - 120, 0, sweep + 120, 0, ['rgba(255,255,255,0)', 'rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']);
  ctx.fillRect(0, cy - bh / 2, W, bh);
  ctx.globalCompositeOperation = 'source-over';
  const slide = (1 - easeOut(clamp(k * 2.5, 0, 1))) * 300;
  if (b.kind === 'gift') {
    const ic = icons[b.gift], s = b.big ? 96 : 76, wob = Math.sin(k * 8) * 0.08;
    ctx.save(); ctx.translate(W / 2 - 230 - slide, cy); ctx.rotate(wob);
    ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSprite('#ffe9a0', 64), -s, -s, s * 2, s * 2); ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(ic, -s / 2, -s / 2, s, s); ctx.restore();
    text(ctx, b.text, W / 2 - 160 + slide, cy - 8, { size: b.big ? 38 : 32, color: '#ffffff', stroke: tm.deep, sw: 6 });
    text(ctx, b.sub, W / 2 - 160 + slide, cy + 34, { size: b.big ? 26 : 22, color: '#ffe36a', stroke: tm.deep, sw: 5 });
  } else {
    ctx.translate(W / 2, cy); const sc = 1 + (1 - inK) * 0.6; ctx.scale(sc, sc);
    text(ctx, b.text, 0, 6, { size: 52, align: 'center', color: '#fff3c4', stroke: tm.deep, sw: 8 });
    text(ctx, b.sub, 0, 40, { size: 18, align: 'center', color: '#ffffff', stroke: tm.deep, sw: 4 });
  }
  ctx.restore();
}

function drawResult(ctx) {
  const k = game.phaseT, w = game.winner;
  if (k < 1.2) return; // 先播城堡倒塌
  const a = clamp((k - 1.2) * 2, 0, 1);
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(8,4,20,0.72)'; ctx.fillRect(0, 0, W, H);
  const tm = w === 'draw' ? { main: '#ffffff', deep: '#222', light: '#ddd', dark: '#555' } : TEAMS[w];
  // 旋转光芒
  ctx.save(); ctx.translate(W / 2, 200); ctx.rotate(T * 0.3);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 12; i++) { ctx.rotate(TAU / 12); ctx.fillStyle = rgba(tm.light, 0.08); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-40, -520); ctx.lineTo(40, -520); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  const pop = easeOutBack(clamp((k - 1.2) * 2, 0, 1));
  ctx.save(); ctx.translate(W / 2, 170); ctx.scale(pop, pop);
  if (w !== 'draw') ctx.drawImage(icons[w], -44, -110, 88, 88);
  text(ctx, w === 'draw' ? '平 局' : `${tm.name} 胜利！`, 0, 30, { size: 64, align: 'center', color: '#fff3c4', stroke: tm.deep || '#000', sw: 10 });
  ctx.restore();
  // 领奖台
  const pod = game.podium || [];
  const slots = [[W / 2, 1, 150], [W / 2 - 200, 2, 110], [W / 2 + 200, 3, 85]];
  slots.forEach(([x, rank, h], i) => {
    const p = pod[rank - 1], d = clamp((k - 1.8 - i * 0.25) * 3, 0, 1);
    if (!p || d <= 0) return;
    const base = 600, top = base - h * easeOut(d);
    ctx.fillStyle = linGrad(ctx, 0, top, 0, base, [['#ffe9a0', '#d9a43a', '#8a5a18'][rank - 1], 'rgba(40,20,10,0.9)']);
    rrect(ctx, x - 80, top, 160, base - top, 8); ctx.fill();
    text(ctx, String(rank), x, top + 44, { size: 36, align: 'center', color: '#fff', stroke: '#5a3a10', sw: 6 });
    ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(x, top - 44, 30, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#ffd55e'; ctx.lineWidth = 4; ctx.stroke();
    text(ctx, p.nick[0], x, top - 34, { size: 28, align: 'center' });
    if (rank === 1) { glyph(ctx, 'crown', x, top - 92, 30); text(ctx, 'MVP', x, top - 70, { size: 18, align: 'center', color: '#ffd55e', stroke: '#3a1a00', sw: 4 }); }
    text(ctx, p.nick, x, top - 2, { size: 16, align: 'center', color: '#fff', stroke: 'rgba(0,0,0,0.8)', sw: 4 });
    text(ctx, `贡献 ${fmt(p.score)} · 击杀 ${p.kills}`, x, top + 70, { size: 13, align: 'center', color: '#ffe9c0', shadow: false });
  });
  text(ctx, `${Math.max(0, Math.ceil(OVER_TIME - k))} 秒后开始下一局`, W / 2, 660, { size: 18, align: 'center', color: '#d9cfff', stroke: 'rgba(0,0,0,0.6)', sw: 3 });
  ctx.restore();
}
