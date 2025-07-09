import express from 'express';
import { Server } from 'socket.io';
import http from 'http';
import dotenv from 'dotenv';
import { TikTokLiveConnection } from 'tiktok-live-connector';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  }
});

// Serve static files from public folder
app.use(express.static('public'));

const port = process.env.PORT || 8080;

// WebSocket connection to browser
io.on('connection', (socket) => {
  console.log('Frontend connected via WebSocket');

  // Connect to TikTok Live
  const tiktokUsername = process.env.TIKTOK_USERNAME;
  const tiktokConnection = new TikTokLiveConnection(tiktokUsername, {
    enableExtendedGiftInfo: true
  });

  tiktokConnection.connect().catch((err) => {
    console.error('❌ Connection failed:', err.message);
  });

  tiktokConnection.on('chat', data => {
    socket.emit('chat', {
      user: data.nickname,
      comment: data.comment
    });
  });

  tiktokConnection.on('gift', data => {
    socket.emit('gift', {
      user: data.nickname,
      gift: data.giftName,
      amount: data.repeatCount
    });
  });

  tiktokConnection.on('like', data => {
    socket.emit('like', {
      user: data.nickname,
      total: data.totalLikeCount
    });
  });

  tiktokConnection.on('follow', data => {
    socket.emit('follow', {
      user: data.nickname
    });
  });

  tiktokConnection.on('subscribe', data => {
    socket.emit('subscribe', {
      user: data.nickname
    });
  });
});

server.listen(port, () => {
  console.log(`✅ Dashboard running at http://localhost:${port}`);
});
