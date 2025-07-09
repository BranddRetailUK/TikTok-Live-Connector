import express from "express";
import http from "http";
import { Server } from "socket.io";
import { TikTokLiveConnection } from "tiktok-live-connector";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const port = process.env.PORT || 3000;

app.use(express.static("public"));

io.on("connection", (socket) => {
  console.log("🟢 Client connected");

  socket.on("setUsername", (username) => {
    console.log(`🔗 Connecting to stream: ${username}`);

    const tiktokConnection = new TikTokLiveConnection(username, {
      enableExtendedGiftInfo: true,
    });

    tiktokConnection.connect().catch((err) => {
      console.error("❌ Connection failed:", err.message);
      socket.emit("status", `❌ Connection failed: ${err.message}`);
    });

    tiktokConnection.on("connected", () => {
      console.log("✅ Connected to TikTok Live stream");
      socket.emit("status", "✅ Connected to TikTok Live stream");
    });

    tiktokConnection.on("chat", (data) => {
      const user = data.uniqueId || data.nickname || data.userId || "Guest";
      const comment = data.comment || "";
      socket.emit("chat", { user, comment });
    });

    tiktokConnection.on("gift", (data) => {
      const user = data.uniqueId || data.nickname || data.userId || "Guest";
      const gift = data.giftName || (data.gift && data.gift.name) || "Gift";
      const amount = data.repeatCount || 1;
      socket.emit("gift", { user, gift, amount });
    });

    tiktokConnection.on("like", (data) => {
      const user = data.uniqueId || data.nickname || data.userId || "Guest";
      const total = data.totalLikeCount || 0;
      socket.emit("like", { user, total });
    });

    tiktokConnection.on("follow", (data) => {
      const user = data.uniqueId || data.nickname || data.userId || "Guest";
      socket.emit("follow", { user });
    });

    tiktokConnection.on("subscribe", (data) => {
      const user = data.uniqueId || data.nickname || data.userId || "Guest";
      socket.emit("subscribe", { user });
    });

    tiktokConnection.on("disconnected", () => {
      console.log("🔌 Disconnected from TikTok Live stream");
      socket.emit("status", "🔌 Disconnected from TikTok Live stream");
    });
  });

  socket.on("disconnect", () => {
    console.log("🔴 Client disconnected");
  });
});

server.listen(port, () => {
  console.log(`✅ Dashboard running at http://localhost:${port}`);
});
