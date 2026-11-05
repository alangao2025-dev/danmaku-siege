// 不渲染，只跑逻辑，看一局里城堡血量和兵力变化（用于调数值）
import { createCanvas } from '@napi-rs/canvas';
import { setCanvasFactory, pick } from '../public/js/util.js';
setCanvasFactory((w, h) => createCanvas(w, h));
const C = await import('../public/js/config.js');
const G = await import('../public/js/game.js');
const rate = Number(process.argv[2] || 12);
G.newRound();
const names = Array.from({ length: 40 }, (_, i) => '观众' + (i + 1));
const dt = 1 / 30; let t = 0, acc = 0, next = 0;
while (G.game.phase !== 'over' && t < 260) {
  t += dt; acc += dt * rate;
  while (acc >= 1) { acc--; const user = { nick: pick(names) }, r = Math.random();
    if (!G.game.players.has(user.nick)) G.handleEvent({ type: 'comment', user, content: Math.random() < 0.5 ? '1' : '2' });
    else if (r < 0.06) G.handleEvent({ type: 'gift', user, gift: '小心心', count: 1 });
    else if (r < 0.08) G.handleEvent({ type: 'gift', user, gift: '玫瑰', count: 1 });
    else if (r < 0.75) G.handleEvent({ type: 'comment', user, content: '冲' });
    else if (r < 0.88) G.handleEvent({ type: 'like', user, count: 10 });
    else G.handleEvent({ type: 'comment', user, content: '666' }); }
  if (Math.abs(t - 50) < dt / 2) G.handleEvent({ type: 'gift', user: { nick: '大哥' }, gift: '甜甜圈', count: 1 });
  G.update(dt);
  if (t >= next) {
    const near = team => G.game.units.filter(u => u.team !== team && !u.dying && Math.abs(u.x - C.castleFront(team)) < 60).length;
    const n = team => G.game.units.filter(u => u.team === team && !u.dying).length;
    console.log(`t=${String(Math.round(t)).padStart(3)} ${G.game.phase.padEnd(5)} 红城 ${String(Math.round(G.game.castles.red.hp)).padStart(5)} 蓝城 ${String(Math.round(G.game.castles.blue.hp)).padStart(5)} | 兵 红${n('red')} 蓝${n('blue')} | 贴城 红城下${near('red')} 蓝城下${near('blue')}`);
    next += 20;
  }
}
console.log('结束 t=', Math.round(t), '胜者', G.game.winner);
