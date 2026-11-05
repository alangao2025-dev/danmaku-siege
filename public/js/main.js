// 入口：主循环 + 模拟直播间 + 可选的后端 WebSocket
// 所有直播间事件统一格式（和 server/ 推送的一致）：
//   { type:'comment', user:{nick}, content:'1' } / { type:'like', user, count } / { type:'gift', user, gift:'火箭', count }
import { W, H } from './config.js';
import { pick, rand } from './util.js';
import { preloadUnits } from './art.js';
import { initRender, render, quality } from './render.js';
import { setFxBudget } from './fx.js';
import { game, newRound, update, handleEvent } from './game.js';
import { enableAudio, toggleAudio, audioOn } from './sfx.js';

const cvs = document.getElementById('game');
const ctx = cvs.getContext('2d');
const $ = id => document.getElementById(id);

// 高清屏下按设备像素渲染，最多 2 倍
function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cvs.width = W * dpr; cvs.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resize();
window.addEventListener('resize', resize);

$('loading').textContent = '正在绘制角色…';
setTimeout(() => {
  preloadUnits();
  initRender();
  newRound();
  $('loading').remove();
  let last = performance.now(), fpsAcc = 0, fpsN = 0, lowSec = 0, highSec = 0;
  function loop(now) {
    const raw = Math.min(0.05, (now - last) / 1000); last = now;
    const dt = update(raw);
    tickBots(raw);
    render(ctx, dt);
    fpsAcc += raw; fpsN++;
    if (fpsAcc >= 1) {
      // 自动画质：连续 2 秒低于 40 帧降级，连续 4 秒高于 55 帧恢复
      lowSec = fpsN < 40 ? lowSec + 1 : 0; highSec = fpsN > 55 ? highSec + 1 : 0;
      if (!quality.low && lowSec >= 2) { quality.low = true; setFxBudget(500); }
      if (quality.low && highSec >= 4) { quality.low = false; setFxBudget(1400); }
      $('fps').textContent = `${fpsN} FPS · ${game.units.length} 单位${quality.low ? ' · 省电画质' : ''}`; fpsAcc = 0; fpsN = 0;
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}, 30);

// ---------------- 机器人观众 ----------------
const NAMES = ['快乐小狗', '夜猫子', '奶茶续命', '摸鱼达人', '小透明', '追风少年', '干饭王', '芒果布丁', '熬夜冠军', '社恐本恐',
  '路过的猫', '可乐加冰', '星河长明', '早睡失败', '柠檬精', '咸鱼翻身', '一只饺子', '山海', '橘子汽水', '今天不加班',
  '阿强', '小美', '老王', '大白', '小鹿乱撞', '月亮邮递员', '北方的狼', '南风知我意', '菠萝吹雪', '番茄炒蛋',
  '云朵棉花糖', '深夜食堂', '冰美式', '海盐芝士', '风吹麦浪', '一口奶茶', '起风了', '小王子', '吃瓜群众', '晚安喵'];
let botAcc = 0;
function tickBots(dt) {
  if (!$('auto').checked || game.phase === 'over' || game.phase === 'intro' && game.phaseT < 1) return;
  botAcc += dt * Number($('heat').value);
  while (botAcc >= 1) {
    botAcc -= 1;
    const user = { nick: pick(NAMES) };
    const r = Math.random(), giftRate = Number($('gifts').value) / 10;
    if (!game.players.has(user.nick)) emitLocal({ type: 'comment', user, content: Math.random() < 0.5 ? '1' : '2' });
    else if (r < 0.06 * giftRate) emitLocal({ type: 'gift', user, gift: '小心心', count: Math.random() < 0.2 ? 5 : 1 });
    else if (r < 0.085 * giftRate) emitLocal({ type: 'gift', user, gift: '玫瑰', count: 1 });
    else if (r < 0.091 * giftRate) emitLocal({ type: 'gift', user, gift: '甜甜圈', count: 1 });
    else if (r < 0.0925 * giftRate) emitLocal({ type: 'gift', user, gift: '火箭', count: 1 });
    else if (r < 0.75) emitLocal({ type: 'comment', user, content: Math.random() < 0.15 ? pick(['剑', '弓', '法']) : '冲' });
    else if (r < 0.88) emitLocal({ type: 'like', user, count: 5 + (rand(20) | 0) });
    else if (r < 0.92) emitLocal({ type: 'comment', user, content: '666' });
    else emitLocal({ type: 'comment', user, content: pick(['好看', '主播加油', '哈哈哈', '红方必胜', '蓝方冲啊']) });
  }
}
const emitLocal = ev => handleEvent(ev);

// ---------------- 手动模拟面板 ----------------
let ws = null;
function emit(ev) { // 连了后端就走后端（和真实推送同一条链路），否则本地处理
  enableAudio(); updateSound();
  if (ws && ws.readyState === 1) ws.send(JSON.stringify({ action: 'simulate', event: ev }));
  else handleEvent(ev);
}
const me = () => ({ nick: $('nick').value.trim() || '我' });
const sendMsg = () => { const v = $('msg').value.trim(); if (v) { emit({ type: 'comment', user: me(), content: v }); $('msg').value = ''; } };
$('send').onclick = sendMsg;
$('msg').onkeydown = e => { if (e.key === 'Enter') sendMsg(); };
document.querySelectorAll('[data-c]').forEach(b => b.onclick = () => emit({ type: 'comment', user: me(), content: b.dataset.c }));
document.querySelectorAll('[data-like]').forEach(b => b.onclick = () => emit({ type: 'like', user: me(), count: +b.dataset.like }));
document.querySelectorAll('[data-g]').forEach(b => b.onclick = () => emit({ type: 'gift', user: me(), gift: b.dataset.g, count: +(b.dataset.n || 1) }));
for (const id of ['heat', 'gifts']) { const upd = () => { $(id + 'v').textContent = $(id).value; }; $(id).oninput = upd; upd(); }
$('restart').onclick = () => newRound();
$('fs').onclick = () => document.fullscreenElement ? document.exitFullscreen() : $('stage').requestFullscreen?.();
$('panel').onclick = () => document.body.classList.toggle('clean');
const updateSound = () => { $('sound').textContent = audioOn() ? '🔊 音效开' : '🔇 音效关'; };
$('sound').onclick = () => { toggleAudio(); updateSound(); };
cvs.addEventListener('pointerdown', () => { enableAudio(); updateSound(); }, { once: true });
window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'h' || e.key === 'H') document.body.classList.toggle('clean'); // 隐藏面板，方便直播采集
});

// ---------------- 可选：连接后端 ----------------
const wsUrl = new URLSearchParams(location.search).get('ws');
if (wsUrl) {
  const connect = () => {
    ws = new WebSocket(wsUrl);
    ws.onopen = () => { $('conn').textContent = '已连接后端'; $('conn').classList.add('on'); };
    ws.onmessage = m => { try { handleEvent(JSON.parse(m.data)); } catch (e) { console.warn(e); } };
    ws.onclose = () => { $('conn').textContent = '后端断开，重连中'; $('conn').classList.remove('on'); setTimeout(connect, 2000); };
  };
  connect();
}
window.handleEvent = handleEvent; // 方便在控制台调试
