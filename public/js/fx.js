// 特效：粒子、飘字、冲击波、闪光、屏幕震动
import { TAU, rand, pick, clamp, text, rgba } from './util.js';
import { glowSprite, softSprite } from './art.js';

let MAX = 1400;
export function setFxBudget(n) { MAX = n; }
export const fx = { list: [], shake: 0, flash: 0, flashColor: '#fff', slow: 0 };

function add(p) {
  if (fx.list.length >= MAX) fx.list.splice(0, fx.list.length - MAX + 1);
  p.age = 0; fx.list.push(p); return p;
}
export function resetFx() { fx.list.length = 0; fx.shake = 0; fx.flash = 0; }
export function shake(v) { fx.shake = Math.min(1.2, Math.max(fx.shake, v)); }
export function flash(v, color = '#fff') { fx.flash = Math.max(fx.flash, v); fx.flashColor = color; }

// 发光火花（叠加混合）
export function sparks(x, y, color, n = 8, speed = 160, life = 0.5, size = 14) {
  for (let i = 0; i < n; i++) {
    const a = rand(TAU), s = rand(0.3, 1) * speed;
    add({ k: 'glow', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * 0.3, g: 260, drag: 2.5, life: rand(0.6, 1) * life, size: rand(0.6, 1.2) * size, color });
  }
}
// 碎片（有重力，落地）
export function debris(x, y, colors, n = 8, speed = 180, size = 3.5, ground = y + 10) {
  for (let i = 0; i < n; i++) {
    const a = rand(Math.PI * 1.1, Math.PI * 1.9), s = rand(0.4, 1) * speed;
    add({ k: 'bit', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 600, drag: 0.6, life: rand(0.7, 1.3), size: rand(0.6, 1.3) * size, color: pick(colors), rot: rand(TAU), vr: rand(-12, 12), ground: ground + rand(-6, 6) });
  }
}
export function smoke(x, y, n = 4, color = '#8a7f8e', size = 40, life = 1.1, rise = 30) {
  for (let i = 0; i < n; i++)
    add({ k: 'smoke', x: x + rand(-10, 10), y: y + rand(-6, 6), vx: rand(-20, 20), vy: -rand(0.4, 1) * rise, g: 0, drag: 1, life: rand(0.7, 1) * life, size: rand(0.6, 1.1) * size, color });
}
export function dust(x, y, n = 3, scale = 1) { smoke(x, y, n, '#c9ab7e', 22 * scale, 0.6, 18); }
export function ring(x, y, color, r0 = 6, r1 = 80, life = 0.45, width = 6, squash = 0.42) {
  add({ k: 'ring', x, y, r0, r1, life, width, color, squash });
}
export function light(x, y, color, size = 160, life = 0.35) { add({ k: 'light', x, y, size, life, color }); }
export function slash(x, y, dir, color, size = 26) { add({ k: 'slash', x, y, dir, size, life: 0.18, color }); }
export function floatText(x, y, s, o = {}) {
  add({ k: 'text', x: x + rand(-6, 6), y, vy: o.vy ?? -70, life: o.life ?? 0.9, s: String(s), color: o.color || '#fff', size: o.size || 18, stroke: o.stroke || 'rgba(40,10,30,0.9)', pop: o.pop ?? 1 });
}
export function trail(x, y, color, size = 12, life = 0.25) { add({ k: 'glow', x, y, vx: 0, vy: 0, g: 0, drag: 0, life, size, color }); }
export function ember(x, y, color) { add({ k: 'glow', x, y, vx: rand(-30, 30), vy: rand(-80, -20), g: -20, drag: 1, life: rand(0.3, 0.7), size: rand(6, 14), color }); }
export function bolt(x0, y0, x1, y1, color) { // 闪电
  const pts = [[x0, y0]], n = 9;
  for (let i = 1; i < n; i++) { const k = i / n; pts.push([x0 + (x1 - x0) * k + rand(-16, 16), y0 + (y1 - y0) * k + rand(-6, 6)]); }
  pts.push([x1, y1]);
  add({ k: 'bolt', pts, life: 0.28, color });
}

