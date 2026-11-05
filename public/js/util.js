// 通用工具：离屏画布、数学、颜色、文字
import { FONT } from './config.js';

let factory = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
export function setCanvasFactory(f) { factory = f; }           // Node 截图工具里替换成 @napi-rs/canvas
export function canvas(w, h) { return factory(Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h))); }

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
export const pick = arr => arr[(Math.random() * arr.length) | 0];
export const easeOut = t => 1 - (1 - t) ** 3;
export const easeIn = t => t * t * t;
export const easeOutBack = t => { const c = 1.7; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };
export function seeded(seed) {
  let s = seed % 2147483647; if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647, (s - 1) / 2147483646);
}

// ---------- 颜色 ----------
function hexToRgb(hex) {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(hex);
  if (m) return [+m[1], +m[2], +m[3]];
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgba(hex, a) { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; }
export function shade(hex, amt) { // amt: -1..1，负数变暗，正数变亮
  const [r, g, b] = hexToRgb(hex);
  const f = c => Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt);
  return '#' + [f(r), f(g), f(b)].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}
export function nickColor(nick) {
  let h = 0; for (const ch of nick) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return `hsl(${h % 360},65%,55%)`;
}

// ---------- 路径 ----------
export function rrect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
export function linGrad(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach((c, i) => Array.isArray(c) ? g.addColorStop(c[0], c[1]) : g.addColorStop(i / (stops.length - 1), c));
  return g;
}
export function radGrad(ctx, x, y, r0, r1, stops) {
  const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
  stops.forEach((c, i) => Array.isArray(c) ? g.addColorStop(c[0], c[1]) : g.addColorStop(i / (stops.length - 1), c));
  return g;
}

// ---------- 文字（描边 + 阴影的游戏字）----------
export function text(ctx, s, x, y, o = {}) {
  const size = o.size || 16;
  ctx.font = `${o.weight || 'bold'} ${size}px ${FONT}`;
  ctx.textAlign = o.align || 'left';
  ctx.textBaseline = o.base || 'alphabetic';
  if (o.shadow !== false) {
    ctx.fillStyle = o.shadowColor || 'rgba(0,0,0,0.55)';
    ctx.fillText(s, x + (o.sx ?? 0), y + (o.sy ?? Math.max(1.5, size / 12)));
  }
  if (o.stroke) {
    ctx.lineJoin = 'round'; ctx.lineWidth = o.sw || Math.max(2, size / 6); ctx.strokeStyle = o.stroke;
    ctx.strokeText(s, x, y);
  }
  ctx.fillStyle = o.color || '#fff';
  ctx.fillText(s, x, y);
}
export function measure(ctx, s, size, weight = 'bold') {
  ctx.font = `${weight} ${size}px ${FONT}`;
  return ctx.measureText(s).width;
}
