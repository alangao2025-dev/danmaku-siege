// 程序化美术：所有角色、城堡、图标都在启动时用代码画好并缓存成图片帧
// 坐标约定：原点在角色脚底中心，y 向上为负，角色面朝右；蓝方在缓存时镜像
import { canvas, TAU, seeded, shade, rgba, linGrad, radGrad } from './util.js';
import { TEAMS, UNITS } from './config.js';

export const S = 2; // 缓存分辨率：每个逻辑像素画 2 个像素
const OUT = '#1d1430';
const SKIN = '#ffd6ad', SKIN_D = '#eaa47c';
const METAL = '#e4ebf3', METAL_D = '#7f8aa0';
const LEATHER = '#8d5a33', LEATHER_D = '#56341c';
const GOLD = '#ffd55e', GOLD_D = '#b97f12';
const WOOD = '#a8713f', WOOD_D = '#64401f';

// ---------- 基础画法 ----------
function limb(ctx, x0, y0, x1, y1, w, color) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUT; ctx.lineWidth = w + 2.2;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
}
function shape(ctx, build, fill, lw = 1.3, stroke = OUT) {
  ctx.beginPath(); build(ctx);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (lw) { ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
}
const ell = (x, y, rx, ry, rot = 0) => c => c.ellipse(x, y, rx, ry, rot, 0, TAU);
const circ = (x, y, r) => c => c.arc(x, y, r, 0, TAU);
const poly = pts => c => { c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); };
const vgrad = (ctx, y0, y1, a, b, c) => linGrad(ctx, 0, y0, 0, y1, c ? [a, b, c] : [a, b]);
const at = (x, y, a, l) => [x + Math.sin(a) * l, y + Math.cos(a) * l]; // a=0 向下，a=π/2 向前
function glow(ctx, color, blur, fn) { ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = blur; fn(); ctx.restore(); }

