// 背景场景：静态部分预渲染成一张图，动态部分（云、飞鸟、萤火、旗帜）每帧绘制
import { canvas, TAU, seeded, linGrad, radGrad, rgba, shade, rand } from './util.js';
import { W, H, HORIZON, GROUND_TOP, GROUND_BOTTOM, CASTLE_X, CASTLE_BASE, TEAMS } from './config.js';
import { glowSprite, softSprite } from './art.js';

let bg = null, vignette = null;
const clouds = [], birds = [], motes = [];

function mountains(ctx, seed, baseY, amp, step, colTop, colBot, rough = 0.5) {
  const r = seeded(seed);
  ctx.beginPath(); ctx.moveTo(0, H);
  let y = baseY - r() * amp;
  for (let x = 0; x <= W + step; x += step) {
    y = baseY - amp * (0.3 + r() * 0.7);
    const mx = x - step / 2, my = baseY - amp * (r() * rough);
    ctx.quadraticCurveTo(mx, my, x, y);
  }
  ctx.lineTo(W, H); ctx.closePath();
  ctx.fillStyle = linGrad(ctx, 0, baseY - amp, 0, baseY + 60, [colTop, colBot]); ctx.fill();
}
function pine(ctx, x, y, h, c1, c2) {
  const w = h * 0.42;
  ctx.fillStyle = shade(c2, -0.3); ctx.fillRect(x - h * 0.04, y - h * 0.18, h * 0.08, h * 0.2);
  for (let i = 0; i < 3; i++) {
    const ty = y - h * (0.15 + i * 0.27), tw = w * (1 - i * 0.25);
    ctx.beginPath(); ctx.moveTo(x, ty - h * 0.42); ctx.lineTo(x + tw, ty); ctx.lineTo(x - tw, ty); ctx.closePath();
    ctx.fillStyle = linGrad(ctx, x - tw, 0, x + tw, 0, [c1, c2]); ctx.fill();
  }
}
function roundTree(ctx, x, y, s, r) {
  ctx.fillStyle = '#4a2f1f'; ctx.fillRect(x - 3 * s, y - 18 * s, 6 * s, 18 * s);
  for (let i = 0; i < 6; i++) {
    const bx = x + (r() - 0.5) * 26 * s, by = y - 30 * s - r() * 22 * s, br = (11 + r() * 8) * s;
    ctx.fillStyle = radGrad(ctx, bx - br * 0.4, by - br * 0.5, br * 0.1, br * 1.1, ['#a9d86a', '#4f9a3f', '#24572f']);
    ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fill();
  }
}
function bush(ctx, x, y, s, r) {
  for (let i = 0; i < 4; i++) {
    const bx = x + (i - 1.5) * 8 * s, by = y - 6 * s - r() * 4 * s, br = (8 + r() * 4) * s;
    ctx.fillStyle = radGrad(ctx, bx - br * 0.3, by - br * 0.5, 1, br, ['#8fcc5c', '#3f8a3a', '#1f4d2a']);
    ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fill();
  }
}

