require("dotenv").config();
const express = require("express");
const {
  createSession,
  playAudio,
  controlPlayback,
  endSession,
} = require("./services/audioStreamer");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8000;

// Health Check
app.get("/", (req, res) => {
  res.json({ ok: true, service: "Telegram Music API (Node.js)" });
});

// 1. Create Session
app.post("/create_session", async (req, res) => {
  try {
    const { bot_token, assistant_string_session } = req.body;
    if (!bot_token || !assistant_string_session) {
      return res.status(400).json({ ok: false, error: "Missing required fields" });
    }

    const sessionId = await createSession(bot_token, assistant_string_session);
    res.json({ ok: true, session_id: sessionId });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// 2. Play Audio
app.post("/play", async (req, res) => {
  try {
    const { session_id, chat_id, query } = req.body;
    if (!session_id || !chat_id || !query) {
      return res.status(400).json({ ok: false, error: "Missing required fields" });
    }

    const track = await playAudio(session_id, chat_id, query);
    res.json({ ok: true, track });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// 3. Control Playback
app.post("/control", async (req, res) => {
  try {
    const { session_id, chat_id, action } = req.body;
    if (!session_id || !chat_id || !action) {
      return res.status(400).json({ ok: false, error: "Missing required fields" });
    }

    const result = controlPlayback(session_id, chat_id, action);
    res.json({ ok: true, result });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// 4. End Session
app.post("/end", async (req, res) => {
  try {
    const { session_id, chat_id } = req.body;
    if (!session_id || !chat_id) {
      return res.status(400).json({ ok: false, error: "Missing required fields" });
    }

    endSession(session_id, chat_id);
    res.json({ ok: true, message: "Left voice chat successfully" });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
