import 'dotenv/config.js';
import express from 'express';
import { WebSocketServer } from 'ws';
import { TikTokLiveConnection, WebcastEvent, ControlEvent, SignConfig } from 'tiktok-live-connector';

const app = express();
const port = process.env.PORT || 8080;
app.use(express.static('public'));

const server = app.listen(port, () => {
  console.log(`✅ Dashboard running at http://localhost:${port}`);
});

const wss = new WebSocketServer({ server });
let sockets = [];

wss.on('connection', ws => {
  sockets.push(ws);
  ws.on('close', () => {
    sockets = sockets.filter(s => s !== ws);
  });
});

function broadcast(data) {
  const msg = JSON.stringify(data);
  sockets.forEach(ws => {
    if (ws.readyState === ws.OPEN) ws.send(msg);
  });
}

if (!process.env.TIKTOK_USERNAME) {
  console.error('❌ TIKTOK_USERNAME is missing in .env');
  process.exit(1);
}

if (process.env.SIGN_API_KEY) {
  SignConfig.apiKey = process.env.SIGN_API_KEY;
}

const connection = new TikTokLiveConnection(process.env.TIKTOK_USERNAME, {
  enableExtendedGiftInfo: true,
  sessionId: process.env.SESSION_ID || undefined,
  ttTargetIdc: process.env.TT_TARGET_IDC || undefined,
});

connection.connect().then(state => {
  console.log(`🎥 Connected to ${process.env.TIKTOK_USERNAME} (roomId: ${state.roomId})`);
}).catch(err => {
  console.error('❌ Connection failed:', err.message || err);
});

connection.on(WebcastEvent.CHAT, data => {
  broadcast({ type: 'chat', user: data.user.uniqueId, message: data.comment });
});

connection.on(WebcastEvent.GIFT, data => {
  if (data.giftType === 1 && !data.repeatEnd) return;
  broadcast({ type: 'gift', user: data.user.uniqueId, gift: data.giftName, amount: data.repeatCount });
});

connection.on(ControlEvent.DISCONNECTED, () => {
  console.warn('⚠️ Disconnected from LIVE');
});

connection.on(ControlEvent.ERROR, err => {
  console.error('❌ Error:', err.message || err);
});
