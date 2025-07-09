import express from 'express';
import { Server } from 'socket.io';
import http from 'http';
import dotenv from 'dotenv';
import { TikTokLiveConnection } from 'tiktok-live-connector';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(express.static('public'));

const port = process.env.PORT || 8080;

let tiktokConnection = null;

const connectToTikTok = (username, socket) => {
  if (tiktokConnection) {
    tiktokConnection.disconnect();
  }

  tiktokConnection = new TikTokLiveConnection(username, {
    enableExtendedGiftInfo: true
  });

  tiktokConnection.connect().catch((err) => {
    console.error('❌ Connection failed:', err.message);
    socket.emit('status', `❌ Connection failed: ${err.message}`);
  });

  tiktokConnection.on('chat', (data) => {
    socket.emit('chat', {
      nickname: data?.nickname || 'Unknown',
      comment: data?.comment || '(no comment)'
    });
  });

  tiktokConnection.on('gift', (data) => {
    socket.emit('gift', {
      nickname: data?.nickname || 'Unknown',
      giftName: data?.giftName || 'Mystery Gift',
      repeatCount: typeof data?.repeatCount === 'number' ? data.repeatCount : 1
    });
  });

  tiktokConnection.on('like', (data) => {
    socket.emit('like', {
      nickname: data?.nickname || 'Viewer',
      likeCount: typeof data?.likeCount === 'number' ? data.likeCount : 1,
      totalLikeCount: typeof data?.totalLikeCount === 'number' ? data.totalLikeCount : 0
    });
  });

  tiktokConnection.on('follow', (data) => {
    socket.emit('follow', {
      nickname: data?.nickname || 'New Follower'
    });
  });

  tiktokConnection.on('subscribe', (data) => {
    socket.emit('subscribe', {
      nickname: data?.nickname || 'Subscriber'
    });
  });
};

io.on('connection', (socket) => {
  console.log('✅ Frontend connected via WebSocket');

  const defaultUsername = process.env.TIKTOK_USERNAME;
  if (defaultUsername) {
    connectToTikTok(defaultUsername, socket);
  }

  socket.on('setUsername', (username) => {
    console.log(`🔁 Switching to user: ${username}`);
    connectToTikTok(username, socket);
  });
});

server.listen(port, () => {
  console.log(`✅ Dashboard running at http://localhost:${port}`);
});
