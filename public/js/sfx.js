// 音效：全部用 WebAudio 实时合成，不需要音频文件。浏览器要求用户点击后才能出声
let ac = null, master = null, enabled = false;
const last = {};

export function enableAudio() {
  if (typeof window === 'undefined' || !window.AudioContext) return false;
  if (!ac) {
    ac = new AudioContext();
    master = ac.createGain(); master.gain.value = 0.5;
    const comp = ac.createDynamicsCompressor(); master.connect(comp); comp.connect(ac.destination);
  }
  ac.resume(); enabled = true; return true;
}
export function toggleAudio() { if (!enabled) return enableAudio(); enabled = false; return false; }
export const audioOn = () => enabled;

function noiseBuf() {
  if (noiseBuf.b) return noiseBuf.b;
  const b = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return (noiseBuf.b = b);
}
function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
function osc(type, f0, f1, dur, vol, t = ac.currentTime) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  env(g, t, 0.005, vol, dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, vol, freq, q = 1, type = 'lowpass', t = ac.currentTime, f1) {
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = noiseBuf(); f.type = type; f.frequency.setValueAtTime(freq, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur); f.Q.value = q;
  env(g, t, 0.005, vol, dur); s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.05);
}

const SOUNDS = {
  pop: v => osc('triangle', 500, 900, 0.08, 0.15 * v),
  clink: v => { osc('square', 1800 + Math.random() * 600, 1200, 0.05, 0.05 * v); noise(0.04, 0.08 * v, 4000, 2, 'highpass'); },
  twang: v => osc('sawtooth', 300, 150, 0.12, 0.06 * v),
  whoosh: v => noise(0.3, 0.15 * v, 600, 1, 'bandpass', undefined, 2000),
  zap: v => { osc('sawtooth', 1400, 80, 0.25, 0.15 * v); noise(0.3, 0.3 * v, 3000, 1, 'highpass'); },
  thud: v => { osc('sine', 120, 35, 0.4, 0.6 * v); noise(0.3, 0.3 * v, 400); },
  boom: v => { osc('sine', 90, 25, 0.8, 0.7 * v); noise(0.9, 0.5 * v, 900, 1, 'lowpass', undefined, 120); },
  roar: v => { osc('sawtooth', 160, 60, 1.2, 0.25 * v); osc('sawtooth', 163, 55, 1.2, 0.2 * v); noise(1.2, 0.25 * v, 500, 2, 'bandpass', undefined, 200); },
  horn: v => { const t = ac.currentTime; [[392, 0], [523, 0.18], [659, 0.36]].forEach(([f, d]) => { osc('sawtooth', f, 0, 0.35, 0.08 * v, t + d); osc('triangle', f * 2, 0, 0.35, 0.05 * v, t + d); }); },
  ult: v => { osc('sawtooth', 80, 800, 0.9, 0.15 * v); noise(1, 0.25 * v, 200, 1, 'lowpass', undefined, 4000); },
  win: v => { const t = ac.currentTime; [523, 659, 784, 1047].forEach((f, i) => { osc('triangle', f, 0, 0.6, 0.12 * v, t + i * 0.14); osc('square', f / 2, 0, 0.4, 0.03 * v, t + i * 0.14); }); },
};

// 同一种声音限制频率，防止几百个小兵同时出声
export function sfx(name, vol = 1) {
  if (!enabled || !ac || !SOUNDS[name]) return;
  const now = ac.currentTime, gap = { pop: 0.05, clink: 0.04, twang: 0.06, whoosh: 0.08 }[name] ?? 0.12;
  if (last[name] && now - last[name] < gap) return;
  last[name] = now;
  try { SOUNDS[name](vol); } catch { /* 忽略 */ }
}
