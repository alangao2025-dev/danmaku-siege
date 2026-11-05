// 无浏览器截图：在 Node 里跑真实游戏逻辑和渲染，按时间点输出 PNG
//   node shot.mjs <输出目录> [秒数列表，如 3,30,90]
import { createCanvas } from '@napi-rs/canvas';
import fs from 'node:fs';
import { setCanvasFactory, pick } from '../public/js/util.js';
setCanvasFactory((w, h) => createCanvas(w, h));
const { W, H } = await import('../public/js/config.js');
const { preloadUnits } = await import('../public/js/art.js');
const { initRender, render } = await import('../public/js/render.js');
const G = await import('../public/js/game.js');
const outDir = process.argv[2] || '/tmp/shots';
const times = (process.argv[3] || '3,25,60,100,160,190').split(',').map(Number);
fs.mkdirSync(outDir, { recursive: true });
const t0 = Date.now(); preloadUnits(); initRender(); G.newRound();
console.log('预渲染', Date.now() - t0, 'ms');
const cvs = createCanvas(W, H), ctx = cvs.getContext('2d');
const names = Array.from({ length: 40 }, (_, i) => '观众' + (i + 1));
const fixed = { 20: ['火箭', '土豪甲'], 50: ['甜甜圈', '大哥乙'], 58: ['玫瑰', '小可爱'], 95: ['火箭', '蓝方老板'], 140: ['甜甜圈', '路人丙'] };
const dt = 1 / 30; let t = 0, ti = 0, acc = 0, slowFrames = 0, frameMs = 0, frames = 0;
while (ti < times.length) {
  t += dt;
  acc += dt * 12;
  while (acc >= 1) { acc--; const user = { nick: pick(names) }, r = Math.random();
    if (!G.game.players.has(user.nick)) G.handleEvent({ type: 'comment', user, content: Math.random() < 0.5 ? '1' : '2' });
    else if (r < 0.06) G.handleEvent({ type: 'gift', user, gift: '小心心', count: 1 });
    else if (r < 0.08) G.handleEvent({ type: 'gift', user, gift: '玫瑰', count: 1 });
    else if (r < 0.75) G.handleEvent({ type: 'comment', user, content: Math.random() < 0.15 ? pick(['剑', '弓', '法']) : '冲' });
    else if (r < 0.88) G.handleEvent({ type: 'like', user, count: 10 });
    else G.handleEvent({ type: 'comment', user, content: '666' }); }
  for (const k of Object.keys(fixed)) if (Math.abs(t - k) < dt / 2) { const [g, n] = fixed[k]; G.handleEvent({ type: 'gift', user: { nick: n }, gift: g, count: 1 }); if (k == 95) G.handleEvent({ type: 'comment', user: { nick: n }, content: '2' }); }
  const d = G.update(dt);
  if (t >= times[ti]) {
    const s = performance.now(); render(ctx, d); frameMs = performance.now() - s; frames = 1;
    fs.writeFileSync(`${outDir}/t${String(times[ti]).padStart(3, '0')}.png`, cvs.toBuffer('image/png'));
    console.log(`t=${times[ti]}s 阶段=${G.game.phase} 单位=${G.game.units.length} 粒子 红城=${Math.round(G.game.castles.red.hp)} 蓝城=${Math.round(G.game.castles.blue.hp)} 单帧渲染 ${(frameMs / frames).toFixed(1)}ms`);
    frameMs = 0; frames = 0; ti++;
  }
}

