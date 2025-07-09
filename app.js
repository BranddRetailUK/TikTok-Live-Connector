// app.js
import 'dotenv/config.js';
import { TikTokLiveConnection, WebcastEvent, ControlEvent, SignConfig } from 'tiktok-live-connector';

// 🧠 Validate required env vars
if (!process.env.TIKTOK_USERNAME) {
  console.error('❌ TIKTOK_USERNAME is not set in .env');
  process.exit(1);
}

// 🔐 Optional: use EulerStream sign server
if (process.env.SIGN_API_KEY) {
  SignConfig.apiKey = process.env.SIGN_API_KEY;
}

// 🎯 Create connection instance
const connection = new TikTokLiveConnection(process.env.TIKTOK_USERNAME, {
  enableExtendedGiftInfo: true,
  sessionId: process.env.SESSION_ID || undefined,
  ttTargetIdc: process.env.TT_TARGET_IDC || undefined,
});

// 🚀 Connect to the TikTok LIVE stream
connection.connect().then(state => {
  console.log(`✅ Connected to ${process.env.TIKTOK_USERNAME} (roomId: ${state.roomId})`);
}).catch(err => {
  console.error('❌ Failed to connect:', err.message || err);
});

// 💬 Chat handler
connection.on(WebcastEvent.CHAT, data => {
  console.log(`[CHAT] ${data.user.uniqueId}: ${data.comment}`);
});

// 🎁 Gift handler
connection.on(WebcastEvent.GIFT, data => {
  if (data.giftType === 1 && !data.repeatEnd) return; // skip in-progress streaks
  console.log(`[GIFT] ${data.user.uniqueId} sent ${data.giftName} x${data.repeatCount}`);
});

// ⚠️ Control event handlers
connection.on(ControlEvent.DISCONNECTED, () => {
  console.warn('⚠️ Disconnected from TikTok LIVE');
});

connection.on(ControlEvent.ERROR, err => {
  console.error('❌ Runtime error:', err.message || err);
});