export function buildScene() {
  bg = canvas(W, H);
  const ctx = bg.getContext('2d');
  // 天空：黄昏
  ctx.fillStyle = linGrad(ctx, 0, 0, 0, HORIZON + 40, [[0, '#24204f'], [0.35, '#5b3d78'], [0.68, '#d9708a'], [0.88, '#ffb37a'], [1, '#ffe2a0']]);
  ctx.fillRect(0, 0, W, H);
  // 太阳
  ctx.fillStyle = radGrad(ctx, W / 2, HORIZON - 30, 0, 260, [[0, 'rgba(255,250,215,1)'], [0.12, 'rgba(255,236,170,0.95)'], [0.2, 'rgba(255,190,120,0.45)'], [1, 'rgba(255,140,120,0)']]);
  ctx.fillRect(0, 0, W, HORIZON + 60);
  // 星星
  const rs = seeded(3);
  for (let i = 0; i < 70; i++) { ctx.fillStyle = `rgba(255,255,255,${0.2 + rs() * 0.6})`; const y = rs() * 120; ctx.fillRect(rs() * W, y, 1.4, 1.4); }
  // 远山
  mountains(ctx, 11, HORIZON - 40, 120, 160, '#8a6fa8', '#c793a6', 0.3);
  mountains(ctx, 12, HORIZON - 5, 90, 120, '#6e5a92', '#a77d9b', 0.4);
  // 雪顶高光（第一层远山之上加淡光）
  ctx.fillStyle = 'rgba(255,220,200,0.12)'; ctx.fillRect(0, HORIZON - 160, W, 160);
  // 远处森林
  const rf = seeded(21);
  for (let x = -10; x < W + 10; x += 9) pine(ctx, x + rf() * 6, HORIZON + 14 + rf() * 6, 26 + rf() * 18, '#3d4f6e', '#2b3654');
  mountains(ctx, 13, HORIZON + 26, 22, 90, '#425a5c', '#3a5a45', 0.6);
  // 草地
  ctx.fillStyle = linGrad(ctx, 0, HORIZON + 20, 0, H, [[0, '#5d8f48'], [0.25, '#6ea24f'], [0.7, '#4f8a3e'], [1, '#2f5e2c']]);
  ctx.fillRect(0, HORIZON + 22, W, H);
  // 地面上的太阳反光
  ctx.fillStyle = radGrad(ctx, W / 2, HORIZON + 30, 0, 520, [[0, 'rgba(255,220,150,0.35)'], [1, 'rgba(255,220,150,0)']]);
  ctx.fillRect(0, HORIZON, W, H - HORIZON);
  // 战场土路（透视）
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, GROUND_TOP + 18); ctx.bezierCurveTo(W * 0.3, GROUND_TOP - 4, W * 0.7, GROUND_TOP - 4, W, GROUND_TOP + 18);
  ctx.lineTo(W, GROUND_BOTTOM - 14); ctx.bezierCurveTo(W * 0.7, GROUND_BOTTOM + 14, W * 0.3, GROUND_BOTTOM + 14, 0, GROUND_BOTTOM - 14);
  ctx.closePath();
  ctx.fillStyle = linGrad(ctx, 0, GROUND_TOP, 0, GROUND_BOTTOM, [[0, '#b99a6a'], [0.5, '#a5845a'], [1, '#86663f']]);
  ctx.fill();
  ctx.clip();
  const rd = seeded(31);
  for (let i = 0; i < 900; i++) {
    const x = rd() * W, y = GROUND_TOP + rd() * (GROUND_BOTTOM - GROUND_TOP), s = 0.6 + (y - GROUND_TOP) / 300 * 1.8;
    ctx.fillStyle = rd() < 0.5 ? 'rgba(70,45,20,0.18)' : 'rgba(255,235,190,0.16)';
    ctx.beginPath(); ctx.ellipse(x, y, s * (1 + rd() * 2), s * 0.6, 0, 0, TAU); ctx.fill();
  }
  // 车辙
  for (const off of [0.32, 0.68]) {
    ctx.strokeStyle = 'rgba(80,55,30,0.18)'; ctx.lineWidth = 6;
    ctx.beginPath(); const y = GROUND_TOP + (GROUND_BOTTOM - GROUND_TOP) * off;
    ctx.moveTo(0, y); ctx.bezierCurveTo(W * 0.3, y - 8, W * 0.7, y - 8, W, y); ctx.stroke();
  }
  ctx.restore();
  // 路边过渡草
  const rg = seeded(41);
  for (let i = 0; i < 1400; i++) {
    const x = rg() * W, top = rg() < 0.5;
    const y = top ? GROUND_TOP + 2 + rg() * 26 - Math.sin(x / W * Math.PI) * 18 : GROUND_BOTTOM - 4 + rg() * 40;
    const h = 4 + rg() * 8 * (y / H);
    ctx.strokeStyle = rg() < 0.5 ? '#7dbb55' : '#5a9a45'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rg() - 0.5) * 4, y - h); ctx.stroke();
  }
  // 草地上的花
  const rfl = seeded(51);
  for (let i = 0; i < 140; i++) {
    const x = rfl() * W, y = HORIZON + 36 + rfl() * 20 + (rfl() < 0.6 ? 0 : GROUND_BOTTOM - HORIZON - 10 + rfl() * 30);
    ctx.fillStyle = ['#fff', '#ffe066', '#ff8fb3', '#c9a8ff'][i % 4];
    ctx.beginPath(); ctx.arc(x, y, 1.4 + rfl(), 0, TAU); ctx.fill();
  }
  // 远处树和灌木（地平线附近，城堡之间）
  const rt = seeded(61);
  for (let i = 0; i < 9; i++) roundTree(ctx, 250 + i * 100 + rt() * 40, HORIZON + 46 + rt() * 10, 0.7 + rt() * 0.25, rt);
  for (let i = 0; i < 14; i++) bush(ctx, 220 + i * 62 + rt() * 20, GROUND_TOP + 4 - Math.sin((i / 14) * Math.PI) * 14, 0.7, rt);
  // 前景下方的灌木与石头（不遮挡太多）
  for (let i = 0; i < 10; i++) bush(ctx, 40 + i * 135 + rt() * 40, H + 4, 1.4, rt);
  // 城堡位置的地面阴影
  for (const t of ['red', 'blue']) {
    ctx.fillStyle = radGrad(ctx, CASTLE_X[t], CASTLE_BASE + 4, 10, 170, [[0, 'rgba(20,10,30,0.45)'], [1, 'rgba(20,10,30,0)']]);
    ctx.save(); ctx.translate(CASTLE_X[t], CASTLE_BASE + 4); ctx.scale(1, 0.28); ctx.translate(-CASTLE_X[t], -(CASTLE_BASE + 4));
    ctx.fillRect(CASTLE_X[t] - 180, CASTLE_BASE - 170, 360, 340); ctx.restore();
    // 己方地面淡淡的阵营色
    ctx.fillStyle = radGrad(ctx, CASTLE_X[t], CASTLE_BASE - 40, 20, 360, [[0, rgba(TEAMS[t].main, 0.18)], [1, rgba(TEAMS[t].main, 0)]]);
    ctx.fillRect(CASTLE_X[t] - 360, HORIZON, 720, H - HORIZON);
  }

  // 暗角
  vignette = canvas(W, H);
  const v = vignette.getContext('2d');
  v.fillStyle = radGrad(v, W / 2, H * 0.48, H * 0.45, W * 0.72, [[0, 'rgba(10,5,25,0)'], [1, 'rgba(10,5,25,0.55)']]);
  v.fillRect(0, 0, W, H);

  // 云
  const rc = seeded(71);
  for (let i = 0; i < 9; i++) clouds.push({ x: rc() * W, y: 40 + rc() * 170, s: 0.6 + rc() * 0.9, v: 4 + rc() * 8, c: makeCloud(rc) });
  for (let i = 0; i < 5; i++) birds.push({ x: rand(W), y: rand(60, 200), v: rand(25, 45), ph: rand(TAU), s: rand(0.7, 1.2) });
  for (let i = 0; i < 40; i++) motes.push({ x: rand(W), y: rand(HORIZON, H), ph: rand(TAU), v: rand(6, 16) });
}
function makeCloud(r) {
  const c = canvas(220, 90), ctx = c.getContext('2d');
  const puffs = 6 + (r() * 4 | 0);
  for (let i = 0; i < puffs; i++) {
    const x = 40 + r() * 140, y = 50 - Math.sin((x - 40) / 140 * Math.PI) * 22 + r() * 8, rr = 16 + r() * 18;
    ctx.fillStyle = radGrad(ctx, x - rr * 0.3, y - rr * 0.6, 2, rr * 1.2, [[0, 'rgba(255,240,235,0.95)'], [0.6, 'rgba(250,190,190,0.85)'], [1, 'rgba(190,130,170,0.0)']]);
    ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill();
  }
  return c;
}

