import { createCanvas } from '@napi-rs/canvas';
const els = {};
const mk = id => els[id] ||= { id, checked: true, value: { heat: '30', gifts: '20' }[id] ?? '', textContent: '', classList: { add() {}, remove() {}, toggle() {} }, dataset: {}, addEventListener() {}, remove() {}, requestFullscreen() {} };
const main = createCanvas(1280, 720); Object.assign(main, { addEventListener() {} });
els.game = main;
let cb; let now = 0;
globalThis.window = { devicePixelRatio: 1, addEventListener() {} };
globalThis.document = { getElementById: id => mk(id), querySelectorAll: () => [], createElement: () => createCanvas(1, 1), body: { classList: { toggle() {} } }, addEventListener() {} };
globalThis.location = { search: '' };
globalThis.requestAnimationFrame = f => { cb = f; };
globalThis.setTimeout = f => f();
const realNow = performance.now.bind(performance);
const { setCanvasFactory } = await import('../public/js/util.js');
setCanvasFactory((w, h) => createCanvas(w, h));
await import('../public/js/main.js');
for (let i = 0; i < 90; i++) { now += 1000 / 30; const f = cb; cb = null; f(now); }
const G = await import('../public/js/game.js');
console.log('入口跑通：阶段', G.game.phase, '单位', G.game.units.length, '玩家', G.game.players.size);
