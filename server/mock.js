// 模拟观众：持续往后端 /mock 发送弹幕、点赞、礼物
//   node mock.js [每秒条数=20] [后端地址=http://localhost:8080]
const rate = Number(process.argv[2] || 20);
const base = process.argv[3] || 'http://localhost:8080';
const names = Array.from({ length: 200 }, (_, i) => `观众${String(i + 1).padStart(3, '0')}`);
const pick = a => a[(Math.random() * a.length) | 0];
let seq = 0;
function randomEvent() {
  const user = { nick: pick(names) }, r = Math.random(), msg_id = `mock-${Date.now()}-${seq++}`;
  if (r < 0.15) return { msg_id, type: 'comment', user, content: Math.random() < 0.5 ? '1' : '2' };
  if (r < 0.7) return { msg_id, type: 'comment', user, content: Math.random() < 0.15 ? pick(['剑', '弓', '法']) : '冲' };
  if (r < 0.82) return { msg_id, type: 'like', user, count: 10 };
  if (r < 0.88) return { msg_id, type: 'comment', user, content: '666' };
  if (r < 0.95) return { msg_id, type: 'gift', user, gift: '小心心', count: 1 };
  if (r < 0.985) return { msg_id, type: 'gift', user, gift: '玫瑰', count: 1 };
  if (r < 0.997) return { msg_id, type: 'gift', user, gift: '甜甜圈', count: 1 };
  return { msg_id, type: 'gift', user, gift: '火箭', count: 1 };
}
console.log(`每秒 ${rate} 条 → ${base}/mock （Ctrl+C 停止）`);
setInterval(() => {
  fetch(`${base}/mock`, { method: 'POST', body: JSON.stringify(randomEvent()) }).catch(e => console.error(e.message));
}, 1000 / rate);