export function drawSky(ctx, t, dt) {
  ctx.drawImage(bg, 0, 0);
  for (const c of clouds) {
    c.x += c.v * dt; if (c.x > W + 50) c.x = -240 * c.s;
    ctx.globalAlpha = 0.85; ctx.drawImage(c.c, c.x, c.y, 220 * c.s, 90 * c.s);
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(40,20,50,0.7)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  for (const b of birds) {
    b.x += b.v * dt; b.ph += dt * 9; if (b.x > W + 20) { b.x = -20; b.y = rand(60, 200); }
    const f = Math.sin(b.ph) * 4 * b.s;
    ctx.beginPath(); ctx.moveTo(b.x - 7 * b.s, b.y - f); ctx.quadraticCurveTo(b.x - 3 * b.s, b.y - 3, b.x, b.y);
    ctx.quadraticCurveTo(b.x + 3 * b.s, b.y - 3, b.x + 7 * b.s, b.y - f); ctx.stroke();
  }
}
export function drawMotes(ctx, t, dt) { // 漂浮的光点（萤火虫），叠加发光
  ctx.globalCompositeOperation = 'lighter';
  const g = glowSprite('#ffe9a0', 32);
  for (const m of motes) {
    m.ph += dt; m.x += Math.sin(m.ph * 0.7) * 10 * dt + 4 * dt; m.y -= m.v * dt * 0.3;
    if (m.y < HORIZON || m.x > W) { m.x = rand(W); m.y = rand(HORIZON + 100, H); }
    const a = 0.25 + 0.25 * Math.sin(m.ph * 3);
    ctx.globalAlpha = a; ctx.drawImage(g, m.x - 8, m.y - 8, 16, 16);
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}
export function drawVignette(ctx) { ctx.drawImage(vignette, 0, 0); }

// 旗帜（每帧绘制，会飘动）
export function drawFlag(ctx, x, y, team, t, scale = 1) {
  const tm = TEAMS[team], dir = -tm.dir; // 旗子朝向远离战场的一侧飘
  ctx.strokeStyle = '#3a2a20'; ctx.lineWidth = 2.4 * scale;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 34 * scale); ctx.stroke();
  ctx.fillStyle = '#ffd55e'; ctx.beginPath(); ctx.arc(x, y, 2.6 * scale, 0, TAU); ctx.fill();
  const L = 34 * scale, Hh = 18 * scale, seg = 10;
  ctx.beginPath();
  for (let i = 0; i <= seg; i++) { const k = i / seg; ctx.lineTo(x + dir * L * k, y + 3 * scale + Math.sin(t * 6 - k * 5) * 3 * k * scale); }
  for (let i = seg; i >= 0; i--) { const k = i / seg; ctx.lineTo(x + dir * L * k * (i === seg ? 0.85 : 1), y + 3 * scale + Hh + Math.sin(t * 6 - k * 5) * 3 * k * scale - (i === seg ? Hh / 2 : 0)); }
  ctx.closePath();
  ctx.fillStyle = linGrad(ctx, x, 0, x + dir * L, 0, [tm.main, tm.light]); ctx.fill();
  ctx.strokeStyle = 'rgba(30,15,40,0.8)'; ctx.lineWidth = 1.2; ctx.stroke();
}
export { softSprite };
