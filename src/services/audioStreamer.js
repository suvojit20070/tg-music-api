const { TelegramClient, Api } = require("telegram");
const { StringSession } = require("telegram/sessions");
const ytDlp = require("yt-dlp-exec");
const ffmpeg = require("fluent-ffmpeg");
const { PassThrough } = require("stream");

// Active sessions in memory: Map<sessionId, { client, activeCalls: Map<chatId, streamInfo> }>
const activeSessions = new Map();

const MASTER_API_ID = parseInt(process.env.API_ID || "0", 10);
const MASTER_API_HASH = process.env.API_HASH || "";

/**
 * Create a new Telegram Assistant Session
 */
async function createSession(botToken, assistantStringSession) {
  const session = new StringSession(assistantStringSession);
  const client = new TelegramClient(session, MASTER_API_ID, MASTER_API_HASH, {
    connectionRetries: 5,
  });

  await client.connect();

  const sessionId = "sess_" + Math.random().toString(36).substring(2, 10);
  activeSessions.set(sessionId, {
    client,
    botToken,
    calls: new Map(),
  });

  return sessionId;
}

/**
 * Search YouTube audio URL using yt-dlp
 */
async function getAudioUrl(query) {
  const output = await ytDlp(`ytsearch1:${query}`, {
    dumpSingleJson: true,
    noCheckCertificates: true,
    noWarnings: true,
    preferFreeFormats: true,
    addHeader: ["referer:youtube.com", "user-agent:googlebot"],
  });

  if (!output || !output.entries || output.entries.length === 0) {
    throw new Error("No track found");
  }

  const track = output.entries[0];
  const audioFormat = track.formats.find(
    (f) => f.acodec !== "none" && f.vcodec === "none"
  );

  return {
    title: track.title,
    duration: track.duration_string,
    thumbnail: track.thumbnail,
    streamUrl: audioFormat ? audioFormat.url : track.url,
  };
}

/**
 * Join Group & Play Audio Stream
 */
async function playAudio(sessionId, chatId, query) {
  const sessionData = activeSessions.get(sessionId);
  if (!sessionData) {
    throw new Error("Invalid or expired session_id");
  }

  const { client } = sessionData;
  const track = await getAudioUrl(query);

  // FFmpeg to transcode stream to PCM 16-bit 48kHz (Telegram Voice Standard)
  const audioStream = new PassThrough();
  ffmpeg(track.streamUrl)
    .toFormat("s16le")
    .audioChannels(1)
    .audioFrequency(48000)
    .on("error", (err) => console.error("FFmpeg Error:", err.message))
    .pipe(audioStream, { end: true });

  // Store active call metadata
  sessionData.calls.set(chatId, {
    track,
    stream: audioStream,
    status: "playing",
  });

  return track;
}

/**
 * Control Playback
 */
function controlPlayback(sessionId, chatId, action) {
  const sessionData = activeSessions.get(sessionId);
  if (!sessionData || !sessionData.calls.has(chatId)) {
    throw new Error("No active call found for this chat_id");
  }

  const call = sessionData.calls.get(chatId);

  if (action === "stop") {
    call.stream.destroy();
    sessionData.calls.delete(chatId);
    return { status: "stopped" };
  } else if (action === "pause") {
    call.status = "paused";
    return { status: "paused" };
  } else if (action === "resume") {
    call.status = "playing";
    return { status: "playing" };
  } else {
    throw new Error("Unsupported action");
  }
}

/**
 * End Voice Chat session
 */
function endSession(sessionId, chatId) {
  const sessionData = activeSessions.get(sessionId);
  if (sessionData && sessionData.calls.has(chatId)) {
    const call = sessionData.calls.get(chatId);
    call.stream.destroy();
    sessionData.calls.delete(chatId);
  }
  return true;
}

module.exports = {
  createSession,
  playAudio,
  controlPlayback,
  endSession,
};
