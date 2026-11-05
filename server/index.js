// 弹幕游戏后端骨架（本地运行，不随网页一起部署）
// 作用：接收直播间事件 → 去重 → 转换成统一格式 → 通过 WebSocket 推给游戏画面
//
//   npm install && npm start            # 启动，监听 8080
//   打开 网页?ws=ws://localhost:8080     # 游戏连接后端
//   npm run mock                         # 另开终端，模拟观众疯狂刷弹幕
//
// 接入抖音官方「直播小玩法」时，只需完善 /douyin/callback 里的验签和字段转换。
// 字段名以开放平台文档当前版本为准，下面的 msg_type / payload 结构仅作示意。
import http from 'node:http';
import crypto from 'node:crypto';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT || 8080);
const DOUYIN_SECRET = process.env.DOUYIN_SECRET || ''; // 回调验签用，放环境变量，别写进代码

// ---------- 去重（生产环境建议用 Redis SETNX + 过期时间）----------
const seen = new Map();
function isDuplicate(id) {
  if (!id) return false;
  const now = Date.now();
  if (seen.has(id)) return true;
  seen.set(id, now);
  if (seen.size > 50000) for (const [k, t] of seen) { if (now - t > 10 * 60_000) seen.delete(k); else break; }
  return false;
}

// ---------- 广播给游戏客户端 ----------
const clients = new Set();
function broadcast(ev) {
  const data = JSON.stringify(ev);
  for (const c of clients) if (c.readyState === 1) c.send(data);
}

// ---------- 抖音推送 → 统一事件格式（示意）----------
function fromDouyin(msgType, item) {
  const user = { nick: item.nickname || '匿名', avatar: item.avatar_url, openid: item.sec_openid };
  switch (msgType) {
    case 'live_comment': return { type: 'comment', user, content: item.content };
    case 'live_like':    return { type: 'like', user, count: Number(item.like_num) || 1 };
    case 'live_gift':    return { type: 'gift', user, gift: GIFT_ID_MAP[item.sec_gift_id] || item.gift_name, count: Number(item.gift_num) || 1 };
    default: return null;
  }
}
// 平台下发的礼物 ID → 游戏内礼物名，按实际申请到的礼物配置
const GIFT_ID_MAP = {};

function verifyDouyin(req, body) {
  if (!DOUYIN_SECRET) return true; // 本地开发不验签
  // TODO: 按开放平台文档拼接签名串并比对，下面只是常见写法的示意
  const sign = req.headers['x-signature'] || '';
  const expect = crypto.createHash('md5').update(body + DOUYIN_SECRET).digest('base64');
  return sign === expect;
}

// ---------- HTTP ----------
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', c => { body += c; if (body.length > 1e6) req.destroy(); });
  req.on('end', () => {
    try {
      // 抖音数据推送回调
      if (req.method === 'POST' && req.url === '/douyin/callback') {
        if (!verifyDouyin(req, body)) { res.writeHead(403).end('bad sign'); return; }
        const msgType = req.headers['x-msg-type'];
        const items = JSON.parse(body || '[]');
        for (const item of Array.isArray(items) ? items : [items]) {
          if (isDuplicate(item.msg_id)) continue;
          const ev = fromDouyin(msgType, item);
          if (ev) broadcast(ev);
        }
        res.writeHead(200).end('ok');
        return;
      }
      // 本地模拟：直接 POST 统一格式事件
      if (req.method === 'POST' && req.url === '/mock') {
        const ev = JSON.parse(body);
        if (!isDuplicate(ev.msg_id)) broadcast(ev);
        res.writeHead(200).end('ok');
        return;
      }
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }).end(`弹幕游戏后端运行中，在线画面 ${clients.size} 个`);
    } catch (e) {
      res.writeHead(400).end(String(e.message));
    }
  });
});

const wss = new WebSocketServer({ server });
wss.on('connection', ws => {
  clients.add(ws);
  console.log(`游戏画面已连接，当前 ${clients.size} 个`);
  ws.on('message', raw => {
    // 网页右侧模拟面板的操作也走后端，和真实推送同一条链路
    try { const m = JSON.parse(raw); if (m.action === 'simulate' && m.event) broadcast(m.event); } catch {}
  });
  ws.on('close', () => clients.delete(ws));
});

server.listen(PORT, () => console.log(`后端已启动：http://localhost:${PORT}   WebSocket: ws://localhost:${PORT}`));