// ---------- 小人通用部件 ----------
function leg(ctx, x, y, a, color, len = 7.6) {
  const [fx, fy] = at(x, y, a, len);
  limb(ctx, x, y, fx, fy, 4.4, color);
  shape(ctx, ell(fx + 1.3, fy + 0.2, 3, 1.9), LEATHER_D, 1.1);
}
function arm(ctx, x, y, a, color, len = 6.6) {
  const [hx, hy] = at(x, y, a, len);
  limb(ctx, x, y, hx, hy, 3.6, color);
  shape(ctx, circ(hx, hy, 2), SKIN, 1);
  return [hx, hy];
}
function face(ctx, x, y, o = {}) {
  shape(ctx, circ(x, y, 8.6), radGrad(ctx, x - 3, y - 4, 1, 11, ['#fff1df', SKIN, SKIN_D]), 1.4);
  for (const ex of [x + 1.4, x + 5.5]) {
    shape(ctx, ell(ex, y + 0.6, 1.25, 1.95), '#2a1834', 0);
    shape(ctx, circ(ex + 0.45, y - 0.2, 0.55), '#fff', 0);
  }
  shape(ctx, ell(x + 5.2, y + 3.8, 1.8, 1), 'rgba(255,110,120,0.45)', 0);
  shape(ctx, c => { c.moveTo(x + 4.6, y + 5.2); c.quadraticCurveTo(x + 5.5, y + 6, x + 6.6, y + 5.1); }, null, 0.9);
  if (o.brow) shape(ctx, c => { c.moveTo(x + 0.2, y - 2.6); c.lineTo(x + 2.8, y - 1.6); c.moveTo(x + 4.6, y - 1.6); c.lineTo(x + 7, y - 2.7); }, null, 1);
}
function torso(ctx, tm, shY, hipY, fill) {
  shape(ctx, c => roundRectPath(c, -5.6, shY - 1.6, 11.2, hipY - shY + 2.6, 3.6), fill || vgrad(ctx, shY, hipY, tm.light, tm.main, tm.dark), 1.4);
  shape(ctx, c => c.rect(-5.4, hipY - 2.2, 10.8, 2.2), LEATHER, 1);
  shape(ctx, c => c.rect(0.6, hipY - 2.6, 2.6, 3), GOLD, 0.9);
}
function roundRectPath(c, x, y, w, h, r) {
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

// ---------- 姿势 ----------
function walkPose(t) {
  const p = t * TAU, s = Math.sin(p);
  return { legA: s * 0.62, bob: -Math.abs(Math.cos(p)) * 1.1, armF: -s * 0.5 + 0.25, armB: s * 0.5 + 0.25 };
}

// ---------- 剑士 ----------
function drawSword(ctx, tm, anim, t) {
  const P = walkPose(anim === 'walk' ? t : 0);
  let armF = P.armF, bladeOff = 2.3, lean = 0;
  if (anim === 'attack') {
    if (t < 0.45) { const k = t / 0.45; armF = 0.3 + k * 2.9; bladeOff = 2.3 - k * 1.6; lean = -k * 1.2; }
    else if (t < 0.65) { const k = (t - 0.45) / 0.2; armF = 3.2 - k * 2.0; bladeOff = 0.7 + k * 0.9; lean = -1.2 + k * 3; }
    else { const k = (t - 0.65) / 0.35; armF = 1.2 - k * 0.9; bladeOff = 1.6 + k * 0.7; lean = 1.8 - k * 1.8; }
  }
  ctx.save(); ctx.translate(lean, 0);
  const hipY = -8 + P.bob, shY = -16.6 + P.bob, hY = -25.8 + P.bob;
  leg(ctx, -1.6, hipY, -P.legA, shade(tm.dark, -0.2));
  arm(ctx, -2, shY + 1, P.armB + 0.6, shade(tm.main, -0.25));
  leg(ctx, 1.6, hipY, P.legA, tm.dark);
  torso(ctx, tm, shY, hipY);
  shape(ctx, c => roundRectPath(c, -5.6, shY - 1.6, 11.2, 6.4, 3.4), vgrad(ctx, shY - 2, shY + 5, '#ffffff', METAL, METAL_D), 1.3);
  // 盾牌
  const sx = 4.6, sy = shY + 6;
  shape(ctx, circ(sx, sy, 6.4), radGrad(ctx, sx - 2, sy - 2, 0.5, 7, [tm.light, tm.main, tm.dark]), 1.4);
  shape(ctx, circ(sx, sy, 6.4), null, 1.6, METAL_D);
  shape(ctx, circ(sx, sy, 4.6), null, 0.9, rgba('#ffffff', 0.35));
  shape(ctx, circ(sx, sy, 1.9), radGrad(ctx, sx - 0.6, sy - 0.6, 0.2, 2, ['#fff7c9', GOLD, GOLD_D]), 1);
  face(ctx, 0.6, hY, { brow: true });
  // 头盔 + 羽毛
  shape(ctx, c => { c.moveTo(-0.8, hY - 8.6); c.bezierCurveTo(-7, hY - 15, -13, hY - 12, -13.5, hY - 4); c.bezierCurveTo(-10, hY - 8, -6, hY - 9, -2, hY - 6); c.closePath(); }, vgrad(ctx, hY - 14, hY - 4, tm.light, tm.main), 1.2);
  shape(ctx, c => { c.arc(0.6, hY, 9.5, Math.PI * 1.04, Math.PI * 1.96); c.lineTo(10.2, hY - 1.4); c.lineTo(-9, hY - 1.4); c.closePath(); }, vgrad(ctx, hY - 10, hY - 1, '#ffffff', METAL, METAL_D), 1.4);
  shape(ctx, c => c.rect(-9.1, hY - 3.4, 19.3, 2.3), tm.main, 1.1);
  shape(ctx, c => { c.moveTo(0.6, hY - 9.4); c.lineTo(0.6, hY - 3.4); }, null, 1, rgba('#ffffff', 0.7));
  // 持剑手
  const [hx, hy] = arm(ctx, 1.5, shY + 1, armF, tm.main);
  const b = armF + bladeOff, [tx, ty] = at(hx, hy, b, 15), px = Math.cos(b), py = -Math.sin(b);
  shape(ctx, poly([[hx + px * 1.4, hy + py * 1.4], [tx + px * 0.6, ty + py * 0.6], [...at(hx, hy, b, 17)], [tx - px * 0.6, ty - py * 0.6], [hx - px * 1.4, hy - py * 1.4]]),
    linGrad(ctx, hx - px * 2, hy - py * 2, hx + px * 2, hy + py * 2, ['#ffffff', '#cfd8e6', '#8994aa']), 1.1);
  limb(ctx, hx - px * 3.4, hy - py * 3.4, hx + px * 3.4, hy + py * 3.4, 1.8, GOLD);
  shape(ctx, circ(...at(hx, hy, b, -2.4), 1.3), GOLD, 0.9);
  ctx.restore();
}

// ---------- 弓手 ----------
function drawArcher(ctx, tm, anim, t) {
  const P = walkPose(anim === 'walk' ? t : 0);
  let pull = 0, aim = 1.75, release = false;
  if (anim === 'attack') { pull = t < 0.6 ? t / 0.6 : 0; release = t >= 0.6; aim = 1.95; }
  const hipY = -8 + P.bob, shY = -16.6 + P.bob, hY = -25.8 + P.bob;
  // 箭袋
  ctx.save(); ctx.translate(-5.5, shY + 3); ctx.rotate(-0.45);
  for (let i = 0; i < 3; i++) shape(ctx, poly([[-1.6 + i * 1.6, -13], [-0.2 + i * 1.6, -15.5], [1.2 + i * 1.6, -13], [0.4 + i * 1.6, -10]]), i === 1 ? tm.light : '#f4f0e6', 0.8);
  shape(ctx, c => roundRectPath(c, -2.8, -11, 5.6, 13, 2), vgrad(ctx, -11, 2, LEATHER, LEATHER_D), 1.2);
  ctx.restore();
  leg(ctx, -1.6, hipY, -P.legA, '#3d4a2a');
  leg(ctx, 1.6, hipY, P.legA, '#55643a');
  const green = shade(tm.main, -0.15);
  torso(ctx, tm, shY, hipY, vgrad(ctx, shY, hipY, tm.main, tm.dark));
  shape(ctx, c => { c.moveTo(-5, shY - 1); c.lineTo(5.4, hipY - 2); }, null, 2.2, LEATHER_D);
  // 兜帽（后半）
  shape(ctx, c => { c.arc(-0.6, hY - 0.4, 10.2, 0, TAU); }, vgrad(ctx, hY - 10, hY + 10, tm.main, tm.deep), 1.4);
  face(ctx, 0.8, hY);
  shape(ctx, c => { c.arc(0.4, hY - 0.4, 10.2, Math.PI * 0.98, Math.PI * 1.9); c.quadraticCurveTo(4, hY - 4.5, -3, hY - 4); c.quadraticCurveTo(-8, hY - 3, -10, hY + 3); c.closePath(); }, vgrad(ctx, hY - 11, hY - 3, tm.light, green), 1.3);
  shape(ctx, poly([[-8, hY - 6], [-16, hY - 2], [-9.5, hY + 2]]), green, 1.2);
  // 拉弦手
  const [fx, fy] = at(1.8, shY + 1.5, aim, 7.6);
  const pbx = fx - 3 - pull * 7, pby = fy;
  arm(ctx, -1, shY + 1.5, anim === 'attack' ? 1.6 + pull * 0.3 : P.armB + 0.5, green);
  if (anim === 'attack' && !release) { shape(ctx, circ(pbx, pby, 2), SKIN, 1); }
  // 弓
  const bend = 4 + pull * 2;
  shape(ctx, c => { c.moveTo(fx - 1, fy - 12); c.quadraticCurveTo(fx + bend + 3, fy, fx - 1, fy + 12); }, null, 4.2, OUT);
  shape(ctx, c => { c.moveTo(fx - 1, fy - 12); c.quadraticCurveTo(fx + bend + 3, fy, fx - 1, fy + 12); }, null, 2.4, WOOD);
  shape(ctx, c => { c.moveTo(fx - 1, fy - 12); c.lineTo(anim === 'attack' && !release ? pbx : fx - 1, pby); c.lineTo(fx - 1, fy + 12); }, null, 0.7, '#f6f1e1');
  if (anim === 'attack' && !release) {
    shape(ctx, c => { c.moveTo(pbx, pby); c.lineTo(fx + 8, fy); }, null, 1.2, WOOD_D);
    shape(ctx, poly([[fx + 8, fy - 1.6], [fx + 11, fy], [fx + 8, fy + 1.6]]), METAL, 0.8);
  }
  arm(ctx, 1.8, shY + 1.5, anim === 'attack' ? aim : P.armF + 0.6, green);
}

// ---------- 法师 ----------
function drawMage(ctx, tm, anim, t) {
  const P = walkPose(anim === 'walk' ? t : 0);
  let raise = 0, charge = 0.35;
  if (anim === 'attack') { raise = t < 0.5 ? t / 0.5 : 1 - (t - 0.5) / 0.5; charge = 0.35 + (t < 0.55 ? t / 0.55 : 0) * 0.65; }
  const hipY = -8 + P.bob, shY = -16.6 + P.bob, hY = -25.8 + P.bob;
  leg(ctx, -1.6, hipY, -P.legA * 0.6, '#3a2d4a', 7.4);
  leg(ctx, 1.6, hipY, P.legA * 0.6, '#3a2d4a', 7.4);
  // 长袍
  shape(ctx, c => { c.moveTo(-5.4, shY - 1); c.lineTo(5.6, shY - 1); c.lineTo(8 + P.legA * 2, -2.2); c.lineTo(-8 + P.legA * 2, -2.2); c.closePath(); }, vgrad(ctx, shY, -2, tm.light, tm.main, tm.dark), 1.4);
  shape(ctx, c => { c.moveTo(-8 + P.legA * 2, -3.6); c.lineTo(8 + P.legA * 2, -3.6); }, null, 1.8, GOLD);
  shape(ctx, c => { c.moveTo(1.5, shY); c.lineTo(2 + P.legA * 2, -3.6); }, null, 1.4, GOLD);
  shape(ctx, c => c.rect(-5.4, hipY - 4, 10.8, 2), '#f2e7c4', 0.9);
  // 胡子 + 脸
  face(ctx, 0.6, hY);
  shape(ctx, c => { c.moveTo(-1, hY + 3); c.quadraticCurveTo(5, hY + 15, 9, hY + 3.4); c.quadraticCurveTo(5, hY + 6.5, -1, hY + 3); }, vgrad(ctx, hY + 3, hY + 13, '#ffffff', '#d7d9e6'), 1.1);
  // 尖帽
  shape(ctx, c => { c.moveTo(-8.2, hY - 4.5); c.quadraticCurveTo(-2, hY - 15, -9, hY - 27); c.quadraticCurveTo(2, hY - 18, 9, hY - 5); c.closePath(); }, vgrad(ctx, hY - 27, hY - 4, tm.light, tm.main, tm.dark), 1.3);
  shape(ctx, ell(0.4, hY - 4.6, 11.6, 2.8), vgrad(ctx, hY - 7, hY - 2, tm.main, tm.deep), 1.3);
  shape(ctx, c => { c.moveTo(-6.6, hY - 7.2); c.quadraticCurveTo(0, hY - 9.5, 7.6, hY - 6.8); }, null, 1.7, GOLD);
  star(ctx, -9, hY - 27.5, 2.4, GOLD);
  // 法杖
  const a = 0.35 + raise * 1.4;
  const [hx, hy] = at(1.5, shY + 1.5, a, 6.6);
  const sa = Math.PI + 0.12 - raise * 0.5, [ox, oy] = at(hx, hy, sa, 15);
  limb(ctx, ...at(hx, hy, sa, -8), ox, oy, 1.8, WOOD);
  glow(ctx, tm.light, 8 + charge * 14, () => shape(ctx, circ(ox, oy - 1.5, 3.2 + charge * 0.9), radGrad(ctx, ox - 1, oy - 2.5, 0.3, 4.5, ['#ffffff', tm.light, tm.main]), 1));
  shape(ctx, c => { c.moveTo(ox - 3, oy + 1.4); c.quadraticCurveTo(ox - 4.5, oy - 3.5, ox - 1.6, oy - 5.6); c.moveTo(ox + 3, oy + 1.4); c.quadraticCurveTo(ox + 4.5, oy - 3.5, ox + 1.6, oy - 5.6); }, null, 1.2, GOLD_D);
  limb(ctx, 1.5, shY + 1.5, hx, hy, 4.4, tm.main);
  shape(ctx, circ(hx, hy, 2), SKIN, 1);
}
function star(ctx, x, y, r, fill) {
  const pts = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
  shape(ctx, poly(pts), fill, 0.9);
}

// ---------- 骑士（骑马）----------
function drawKnight(ctx, tm, anim, t, team) {
  const p = (anim === 'walk' ? t : 0.15) * TAU, bob = Math.sin(p * 2) * 1.2;
  const coat = team === 'red' ? ['#c7875a', '#8b5332', '#5a321c'] : ['#ffffff', '#e5e1d8', '#a9a39a'];
  const hair = team === 'red' ? '#3a2015' : '#8e8a86';
  const legs = [[13, p + 0.7, 1], [-12, p + Math.PI + 0.7, 1], [13, p, 0], [-12, p + Math.PI, 0]];
  const drawLeg = ([x, ph, far]) => {
    const a = Math.sin(ph) * 0.62, y0 = -19 + bob;
    const [kx, ky] = at(x, y0, a, 8), [fx, fy] = at(kx, ky, a * 0.4 - Math.max(0, Math.cos(ph)) * 0.7 * Math.sign(x), 8);
    const col = far ? coat[2] : coat[1];
    limb(ctx, x, y0, kx, ky, 4.6, col); limb(ctx, kx, ky, fx, fy, 3.3, col);
    shape(ctx, ell(fx + 0.6, fy + 0.4, 2.4, 1.6), '#2b2228', 1);
  };
  drawLeg(legs[0]); drawLeg(legs[1]);
  // 尾巴
  shape(ctx, c => { c.moveTo(-17, -27 + bob); c.bezierCurveTo(-26, -28 + bob, -27, -16 + bob, -23 - Math.sin(p) * 2, -9 + bob); c.bezierCurveTo(-24, -19, -22, -24, -16, -24 + bob); c.closePath(); }, hair, 1.2);
  // 身体
  shape(ctx, ell(0, -25 + bob, 18.5, 8.8), vgrad(ctx, -34, -16, coat[0], coat[1], coat[2]), 1.5);
  // 脖子 + 头
  shape(ctx, poly([[9, -31 + bob], [16, -24 + bob], [24, -36 + bob], [19, -43 + bob]]), vgrad(ctx, -43, -24, coat[0], coat[1]), 1.4);
  shape(ctx, ell(25.5, -39.5 + bob, 7.6, 4.3, 0.55), vgrad(ctx, -45, -34, coat[0], coat[1]), 1.4);
  shape(ctx, ell(29.6, -35.4 + bob, 3.4, 2.8, 0.55), shade(coat[1], -0.25), 1.1);
  shape(ctx, poly([[19.6, -44 + bob], [20.6, -49.5 + bob], [23.4, -44.6 + bob]]), coat[1], 1.1);
  shape(ctx, circ(25.2, -41.2 + bob, 1.1), '#1a1020', 0);
  shape(ctx, c => { c.moveTo(18.5, -44 + bob); for (let i = 0; i < 5; i++) c.lineTo(15.5 - i * 1.6 + (i % 2) * 2, -42 + i * 3.2 + bob); c.lineTo(10, -30 + bob); c.lineTo(15, -32 + bob); c.closePath(); }, tm.main, 1.1);
  // 马铠
  shape(ctx, c => { c.moveTo(-17, -28 + bob); c.quadraticCurveTo(0, -36 + bob, 15, -29 + bob); c.lineTo(15, -20 + bob);
    for (let i = 0; i <= 8; i++) { const x = 15 - i * 4; c.quadraticCurveTo(x - 2, -15 + bob, x - 4, -20 + bob); } c.lineTo(-17, -28 + bob); c.closePath(); },
  vgrad(ctx, -34, -16, tm.light, tm.main, tm.dark), 1.3);
  shape(ctx, c => { c.moveTo(-16, -21 + bob); c.lineTo(15, -21 + bob); }, null, 1.4, GOLD);
  crestMark(ctx, team, -1, -26 + bob, 4.2);
  drawLeg(legs[2]); drawLeg(legs[3]);
  // 骑手
  const rb = bob - 0.6;
  limb(ctx, 0, -31 + rb, 4.5, -23 + rb, 4, shade(tm.dark, -0.2));
  shape(ctx, ell(5.4, -22.4 + rb, 2.7, 1.8), LEATHER_D, 1);
  shape(ctx, c => roundRectPath(c, -5, -45 + rb, 10.5, 15, 3.5), vgrad(ctx, -45, -30, '#ffffff', METAL, METAL_D), 1.4);
  shape(ctx, c => { c.moveTo(-3.4, -43 + rb); c.lineTo(4, -43 + rb); c.lineTo(3, -30 + rb); c.lineTo(-2.6, -30 + rb); c.closePath(); }, vgrad(ctx, -45, -30, tm.light, tm.main), 1.1);
  const hy = -52.5 + rb;
  shape(ctx, c => { c.moveTo(0, hy - 7); c.bezierCurveTo(-6, hy - 17, -13, hy - 13, -14, hy - 2); c.bezierCurveTo(-9, hy - 8, -5, hy - 8, -1, hy - 5); c.closePath(); }, vgrad(ctx, hy - 15, hy - 2, tm.light, tm.main), 1.2);
  shape(ctx, c => { c.arc(0.6, hy, 7.8, Math.PI * 0.9, Math.PI * 2.25); c.closePath(); }, radGrad(ctx, -2, hy - 3, 1, 10, ['#ffffff', METAL, METAL_D]), 1.4);
  shape(ctx, c => { c.moveTo(2, hy - 0.4); c.lineTo(8.2, hy - 0.4); }, null, 1.6, '#1a1020');
  shape(ctx, c => { c.moveTo(1, hy + 2.6); c.lineTo(7.6, hy + 2.6); }, null, 0.9, METAL_D);
  // 长枪
  let thrust = 0, tilt = -0.12;
  if (anim === 'attack') { thrust = t < 0.35 ? -t / 0.35 * 4 : t < 0.55 ? -4 + (t - 0.35) / 0.2 * 13 : 9 - (t - 0.55) / 0.45 * 9; tilt = 0.05; }
  ctx.save(); ctx.translate(thrust, -38 + rb); ctx.rotate(tilt);
  limb(ctx, -10, 0, 34, 0, 2.6, WOOD);
  shape(ctx, poly([[33, -2.6], [44, 0], [33, 2.6]]), linGrad(ctx, 33, -3, 33, 3, ['#ffffff', METAL_D]), 1.1);
  shape(ctx, poly([[24, -1.4], [24, -8], [31, -5.6], [26, -4.6], [30, -2]]), tm.main, 1);
  shape(ctx, ell(4, 0, 2.6, 4.4), GOLD, 1);
  ctx.restore();
  limb(ctx, 1, -42 + rb, 3 + thrust * 0.6, -38 + rb, 3.6, METAL_D);
  shape(ctx, circ(3 + thrust * 0.6, -38 + rb, 2.1), LEATHER, 1);
}
function crestMark(ctx, team, x, y, r) {
  shape(ctx, circ(x, y, r), radGrad(ctx, x - r / 3, y - r / 3, 0.2, r, ['#fff3c0', GOLD, GOLD_D]), 1);
  ctx.save(); ctx.translate(x, y); ctx.scale(r / 10, r / 10);
  if (team === 'red') shape(ctx, flamePath, TEAMS.red.dark, 0);
  else shape(ctx, moonPath, TEAMS.blue.dark, 0);
  ctx.restore();
}
function flamePath(c) { c.moveTo(0, 7); c.bezierCurveTo(-7, 6, -6, -2, -2, -7); c.bezierCurveTo(-2, -3, 1, -2, 1, -5); c.bezierCurveTo(4, -2, 7, 5, 0, 7); c.closePath(); }
function moonPath(c) { c.arc(0, 0, 6.5, Math.PI * 0.3, Math.PI * 1.7); c.bezierCurveTo(-3, -4, -3, 4, 3.8, 5.3); c.closePath(); }

// ---------- 石巨人 ----------
function rock(ctx, cx, cy, rx, ry, seed, light, dark, rot = 0) {
  const r = seeded(seed), n = 8, pts = [];
  for (let i = 0; i < n; i++) {
    const a = rot + i / n * TAU + r() * 0.3, k = 0.82 + r() * 0.24;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  shape(ctx, poly(pts), linGrad(ctx, cx - rx, cy - ry, cx + rx * 0.6, cy + ry, [light, dark]), 1.8);
  shape(ctx, c => { c.moveTo(pts[4][0], pts[4][1]); for (const i of [5, 6]) c.lineTo(pts[i][0], pts[i][1]); }, null, 1.3, rgba('#ffffff', 0.35));
  return pts;
}
function drawGolem(ctx, tm, anim, t) {
  const L = '#b5b9c4', D = '#555a69';
  const p = (anim === 'walk' ? t : 0) * TAU;
  const bob = anim === 'walk' ? -Math.abs(Math.sin(p)) * 2.2 : 0;
  let armA = 0.2, lean = 0;
  if (anim === 'attack') {
    if (t < 0.5) { const k = t / 0.5; armA = 0.2 + k * 2.7; lean = -k * 4; }
    else if (t < 0.65) { const k = (t - 0.5) / 0.15; armA = 2.9 - k * 2.0; lean = -4 + k * 10; }
    else { const k = (t - 0.65) / 0.35; armA = 0.9 - k * 0.7; lean = 6 - k * 6; }
  }
  const lift = s => anim === 'walk' ? Math.max(0, Math.sin(p + s)) * 5 : 0;
  ctx.save(); ctx.translate(lean * 0.4, bob);
  const armAt = (sx, sy, a, side) => {
    const [ex, ey] = at(sx, sy, a, 17), [fx, fy] = at(ex, ey, a - 0.15 * side, 15);
    return [ex, ey, fx, fy];
  };
  // 后手臂
  const [bex, bey, bfx, bfy] = armAt(-14, -60, armA - 0.15, -1);
  rock(ctx, bex, bey, 9, 10, 11, shade(L, -0.2), shade(D, -0.25));
  rock(ctx, bfx, bfy, 11, 10, 12, shade(L, -0.2), shade(D, -0.25));
  rock(ctx, -11, -11 - lift(Math.PI), 10, 12, 3, shade(L, -0.15), shade(D, -0.2));
  rock(ctx, 0, -27, 19, 10, 4, L, D);
  rock(ctx, 11, -11 - lift(0), 10, 12, 5, L, D);
  ctx.save(); ctx.translate(lean, 0);
  const torsoPts = rock(ctx, 0, -51, 27, 22, 6, L, D);
  // 苔藓
  shape(ctx, c => { c.moveTo(torsoPts[5][0], torsoPts[5][1] + 2); c.quadraticCurveTo(-4, -78, torsoPts[7][0] - 4, torsoPts[7][1] + 3); c.quadraticCurveTo(-2, -66, torsoPts[5][0], torsoPts[5][1] + 2); }, vgrad(ctx, -78, -62, '#9fd36a', '#4f8b35'), 1.2);
  // 符文
  glow(ctx, tm.main, 10, () => {
    shape(ctx, c => { c.moveTo(-10, -58); c.lineTo(-3, -50); c.lineTo(-9, -42); c.moveTo(4, -60); c.lineTo(10, -52); c.lineTo(3, -44); c.lineTo(9, -36); c.moveTo(-14, -48); c.lineTo(-19, -40); }, null, 2.4, tm.light);
    shape(ctx, circ(0, -51, 5), null, 2, tm.light);
  });
  rock(ctx, 16, -76, 11, 9, 7, L, D);
  glow(ctx, tm.main, 12, () => { shape(ctx, ell(19, -77, 2, 1.4), '#ffffff', 0); shape(ctx, ell(24.5, -76.6, 1.6, 1.2), '#ffffff', 0); });
  ctx.fillStyle = rgba(tm.light, 0.9); ctx.fillRect(16.5, -78.4, 5, 0.01);
  ctx.restore();
  // 前手臂
  rock(ctx, 18, -64, 13, 11, 8, L, D);
  const [fex, fey, ffx, ffy] = armAt(20, -60, armA, 1);
  rock(ctx, fex + lean * 0.6, fey, 9.5, 11, 9, L, D);
  rock(ctx, ffx + lean * 0.6, ffy, 12, 11, 10, L, D);
  glow(ctx, tm.main, 8, () => shape(ctx, c => { c.moveTo(ffx - 4 + lean * 0.6, ffy - 2); c.lineTo(ffx + 4 + lean * 0.6, ffy + 1); }, null, 2, tm.light));
  ctx.restore();
}

// ---------- 巨龙 ----------
function drawDragon(ctx, tm, anim, t, team) {
  const pal = team === 'red'
    ? { s0: '#ff7a55', s1: '#c8242f', s2: '#5e0b1a', belly: '#ffd58a', wing: '#8e1a30', wing2: '#5a0d22', horn: '#fff1cf', eye: '#ffe14d' }
    : { s0: '#79c4ff', s1: '#2b62d6', s2: '#0d1d5c', belly: '#c9f0ff', wing: '#1f3d9c', wing2: '#122463', horn: '#f3f7ff', eye: '#7dffea' };
  const p = (anim === 'walk' ? t : 0.25) * TAU, flap = Math.sin(p), bob = -flap * 3;
  let neck = 0, jaw = 0.12;
  if (anim === 'attack') { neck = t < 0.3 ? -t / 0.3 * 6 : Math.min(1, (t - 0.3) / 0.15) * 4; jaw = t < 0.3 ? 0.1 : 0.55; }
  ctx.save(); ctx.translate(0, bob);
  const wing = (dx, dy, ph, fill, back) => {
    const f = Math.sin(p + ph);
    const sx = 4 + dx, sy = -32 + dy, ex = -6 + dx, ey = -64 - f * 22 + dy, tx = -52 + dx, ty = -70 - f * 32 + dy;
    const f2 = [-54 + dx, -44 - f * 16 + dy], f3 = [-36 + dx, -28 - f * 4 + dy];
    shape(ctx, c => { c.moveTo(sx, sy); c.lineTo(ex, ey); c.lineTo(tx, ty); c.quadraticCurveTo(-44 + dx, ty + 14, f2[0], f2[1]); c.quadraticCurveTo(-40 + dx, f2[1] + 6, f3[0], f3[1]); c.quadraticCurveTo(-18 + dx, -24 + dy, sx, sy); c.closePath(); },
      linGrad(ctx, sx, sy, tx, ty, [fill, back ? pal.wing2 : shade(fill, 0.25)]), 1.6);
    for (const [px, py] of [[tx, ty], f2, f3]) shape(ctx, c => { c.moveTo(ex, ey); c.lineTo(px, py); }, null, 1.2, rgba('#000000', 0.35));
    limb(ctx, sx, sy, ex, ey, 3.4, back ? pal.s2 : pal.s1); limb(ctx, ex, ey, tx, ty, 2.2, back ? pal.s2 : pal.s1);
    shape(ctx, poly([[ex - 1, ey - 1], [ex + 1, ey - 6], [ex + 2.6, ey]]), pal.horn, 0.9);
  };
  wing(10, -2, 0.45, pal.wing2, true);
  // 尾巴
  const tailPts = [];
  for (let i = 0; i <= 12; i++) {
    const k = i / 12, x = -22 - k * 58, y = -16 + Math.sin(k * 3 + p) * 5 * k - k * k * 8, w = 8 * (1 - k) + 1;
    tailPts.push([x, y, w]);
  }
  shape(ctx, c => { tailPts.forEach(([x, y, w], i) => i ? c.lineTo(x, y - w) : c.moveTo(x, y - w)); for (let i = tailPts.length - 1; i >= 0; i--) c.lineTo(tailPts[i][0], tailPts[i][1] + tailPts[i][2]); c.closePath(); },
    vgrad(ctx, -30, -6, pal.s0, pal.s1, pal.s2), 1.6);
  const [ex, ey] = tailPts[12];
  shape(ctx, poly([[ex + 2, ey], [ex - 6, ey - 8], [ex - 12, ey + 1], [ex - 5, ey + 6]]), pal.s1, 1.4);
  for (let i = 2; i < 11; i += 2) { const [x, y, w] = tailPts[i]; shape(ctx, poly([[x + 3, y - w + 0.5], [x, y - w - 4.5], [x - 3, y - w + 0.5]]), pal.horn, 0.9); }
  // 后腿
  limb(ctx, -14, -12, -18, -2, 5, pal.s2); shape(ctx, ell(-17, -1, 3.5, 2), pal.horn, 1);
  // 身体
  shape(ctx, ell(0, -19, 30, 15, -0.08), vgrad(ctx, -34, -4, pal.s0, pal.s1, pal.s2), 1.8);
  shape(ctx, c => { c.ellipse(2, -11, 24, 7, -0.06, 0.1, Math.PI - 0.1); c.closePath(); }, vgrad(ctx, -14, -4, pal.belly, shade(pal.belly, -0.25)), 1.2);
  for (let i = -16; i <= 18; i += 6) shape(ctx, c => { c.moveTo(i, -9); c.quadraticCurveTo(i + 2.5, -5, i + 5, -9); }, null, 0.9, rgba('#000000', 0.25));
  for (let i = -18; i <= 16; i += 6) shape(ctx, poly([[i - 2.6, -32 + Math.abs(i) * 0.08], [i, -38 + Math.abs(i) * 0.08], [i + 2.6, -32 + Math.abs(i) * 0.08]]), pal.horn, 0.9);
  // 脖子 + 头
  const hx = 50 + neck, hy = -50 + neck * 0.2;
  shape(ctx, c => { c.moveTo(16, -30); c.quadraticCurveTo(30, -34, hx - 6, hy - 6); c.lineTo(hx - 2, hy + 7); c.quadraticCurveTo(34, -22, 22, -10); c.closePath(); }, vgrad(ctx, hy - 6, -10, pal.s0, pal.s1), 1.6);
  shape(ctx, c => { c.moveTo(24, -11); c.quadraticCurveTo(33, -20, hx - 3, hy + 6); }, null, 3.4, pal.belly);
  // 下颚
  ctx.save(); ctx.translate(hx + 2, hy + 3); ctx.rotate(jaw);
  shape(ctx, c => { c.moveTo(-4, -1); c.lineTo(16, 1); c.quadraticCurveTo(14, 5, 4, 5.5); c.quadraticCurveTo(-3, 4.5, -4, -1); }, vgrad(ctx, -1, 6, pal.s1, pal.s2), 1.4);
  if (jaw > 0.3) for (let i = 2; i < 14; i += 3.5) shape(ctx, poly([[i, 1], [i + 1, -1.6], [i + 2, 1]]), '#ffffff', 0.6);
  ctx.restore();
  if (jaw > 0.3) shape(ctx, ell(hx + 9, hy + 3.5, 6, 2.6, 0.25), radGrad(ctx, hx + 9, hy + 3.5, 0.5, 6, ['#fff6b0', '#ff9a2a', 'rgba(255,60,0,0.4)']), 0);
  shape(ctx, c => { c.moveTo(hx - 10, hy - 2); c.quadraticCurveTo(hx - 6, hy - 11, hx + 4, hy - 9); c.quadraticCurveTo(hx + 14, hy - 6, hx + 19, hy - 1); c.quadraticCurveTo(hx + 18, hy + 3.6, hx + 10, hy + 3.4); c.lineTo(hx - 4, hy + 5); c.quadraticCurveTo(hx - 10, hy + 4, hx - 10, hy - 2); }, vgrad(ctx, hy - 11, hy + 5, pal.s0, pal.s1, pal.s2), 1.6);
  shape(ctx, c => { c.moveTo(hx - 4, hy - 8); c.quadraticCurveTo(hx - 16, hy - 16, hx - 24, hy - 10); c.quadraticCurveTo(hx - 14, hy - 12, hx - 7, hy - 4); c.closePath(); }, vgrad(ctx, hy - 16, hy - 4, '#ffffff', pal.horn), 1.2);
  shape(ctx, c => { c.moveTo(hx - 1, hy - 9); c.quadraticCurveTo(hx - 8, hy - 20, hx - 16, hy - 19); c.quadraticCurveTo(hx - 8, hy - 15, hx - 4, hy - 7); c.closePath(); }, pal.horn, 1.1);
  glow(ctx, pal.eye, 10, () => shape(ctx, ell(hx + 3, hy - 4.6, 2.6, 1.6, 0.15), pal.eye, 0.9));
  shape(ctx, ell(hx + 3.4, hy - 4.6, 0.6, 1.4), '#1a0b10', 0);
  shape(ctx, circ(hx + 16, hy - 3, 0.9), '#1a0b10', 0);
  // 前腿
  limb(ctx, 16, -10, 20, 0, 5, pal.s1); shape(ctx, ell(21, 0.6, 3.6, 2), pal.horn, 1);
  wing(0, 0, 0, pal.wing, false);
  ctx.restore();
}

const DRAW = { sword: drawSword, archer: drawArcher, mage: drawMage, knight: drawKnight, golem: drawGolem, dragon: drawDragon };
const BOUNDS = { // 设计坐标下的包围盒 [x0, y0, x1, y1]
  sword: [-18, -46, 22, 4], archer: [-20, -46, 22, 4], mage: [-14, -60, 24, 4],
  knight: [-30, -72, 50, 4], golem: [-48, -100, 56, 8], dragon: [-102, -120, 82, 16],
};
export const FRAMES = { walk: 8, attack: 6 };
// 发射点（相对脚底，面朝右，设计坐标）
export const MUZZLE = { archer: [12, -17], mage: [14, -42], dragon: [62, -46] };

const cache = new Map();
export function frame(type, team, anim, i) {
  const key = `${type}|${team}|${anim}|${i}`;
  let f = cache.get(key);
  if (f) return f;
  const [x0, y0, x1, y1] = BOUNDS[type], pad = 4;
  const w = (x1 - x0 + pad * 2) * S, h = (y1 - y0 + pad * 2) * S;
  const c = canvas(w, h), ctx = c.getContext('2d');
  const flip = TEAMS[team].dir < 0;
  ctx.translate(flip ? w : 0, 0); ctx.scale(flip ? -S : S, S);
  ctx.translate(-x0 + pad, -y0 + pad);
  DRAW[type](ctx, TEAMS[team], anim, i / FRAMES[anim], team);
  f = { c, ax: flip ? w - (-x0 + pad) * S : (-x0 + pad) * S, ay: (-y0 + pad) * S, w, h };
  cache.set(key, f);
  return f;
}
export function flashOf(f) { // 受击白闪版本
  if (f.flash) return f.flash;
  const c = canvas(f.w, f.h), ctx = c.getContext('2d');
  ctx.drawImage(f.c, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(0, 0, f.w, f.h);
  f.flash = c;
  return c;
}
export function preloadUnits() {
  for (const type of Object.keys(UNITS)) for (const team of ['red', 'blue'])
    for (const anim of Object.keys(FRAMES)) for (let i = 0; i < FRAMES[anim]; i++) frame(type, team, anim, i);
}

// ---------- 城堡 ----------
function bricks(ctx, x, y, w, h, seed, base) {
  const r = seeded(seed);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = vgrad(ctx, y, y + h, shade(base, 0.12), shade(base, -0.3)); ctx.fillRect(x, y, w, h);
  const bh = 7, bw = 14;
  for (let row = 0; row * bh < h; row++) {
    const off = (row % 2) * bw / 2;
    for (let bx = x - off; bx < x + w; bx += bw) {
      const v = (r() - 0.5) * 0.18;
      ctx.fillStyle = v > 0 ? rgba('#ffffff', v * 0.6) : rgba('#000000', -v);
      ctx.fillRect(bx + 0.6, y + row * bh + 0.6, bw - 1.2, bh - 1.2);
      ctx.fillStyle = rgba('#ffffff', 0.08); ctx.fillRect(bx + 0.6, y + row * bh + 0.6, bw - 1.2, 1);
    }
    ctx.fillStyle = rgba('#1a1226', 0.35); ctx.fillRect(x, y + row * bh, w, 0.8);
  }
  ctx.restore();
  shape(ctx, c => c.rect(x, y, w, h), null, 1.8);
}
function battlements(ctx, x, y, w, base, n) {
  const mw = w / (n * 2 - 1);
  for (let i = 0; i < n; i++) bricks(ctx, x + i * mw * 2, y - 9, mw, 10, 90 + i, base);
}
function roof(ctx, cx, y, w, h, tm) {
  shape(ctx, c => { c.moveTo(cx - w / 2 - 5, y); c.quadraticCurveTo(cx - w / 4, y - h * 0.45, cx, y - h); c.quadraticCurveTo(cx + w / 4, y - h * 0.45, cx + w / 2 + 5, y); c.closePath(); },
    linGrad(ctx, cx - w / 2, 0, cx + w / 2, 0, [tm.dark, tm.main, tm.light, tm.main, tm.deep].map((c, i) => [i / 4, c])), 1.8);
  for (let i = 1; i < 4; i++) shape(ctx, c => { c.moveTo(cx - w / 2 - 5 + i * 3, y - i * h * 0.16); c.quadraticCurveTo(cx, y - i * h * 0.16 - 3, cx + w / 2 + 5 - i * 3, y - i * h * 0.16); }, null, 1, rgba('#000000', 0.25));
  shape(ctx, c => c.rect(cx - w / 2 - 5, y - 2, w + 10, 4), GOLD, 1.2);
}
function windowGlow(ctx, x, y, w, h) {
  glow(ctx, '#ffb347', 10, () => shape(ctx, c => { c.moveTo(x, y + h); c.lineTo(x, y + w / 2); c.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); c.lineTo(x + w, y + h); c.closePath(); }, vgrad(ctx, y, y + h, '#fff1a8', '#ff9d2e'), 1.4));
  shape(ctx, c => { c.moveTo(x + w / 2, y); c.lineTo(x + w / 2, y + h); }, null, 1, '#5a2a10');
}
export const CASTLE_BOUNDS = [-120, -330, 130, 16];
export const CASTLE_FLAGS = [[-6, -300], [-75, -228], [80, -208]]; // 旗杆顶端（面朝右）
export function drawCastle(team, damage = 0) {
  const tm = TEAMS[team], [x0, y0, x1, y1] = CASTLE_BOUNDS, w = (x1 - x0) * S, h = (y1 - y0) * S;
  const c = canvas(w, h), ctx = c.getContext('2d'), flip = tm.dir < 0;
  ctx.translate(flip ? w : 0, 0); ctx.scale(flip ? -S : S, S); ctx.translate(-x0, -y0);
  const stone = team === 'red' ? '#9b8f8a' : '#8c93a6';
  // 后塔
  for (const [cx, top, tw] of [[-6, -232, 64], [-75, -190, 42]]) {
    bricks(ctx, cx - tw / 2, top, tw, -top, 7 + cx, shade(stone, -0.12));
    roof(ctx, cx, top, tw, cx === -6 ? 62 : 38, tm);
  }
  windowGlow(ctx, -14, -205, 14, 22); windowGlow(ctx, -82, -160, 12, 18);
  // 城墙
  bricks(ctx, -95, -118, 180, 118, 21, stone);
  battlements(ctx, -95, -118, 180, stone, 9);
  // 城墙上的横幅
  for (const bx of [-62, -20]) {
    shape(ctx, c => { c.moveTo(bx - 11, -108); c.lineTo(bx + 11, -108); c.lineTo(bx + 11, -62); c.lineTo(bx, -54); c.lineTo(bx - 11, -62); c.closePath(); }, linGrad(ctx, bx - 11, 0, bx + 11, 0, [tm.dark, tm.main, tm.dark]), 1.4);
    shape(ctx, c => c.rect(bx - 13, -110, 26, 3), GOLD, 1);
    crestMark(ctx, team, bx, -84, 7.5);
  }
  // 城门
  const gx = 38;
  shape(ctx, c => { c.moveTo(gx - 20, 0); c.lineTo(gx - 20, -44); c.arc(gx, -44, 20, Math.PI, 0); c.lineTo(gx + 20, 0); c.closePath(); }, vgrad(ctx, -64, 0, '#2a1a1a', '#120a0e'), 2);
  ctx.save(); ctx.beginPath(); ctx.moveTo(gx - 17, 0); ctx.lineTo(gx - 17, -44); ctx.arc(gx, -44, 17, Math.PI, 0); ctx.lineTo(gx + 17, 0); ctx.clip();
  ctx.fillStyle = vgrad(ctx, -62, 0, WOOD, WOOD_D); ctx.fillRect(gx - 17, -62, 34, 62);
  for (let i = -12; i <= 12; i += 6) { ctx.fillStyle = rgba('#000000', 0.3); ctx.fillRect(gx + i, -62, 1.2, 62); }
  for (const yy of [-40, -16]) { ctx.fillStyle = '#3a3a44'; ctx.fillRect(gx - 17, yy, 34, 3.2); ctx.fillStyle = '#9aa0ae'; for (let i = -14; i <= 14; i += 7) ctx.fillRect(gx + i, yy + 0.8, 1.6, 1.6); }
  ctx.restore();
  for (let i = 0; i < 9; i++) { const a = Math.PI + (i + 0.5) / 9 * Math.PI; bricks(ctx, gx + Math.cos(a) * 24 - 3, -44 + Math.sin(a) * 24 - 3, 6, 6, 50 + i, shade(stone, 0.1)); }
  // 前塔（城门一侧）
  bricks(ctx, 60, -172, 46, 172, 33, shade(stone, 0.05));
  battlements(ctx, 56, -172, 54, shade(stone, 0.05), 3);
  roof(ctx, 83, -181, 54, 30, tm);
  windowGlow(ctx, 76, -140, 12, 20); windowGlow(ctx, 76, -86, 12, 18);
  // 面向战场一侧的暖色边缘光
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = linGrad(ctx, 40, 0, 110, 0, ['rgba(255,170,90,0)', 'rgba(255,170,90,0.28)']); ctx.fillRect(40, -330, 70, 330);
  ctx.fillStyle = vgrad(ctx, -120, 10, 'rgba(20,10,40,0)', 'rgba(20,10,40,0.35)'); ctx.fillRect(-120, -120, 250, 130);
  ctx.globalCompositeOperation = 'source-over';
  // 地基碎石
  for (let i = 0; i < 12; i++) rock(ctx, -108 + i * 20, 2, 9, 5, 70 + i, '#8d8798', '#3f3a4c');
  // 损坏裂缝
  if (damage > 0) {
    const r = seeded(500 + damage);
    ctx.strokeStyle = 'rgba(25,12,20,0.85)'; ctx.lineCap = 'round';
    for (let k = 0; k < damage * 5; k++) {
      let x = -90 + r() * 190, y = -150 + r() * 140; ctx.lineWidth = 1.6 + r();
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let s = 0; s < 6; s++) { x += (r() - 0.5) * 14; y += 4 + r() * 7; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = `rgba(30,15,25,${0.12 * damage})`; ctx.fillRect(-120, -330, 260, 350);
    ctx.globalCompositeOperation = 'source-over';
    for (let k = 0; k < damage * 3; k++) rock(ctx, -100 + r() * 200, 4 - r() * 4, 5 + r() * 4, 3 + r() * 2, 300 + k, '#7d7684', '#3a3446');
  }
  return { c, ax: flip ? w + x0 * S : -x0 * S, ay: -y0 * S, w, h };
}

// ---------- 图标 ----------
export function crestIcon(team, size) {
  const c = canvas(size * S, size * S), ctx = c.getContext('2d'), tm = TEAMS[team];
  ctx.scale(S * size / 40, S * size / 40); ctx.translate(20, 20);
  const shield = c2 => { c2.moveTo(-15, -16); c2.lineTo(15, -16); c2.lineTo(15, 0); c2.quadraticCurveTo(14, 12, 0, 18); c2.quadraticCurveTo(-14, 12, -15, 0); c2.closePath(); };
  glow(ctx, tm.main, 6, () => shape(ctx, shield, linGrad(ctx, -15, -16, 15, 18, [tm.light, tm.main, tm.dark]), 2.4, GOLD));
  shape(ctx, shield, null, 1, OUT);
  ctx.save(); ctx.scale(1.25, 1.25);
  shape(ctx, team === 'red' ? flamePath : moonPath, vgrad(ctx, -8, 8, '#fff7cf', GOLD), 1, GOLD_D);
  if (team === 'blue') star(ctx, 3.5, -3, 2.4, '#fff7cf');
  ctx.restore();
  return c;
}
export function giftIcon(name, size) {
  const c = canvas(size * S, size * S), ctx = c.getContext('2d');
  ctx.scale(S * size / 40, S * size / 40); ctx.translate(20, 20);
  if (name === '小心心') {
    const heart = c2 => { c2.moveTo(0, 13); c2.bezierCurveTo(-20, 0, -12, -18, 0, -7); c2.bezierCurveTo(12, -18, 20, 0, 0, 13); c2.closePath(); };
    glow(ctx, '#ff4f9a', 8, () => shape(ctx, heart, radGrad(ctx, -5, -6, 1, 18, ['#ffd1e6', '#ff5aa5', '#c8126a']), 1.6));
    shape(ctx, ell(-6, -5, 3, 2, -0.6), 'rgba(255,255,255,0.75)', 0);
  } else if (name === '玫瑰') {
    limb(ctx, 0, 2, -3, 18, 2, '#3f9b45');
    shape(ctx, ell(-6, 11, 4.5, 2, -0.6), '#58c25e', 1);
    shape(ctx, circ(0, -4, 10), radGrad(ctx, -3, -7, 1, 11, ['#ff8aa0', '#e8173c', '#8a0a22']), 1.6);
    for (const [r0, a0] of [[7, 0.2], [4.5, 2.2], [2.2, 4]]) shape(ctx, c2 => c2.arc(0, -4, r0, a0, a0 + 4.2), null, 1.2, '#7a0619');
  } else if (name === '甜甜圈') {
    shape(ctx, c2 => { c2.ellipse(0, 2, 16, 12, 0, 0, TAU); c2.ellipse(0, 1, 5, 3.4, 0, 0, TAU); }, vgrad(ctx, -10, 14, '#f0b26a', '#b8702c'), 1.6);
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, 2, 16, 12, 0, 0, TAU); ctx.ellipse(0, 1, 5, 3.4, 0, 0, TAU); ctx.clip('evenodd');
    shape(ctx, c2 => { c2.moveTo(-15, 0); for (let i = 0; i <= 10; i++) c2.lineTo(-15 + i * 3, i % 2 ? 6 : 3); c2.lineTo(15, -12); c2.lineTo(-15, -12); c2.closePath(); }, vgrad(ctx, -10, 6, '#ffc6e2', '#ff6fb2'), 1.2);
    const r = seeded(9), cols = ['#fff', '#7df', '#ff5', '#7f7'];
    for (let i = 0; i < 14; i++) { ctx.fillStyle = cols[i % 4]; ctx.save(); ctx.translate(-12 + r() * 24, -8 + r() * 10); ctx.rotate(r() * 3); ctx.fillRect(-1.6, -0.5, 3.2, 1); ctx.restore(); }
    ctx.restore();
  } else if (name === '火箭') {
    ctx.rotate(0.7);
    glow(ctx, '#ff9a2a', 10, () => shape(ctx, c2 => { c2.moveTo(-4, 11); c2.quadraticCurveTo(0, 26, 4, 11); c2.closePath(); }, vgrad(ctx, 10, 24, '#fff6a8', '#ff6a00'), 0));
    shape(ctx, poly([[-6, 4], [-12, 14], [-5, 11]]), '#ff4e4e', 1.2); shape(ctx, poly([[6, 4], [12, 14], [5, 11]]), '#ff4e4e', 1.2);
    shape(ctx, c2 => { c2.moveTo(0, -19); c2.quadraticCurveTo(10, -8, 6, 12); c2.lineTo(-6, 12); c2.quadraticCurveTo(-10, -8, 0, -19); }, linGrad(ctx, -8, 0, 8, 0, ['#b9c3d6', '#ffffff', '#8d97ad']), 1.6);
    shape(ctx, c2 => { c2.moveTo(0, -19); c2.quadraticCurveTo(5, -14, 6.4, -9); c2.lineTo(-6.4, -9); c2.quadraticCurveTo(-5, -14, 0, -19); }, '#ff4e4e', 1.2);
    shape(ctx, circ(0, -2, 3.4), radGrad(ctx, -1, -3, 0.3, 4, ['#d9f6ff', '#3aa0ff']), 1.2);
  }
  return c;
}

// ---------- 通用光效贴图 ----------
const glowCache = new Map();
export function glowSprite(color, size = 64) {
  const key = color + size;
  let c = glowCache.get(key);
  if (!c) {
    c = canvas(size, size); const ctx = c.getContext('2d');
    ctx.fillStyle = radGrad(ctx, size / 2, size / 2, 0, size / 2, [[0, rgba(color, 1)], [0.25, rgba(color, 0.55)], [0.6, rgba(color, 0.15)], [1, rgba(color, 0)]]);
    ctx.fillRect(0, 0, size, size);
    glowCache.set(key, c);
  }
  return c;
}
export function softSprite(color, size = 64) { // 烟雾用的柔和圆
  const key = 'soft' + color + size;
  let c = glowCache.get(key);
  if (!c) {
    c = canvas(size, size); const ctx = c.getContext('2d');
    ctx.fillStyle = radGrad(ctx, size / 2, size / 2, 0, size / 2, [[0, rgba(color, 0.9)], [0.5, rgba(color, 0.5)], [1, rgba(color, 0)]]);
    ctx.fillRect(0, 0, size, size);
    glowCache.set(key, c);
  }
  return c;
}