export function updateFx(dt) {
  const L = fx.list;
  let w = 0;
  for (let i = 0; i < L.length; i++) {
    const p = L[i];
    p.age += dt;
    if (p.age >= p.life) continue;
    if (p.vx !== undefined) {
      const d = Math.max(0, 1 - (p.drag || 0) * dt);
      p.vx *= d; p.vy = p.vy * d + (p.g || 0) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.k === 'bit') {
        p.rot += p.vr * dt;
        if (p.y > p.ground) { p.y = p.ground; p.vy *= -0.35; p.vx *= 0.6; p.vr *= 0.5; }
      }
    }
    L[w++] = p;
  }
  L.length = w;
  fx.shake = Math.max(0, fx.shake - dt * 1.6);
  fx.flash = Math.max(0, fx.flash - dt * 2.5);
}

// layer: 'ground'（单位之下）或 'top'（单位之上）
export function drawFx(ctx, layer) {
  for (const p of fx.list) {
    const k = p.age / p.life;
    if (layer === 'ground') {
      if (p.k === 'ring') {
        const r = p.r0 + (p.r1 - p.r0) * (1 - (1 - k) ** 3);
        ctx.globalAlpha = 1 - k; ctx.strokeStyle = p.color; ctx.lineWidth = p.width * (1 - k) + 1;
        ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * p.squash, 0, 0, TAU); ctx.stroke();
      } else if (p.k === 'bit') {
        ctx.globalAlpha = clamp((1 - k) * 3, 0, 1); ctx.fillStyle = p.color;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7); ctx.restore();
      }
      continue;
    }
    if (p.k === 'smoke') {
      ctx.globalAlpha = 0.5 * (1 - k); const s = p.size * (0.6 + k * 0.9);
      ctx.drawImage(softSprite(p.color, 64), p.x - s / 2, p.y - s / 2, s, s);
    }
  }
  if (layer === 'ground') { ctx.globalAlpha = 1; return; }
  ctx.globalCompositeOperation = 'lighter';
  for (const p of fx.list) {
    const k = p.age / p.life;
    if (p.k === 'glow') {
      ctx.globalAlpha = (1 - k) * 0.75; const s = p.size * (1 - k * 0.5);
      ctx.drawImage(glowSprite(p.color, 64), p.x - s, p.y - s, s * 2, s * 2);
    } else if (p.k === 'light') {
      ctx.globalAlpha = (1 - k) * 0.6; const s = p.size * (0.6 + k * 0.5);
      ctx.drawImage(glowSprite(p.color, 128), p.x - s, p.y - s * 0.7, s * 2, s * 1.4);
    } else if (p.k === 'slash') {
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = p.color; ctx.lineWidth = 4 * (1 - k) + 1; ctx.lineCap = 'round';
      const a0 = p.dir > 0 ? -1.3 : Math.PI + 1.3, a1 = p.dir > 0 ? 0.9 : Math.PI - 0.9;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.8 + k * 0.4), Math.min(a0, a1), Math.max(a0, a1)); ctx.stroke();
    } else if (p.k === 'bolt') {
      ctx.globalAlpha = 1 - k; ctx.lineJoin = 'round';
      for (const [wd, col] of [[9, rgba(p.color, 0.35)], [4, p.color], [1.6, '#ffffff']]) {
        ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.beginPath();
        p.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
      }
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  for (const p of fx.list) {
    if (p.k !== 'text') continue;
    const k = p.age / p.life;
    const pop = k < 0.15 ? 1 + (1 - k / 0.15) * 0.6 * p.pop : 1;
    ctx.globalAlpha = clamp((1 - k) * 2.5, 0, 1);
    text(ctx, p.s, p.x, p.y + p.vy * p.age, { size: p.size * pop, align: 'center', color: p.color, stroke: p.stroke, sw: p.size / 4.5, shadow: false });
  }
  ctx.globalAlpha = 1;
}
