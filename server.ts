import express from "express";
import path from "path";
import fs from "fs";
import { spawn, ChildProcess } from "child_process";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const BOT_DIR = path.join(__dirname, "bot_engine");
const ACCOUNTS_FILE = path.join(BOT_DIR, "accounts.json");
const DEVICES_FILE = path.join(BOT_DIR, "devices.json");
const TOKEN_CACHE_FILE = path.join(BOT_DIR, "token_cache.json");
const CONFIG_FILE = path.join(__dirname, "bot_config.json");
const PERSISTENT_BACKUP = path.join(__dirname, "persistent_user_accounts.json");

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// State
interface LogEntry {
  id: number;
  time: string;
  level: "info" | "success" | "warning" | "error";
  message: string;
  source: "bot" | "guild" | "system";
}

let logCounter = 1;
const logs: LogEntry[] = [];
const MAX_LOGS = 500;

function addLog(message: string, level: LogEntry["level"] = "info", source: LogEntry["source"] = "system") {
  const now = new Date();
  const timeStr = now.toTimeString().split(" ")[0];
  const entry: LogEntry = {
    id: logCounter++,
    time: timeStr,
    level,
    message,
    source,
  };
  logs.push(entry);
  if (logs.length > MAX_LOGS) {
    logs.shift();
  }
  broadcastLog(entry);
}

// SSE Clients for real-time logs & events
const sseClients = new Set<express.Response>();

function broadcastLog(log: LogEntry) {
  const data = `data: ${JSON.stringify(log)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(data);
    } catch {
      sseClients.delete(client);
    }
  }
}

function broadcastAccountsUpdated() {
  const eventData = `data: ${JSON.stringify({ type: "accounts_updated", timestamp: Date.now() })}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(eventData);
    } catch {
      sseClients.delete(client);
    }
  }
}

// Child Process Manager & Live Tracker State
let botProcess: ChildProcess | null = null;
let botMode: "app" | "main" | "idle" = "idle";
let botStartTime: number = 0;
let guildProcess: ChildProcess | null = null;

let lastBotAction = "সিস্টেম প্রস্তুত (Standby)";
let isGuestGenerating = false;
let genProgressMsg = "";
let latestJoinWarning = "";

// Initial log
addLog("FF Guild Glory Suite Web Engine initialized.", "success", "system");

// Automatic file recovery and fallback
function ensureBotEngineFiles() {
  if (!fs.existsSync(BOT_DIR)) {
    fs.mkdirSync(BOT_DIR, { recursive: true });
  }

  const appPyPath = path.join(BOT_DIR, "app.py");
  const fallbackSource = path.join(__dirname, "ff_guild_bot", "FF-GUILD-BOT-main");

  if (!fs.existsSync(appPyPath) && fs.existsSync(fallbackSource)) {
    try {
      const files = fs.readdirSync(fallbackSource);
      for (const file of files) {
        const src = path.join(fallbackSource, file);
        const dest = path.join(BOT_DIR, file);
        if (fs.statSync(src).isDirectory()) {
          fs.cpSync(src, dest, { recursive: true });
        } else {
          fs.copyFileSync(src, dest);
        }
      }
      addLog("Restored all bot engine scripts and assets into bot_engine directory", "info", "system");
    } catch (e: any) {
      addLog(`Failed to copy bot files: ${e.message}`, "error", "system");
    }
  }

  // Ensure accounts.json exists without overwriting user data
  if (!fs.existsSync(ACCOUNTS_FILE)) {
    // If user has a persistent backup, restore from that; otherwise empty array
    if (fs.existsSync(PERSISTENT_BACKUP)) {
      try {
        fs.copyFileSync(PERSISTENT_BACKUP, ACCOUNTS_FILE);
      } catch {
        fs.writeFileSync(ACCOUNTS_FILE, "[]", "utf-8");
      }
    } else {
      fs.writeFileSync(ACCOUNTS_FILE, "[]", "utf-8");
    }
  }

  if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ guild_id: "", region: "BD", password: "FFFZ" }, null, 2), "utf-8");
  }
  if (!fs.existsSync(DEVICES_FILE)) {
    fs.writeFileSync(DEVICES_FILE, "{}", "utf-8");
  }
  if (!fs.existsSync(TOKEN_CACHE_FILE)) {
    fs.writeFileSync(TOKEN_CACHE_FILE, "{}", "utf-8");
  }
}

// Initial ensure on startup
ensureBotEngineFiles();

let pythonDepsVerified = false;
function checkPythonDeps() {
  if (pythonDepsVerified) return;
  const testProc = spawn("python3", ["-c", "import httpx, aiohttp, google_play_scraper; print('OK')"]);
  testProc.on("close", (code) => {
    if (code === 0) {
      pythonDepsVerified = true;
      addLog("Python Free Fire bot runtime dependencies verified.", "success", "system");
    } else {
      addLog("Python packages missing. Auto-installing in background...", "warning", "system");
      const installProc = spawn("python3", [
        "-m", "pip", "install", "--break-system-packages",
        "httpx", "google-play-scraper", "pycryptodome", "protobuf-decoder", "protobuf", "requests", "aiohttp"
      ]);
      installProc.on("close", (c) => {
        if (c === 0) {
          pythonDepsVerified = true;
          addLog("Python bot dependencies installed successfully!", "success", "system");
        } else {
          // If pip itself is missing, run get-pip.py first
          const getPip = spawn("python3", ["get-pip.py", "--break-system-packages"]);
          getPip.on("close", () => {
            const pip2 = spawn("pip", [
              "install", "--break-system-packages",
              "httpx", "google-play-scraper", "pycryptodome", "protobuf-decoder", "protobuf", "requests", "aiohttp"
            ]);
            pip2.on("close", (c2) => {
              if (c2 === 0) {
                pythonDepsVerified = true;
                addLog("Python bot dependencies installed and ready!", "success", "system");
              }
            });
          });
        }
      });
    }
  });
}

checkPythonDeps();

// Log streaming endpoint (SSE)
app.get("/api/logs/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Send recent logs first
  res.write(`data: ${JSON.stringify({ type: "history", logs: logs.slice(-60) })}\n\n`);

  sseClients.add(res);
  req.on("close", () => {
    sseClients.delete(res);
  });
});

app.get("/api/logs", (req, res) => {
  const limit = parseInt(req.query.limit as string) || 100;
  res.json({ logs: logs.slice(-limit) });
});

app.post("/api/logs/clear", (req, res) => {
  logs.length = 0;
  addLog("Logs cleared by user", "info", "system");
  res.json({ success: true });
});

// Bot Control Endpoints
app.get("/api/bot/status", (req, res) => {
  const isRunning = botProcess !== null && !botProcess.killed;
  const uptime = isRunning && botStartTime > 0 ? Math.floor((Date.now() - botStartTime) / 1000) : 0;
  const port = botMode === "main" ? 20333 : 25567;

  res.json({
    isRunning,
    mode: botMode,
    pid: isRunning ? botProcess?.pid : null,
    uptime,
    port,
    guildRunning: Boolean(guildProcess && !(guildProcess as any).killed),
  });
});

app.post("/api/bot/start", async (req, res) => {
  ensureBotEngineFiles();
  const mode = req.body.mode === "main" ? "main" : "app";

  if (botProcess && !botProcess.killed) {
    return res.status(400).json({ error: "Bot is already running", mode: botMode, pid: botProcess.pid });
  }

  const scriptName = mode === "main" ? "main.py" : "app.py";
  const scriptPath = path.join(BOT_DIR, scriptName);

  if (!fs.existsSync(scriptPath)) {
    return res.status(404).json({ error: `Script ${scriptName} not found in ${BOT_DIR}. Auto-sync failed.` });
  }

  addLog(`Starting Free Fire Glory Bot [${scriptName}]...`, "info", "bot");

  try {
    botProcess = spawn("python3", [scriptName], {
      cwd: BOT_DIR,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1",
        PYTHONPATH: BOT_DIR,
      },
    });

    botMode = mode;
    botStartTime = Date.now();

    botProcess.stdout?.on("data", (data) => {
      const text = data.toString();
      const lines = text.split("\n").filter((l: string) => l.trim().length > 0);
      for (const line of lines) {
        let level: LogEntry["level"] = "info";
        if (line.includes("ERROR") || line.includes("[-] ") || line.includes("failed")) level = "error";
        else if (line.includes("WARNING") || line.includes("[!] ") || line.includes("⚠️")) level = "warning";
        else if (line.includes("SUCCESS") || line.includes("[+] ") || line.includes("✅")) level = "success";
        
        if (line.includes("match") || line.includes("Match") || line.includes("game")) {
          lastBotAction = "৪-প্লেয়ার স্কোয়াড ম্যাচ রানিং (Anti-AFK Glory Loop)";
        } else if (line.includes("team") || line.includes("Squad") || line.includes("lobby")) {
          lastBotAction = "স্কোয়াড লবি প্রস্তুত ও ম্যাচমেকিং শুরু";
        } else if (line.includes("login") || line.includes("Login") || line.includes("token")) {
          lastBotAction = "গ্যারেনা সার্ভার অথেন্টিকেশন সম্পন্ন";
        }
        
        addLog(line, level, "bot");
      }
    });

    botProcess.stderr?.on("data", (data) => {
      const text = data.toString();
      const lines = text.split("\n").filter((l: string) => l.trim().length > 0);
      for (const line of lines) {
        addLog(line, "warning", "bot");
      }
    });

    botProcess.on("close", (code) => {
      addLog(`Bot process exited with code ${code}`, code === 0 ? "info" : "warning", "bot");
      botProcess = null;
      botMode = "idle";
      botStartTime = 0;
      lastBotAction = "বট বন্ধ রয়েছে (Standby)";
    });

    botProcess.on("error", (err) => {
      addLog(`Failed to start bot process: ${err.message}`, "error", "bot");
      botProcess = null;
      botMode = "idle";
      botStartTime = 0;
      lastBotAction = "বট শুরু করতে ব্যর্থ";
    });

    res.json({ success: true, message: `Started ${scriptName}`, pid: botProcess.pid, mode });
  } catch (err: any) {
    addLog(`Error spawning bot: ${err.message}`, "error", "bot");
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/bot/stop", (req, res) => {
  if (!botProcess || botProcess.killed) {
    botProcess = null;
    botMode = "idle";
    botStartTime = 0;
    lastBotAction = "বট বন্ধ রয়েছে";
    return res.json({ success: true, message: "Bot was not running" });
  }

  addLog("Stopping Free Fire Glory Bot...", "warning", "bot");
  try {
    botProcess.kill("SIGTERM");
    lastBotAction = "বট বন্ধ করা হচ্ছে...";
    setTimeout(() => {
      if (botProcess && !botProcess.killed) {
        try {
          botProcess.kill("SIGKILL");
        } catch {}
      }
      botProcess = null;
      botMode = "idle";
      botStartTime = 0;
      lastBotAction = "বট বন্ধ রয়েছে (Standby)";
    }, 2000);

    res.json({ success: true, message: "Bot stop signal sent" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/bot/restart", async (req, res) => {
  const currentMode = botMode === "main" ? "main" : "app";
  if (botProcess && !botProcess.killed) {
    botProcess.kill("SIGTERM");
    await new Promise((r) => setTimeout(r, 1500));
    if (botProcess && !botProcess.killed) {
      try {
        botProcess.kill("SIGKILL");
      } catch {}
    }
  }
  botProcess = null;
  botMode = "idle";

  // Re-start
  addLog("Restarting Bot process...", "info", "bot");
  setTimeout(async () => {
    try {
      const scriptName = currentMode === "main" ? "main.py" : "app.py";
      botProcess = spawn("python3", [scriptName], {
        cwd: BOT_DIR,
        env: {
          ...process.env,
          PYTHONUNBUFFERED: "1",
          PYTHONPATH: BOT_DIR,
        },
      });
      botMode = currentMode;
      botStartTime = Date.now();

      botProcess.stdout?.on("data", (data) => {
        const lines = data.toString().split("\n").filter((l: string) => l.trim().length > 0);
        for (const line of lines) {
          if (line.includes("match") || line.includes("Match")) {
            lastBotAction = "ম্যাচ রানিং (গ্লোরি বৃদ্ধি চলছে)";
          }
          addLog(line, "info", "bot");
        }
      });
      botProcess.stderr?.on("data", (data) => {
        const lines = data.toString().split("\n").filter((l: string) => l.trim().length > 0);
        for (const line of lines) {
          addLog(line, "warning", "bot");
        }
      });
      botProcess.on("close", (code) => {
        addLog(`Bot process exited with code ${code}`, "info", "bot");
        botProcess = null;
        botMode = "idle";
        botStartTime = 0;
        lastBotAction = "বট বন্ধ রয়েছে (Standby)";
      });
    } catch (err: any) {
      addLog(`Restart error: ${err.message}`, "error", "bot");
    }
  }, 1000);

  res.json({ success: true, message: "Restart triggered" });
});

// Real-Time Live Bot Activity & Guidance Tracker Endpoint
app.get("/api/bot/live_tracker", (req, res) => {
  const isRunning = botProcess !== null && !botProcess.killed;
  let accountsList: any[] = [];
  try {
    if (fs.existsSync(ACCOUNTS_FILE)) {
      accountsList = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf-8"));
    }
  } catch {}

  const runningCount = isRunning
    ? Math.min(4, Math.max(1, accountsList.length))
    : isGuestGenerating
    ? 4
    : 0;

  // Active squad bots representation
  const activeBots = accountsList.slice(0, 4).map((acc, idx) => ({
    uid: acc.uid || (acc.token ? `tok_${acc.token.slice(0, 8)}` : `Bot_${idx + 1}`),
    name: acc.name || `FFFZ_${acc.uid ? acc.uid.slice(-4) : idx + 1}`,
    role: idx === 0 ? "স্কোয়াড লিডার (Leader)" : `স্কোয়াড মেম্বার #${idx + 1}`,
    status: isRunning
      ? "🟢 সক্রিয় (ম্যাচমেকিং / গ্লোরি সংগ্রহ)"
      : isGuestGenerating
      ? "🟡 গেস্ট আইডি তৈরি হচ্ছে..."
      : "⚪ স্ট্যান্ডবাই (প্রস্তুত)",
    stepNumber: isRunning ? 4 : isGuestGenerating ? 1 : 2,
    stepName: isRunning
      ? "স্টেপ ৪: ম্যাচমেকিং ও গ্লোরি সংগ্রহ"
      : isGuestGenerating
      ? "স্টেপ ১: BD গেস্ট রেজিস্ট্রেশন"
      : "স্টেপ ২: গ্যারেনা অথেন্টিকেশন প্রস্তুত",
    region: acc.region || "BD",
    lastAction: isRunning
      ? lastBotAction
      : isGuestGenerating
      ? genProgressMsg || "গ্যারেনা বাংলাদেশ সার্ভারে আইডি তৈরি হচ্ছে"
      : "বট চালু করার অপেক্ষায় রয়েছে",
  }));

  // Determine current overall pipeline step (1 to 4)
  let stepNumber = 1;
  let stepTitle = "স্টেপ ১: BD গেস্ট অ্যাকাউন্ট প্রস্তুতি";
  let stepDetail = "অ্যাকাউন্ট তৈরি ও গ্যারেনা কনফিগ লোড হচ্ছে।";
  let stepStatus: "idle" | "running" | "completed" | "warning" = "idle";

  if (isGuestGenerating) {
    stepNumber = 1;
    stepTitle = "স্টেপ ১: ৪টি BD গেস্ট বট স্বয়ংক্রিয়ভাবে তৈরি হচ্ছে";
    stepDetail = genProgressMsg || "গ্যারেনা বাংলাদেশ (BD) সার্ভারে গেস্ট ইউজার তৈরি হচ্ছে...";
    stepStatus = "running";
  } else if (isRunning) {
    stepNumber = 4;
    stepTitle = "স্টেপ ৪: ৪-স্কোয়াড অ্যান্টি-এএফকে ম্যাচমেকিং ও গ্লোরি সংগ্রহ";
    stepDetail = lastBotAction || "বটগুলো সফলভাবে ম্যাচমেকিং চালিয়ে গিল্ড গ্লোরি বাড়াচ্ছে।";
    stepStatus = "running";
  } else if (accountsList.length > 0) {
    stepNumber = 2;
    stepTitle = "স্টেপ ২: অ্যাকাউন্ট প্রস্তুত, বট চালু করার অপেক্ষায়";
    stepDetail = `মোট ${accountsList.length}টি অ্যাকাউন্ট সংরক্ষিত আছে। 'বট চালু করুন (Start Bot)' বাটনে চাপ দিন।`;
    stepStatus = "completed";
  }

  // Guidance card data
  let guidanceBadge: "info" | "success" | "warning" | "alert" = "info";
  let guidanceHeadline = "সিস্টেম তথ্য ও লাইভ দিকনির্দেশনা";
  let guidanceMessage = "আপনার ব্রাউজারে রিফ্রেশ দেওয়ার কোনো প্রয়োজন নেই। সব তথ্য স্বয়ংক্রিয়ভাবে প্রতি ২ সেকেন্ডে লাইভ আপডেট হচ্ছে।";
  let checklist = [
    "১-ক্লিক বাটনে ৪টি BD গেস্ট অ্যাকাউন্ট স্বয়ংক্রিয় তৈরি করুন।",
    "গিল্ডে বট যুক্ত করতে 'গিল্ডে বট জয়েন করান' বাটনে চাপ দিন।",
    "'Start Bot' চেপে সার্বক্ষণিক অ্যান্টি-এএফকে গ্লোরি লুপ চালু করুন।",
  ];

  if (latestJoinWarning === "CLAN_FULL") {
    guidanceBadge = "alert";
    guidanceHeadline = "⚠️ সতর্কবার্তা: ফ্রি ফায়ার গিল্ড মেম্বার বা আবেদন ৫০/৫০ ফুল!";
    guidanceMessage = "গ্যারেনা সার্ভার থেকে 'BR_CLAN_CLAN_IS_FULL' এসেছে। আপনার গিল্ডে স্থান খালি না থাকায় বট জয়েন করতে পারছে না।";
    checklist = [
      "১. আপনার গেমে ঢুকে ইন-অ্যাক্টিভ মেম্বারদের Kick করে ৪-৮টি স্লট খালি করুন।",
      "২. গিল্ডের 'Applications' লিস্টে ঢুকে আগের সব পেন্ডিং রিকোয়েস্ট মুছে দিন।",
      "৩. গিল্ড সেটিংসে Level Requirement 'Level 1' এবং Join Mode 'Auto' করে দিন।",
    ];
  } else if (isRunning) {
    guidanceBadge = "success";
    guidanceHeadline = "🟢 স্কোয়াড বট সক্রিয়ভাবে চালু রয়েছে (২৪/৭ গ্লোরি বৃদ্ধি)";
    guidanceMessage = "বট ব্যাকএন্ডে ৪-প্লেয়ার স্কোয়াড গঠন করে অ্যান্টি-এএফকে ম্যাচমেকিং করছে। আপনি অন্য অ্যাপ বা ট্যাবে গেলেও বট অবিরাম কাজ করবে।";
    checklist = [
      "অটো-রিফ্রেশ অন আছে, কোনো রিলোড দেওয়ার দরকার নেই।",
      "টার্মিনাল ট্যাবে গিয়ে বট লগের লাইভ প্যাকেট দেখতে পারেন।",
      "প্রয়োজনমতো 'Stop Bot' চেপে যেকোনো সময় বন্ধ করা যাবে।",
    ];
  } else if (accountsList.length === 0) {
    guidanceBadge = "info";
    guidanceHeadline = "ℹ️ বট শুরু করার প্রথম ধাপ";
    guidanceMessage = "বর্তমানে সিস্টেমে কোনো বট আইডি নেই। নিচে '১-ক্লিকে ৪টি BD গেস্ট বট তৈরি করুন' বাটনে চাপ দিন, কোনো পাসওয়ার্ড লিখতে হবে না।";
    checklist = [
      "১. '১-ক্লিক ৪টি BD গেস্ট বট তৈরি' বাটনে চাপ দিন।",
      "২. ৫ সেকেন্ড অপেক্ষা করুন, আইডি স্বয়ংক্রিয়ভাবে ডিসপ্লেতে যুক্ত হবে।",
      "৩. এরপর 'গিল্ডে বট জয়েন করান' চেপে 'Start Bot' চাপুন।",
    ];
  }

  res.json({
    isRunning,
    mode: botMode,
    runningCount,
    totalAccounts: accountsList.length,
    activeBots,
    currentStep: {
      stepNumber,
      title: stepTitle,
      detail: stepDetail,
      status: stepStatus,
    },
    guidance: {
      statusType: guidanceBadge,
      title: guidanceHeadline,
      message: guidanceMessage,
      checklist,
    },
    isGenerating: isGuestGenerating,
    lastUpdated: Date.now(),
  });
});

// Proxy stats directly from python aiohttp server if available, else generate from accounts.json
app.get("/api/bot/stats", async (req, res) => {
  const targetPort = botMode === "main" ? 20333 : 25567;
  const isRunning = botProcess !== null && !botProcess.killed;

  if (isRunning) {
    try {
      const resp = await fetch(`http://127.0.0.1:${targetPort}/api/stats`, {
        signal: AbortSignal.timeout(1500),
      });
      if (resp.ok) {
        const data = await resp.json();
        return res.json({ ...data, bot_running: true });
      }
    } catch {
      // Python server might be starting up or in game loop
    }
  }

  // Fallback: Read accounts.json to provide live accounts list even when bot is stopped
  let accountsList: any[] = [];
  try {
    if (fs.existsSync(ACCOUNTS_FILE)) {
      const raw = fs.readFileSync(ACCOUNTS_FILE, "utf-8");
      accountsList = JSON.parse(raw);
    }
  } catch {}

  const formattedAccounts = accountsList.map((acc, idx) => ({
    uid: acc.uid || (acc.token ? `tok_${acc.token.slice(0, 8)}` : `acc_${idx + 1}`),
    nickname: acc.name || `FFFZ_${acc.uid ? acc.uid.slice(-4) : idx + 1}`,
    region: acc.region || "BD",
    level: acc.level || 1,
    exp: acc.exp || 0,
    gained_exp: 0,
    matches: 0,
    status: isRunning ? "STARTING" : "OFFLINE",
    is_paused: false,
    auth_uid: acc.account_id || acc.uid,
    created_at: acc.created_at,
  }));

  const uptime = isRunning && botStartTime > 0 ? Math.floor((Date.now() - botStartTime) / 1000) : 0;

  res.json({
    total_accounts: formattedAccounts.length,
    active_accounts: formattedAccounts.length,
    total_matches: 0,
    total_matches_started: 0,
    total_active_matches: 0,
    total_gained_exp: 0,
    uptime,
    exp_per_hour: 0,
    matches_per_hour: 0,
    accounts: formattedAccounts,
    bot_running: isRunning,
    creating: false,
    create_progress: [],
    team_size: formattedAccounts.length > 0 ? Math.min(4, formattedAccounts.length) : 0,
  });
});

// App Configuration (Guild Code / ID, Region)
app.get("/api/config", (req, res) => {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      return res.json({ guild_id: "", region: "BD", password: "FFFZ" });
    }
    const data = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
    res.json(data);
  } catch (err: any) {
    res.json({ guild_id: "", region: "BD", password: "FFFZ" });
  }
});

app.post("/api/config", (req, res) => {
  try {
    const { guild_id, region, password } = req.body;
    const current = fs.existsSync(CONFIG_FILE) ? JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8")) : {};
    const updated = {
      guild_id: guild_id !== undefined ? String(guild_id).trim() : current.guild_id || "",
      region: region !== undefined ? String(region).toUpperCase().trim() : current.region || "BD",
      password: password !== undefined ? String(password).trim() : current.password || "FFFZ",
      updated_at: new Date().toISOString(),
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), "utf-8");

    // Also update all existing accounts to use this new guild_id and region
    if (fs.existsSync(ACCOUNTS_FILE)) {
      try {
        const accounts = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf-8"));
        if (Array.isArray(accounts) && accounts.length > 0) {
          const modified = accounts.map((acc: any) => ({
            ...acc,
            clan_id: updated.guild_id || acc.clan_id || "",
            region: updated.region || acc.region || "BD",
          }));
          fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(modified, null, 2), "utf-8");
          fs.writeFileSync(PERSISTENT_BACKUP, JSON.stringify(modified, null, 2), "utf-8");
        }
      } catch {}
    }

    addLog(`Config saved: Guild ID [${updated.guild_id || "None"}], Region [${updated.region}]`, "success", "system");
    res.json({ success: true, config: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// Accounts JSON direct management
app.get("/api/accounts", (req, res) => {
  try {
    if (!fs.existsSync(ACCOUNTS_FILE)) {
      return res.json({ accounts: [] });
    }
    const content = fs.readFileSync(ACCOUNTS_FILE, "utf-8");
    const parsed = JSON.parse(content);
    res.json({ accounts: Array.isArray(parsed) ? parsed : parsed.accounts || [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/accounts", (req, res) => {
  try {
    const { accounts } = req.body;
    if (!Array.isArray(accounts)) {
      return res.status(400).json({ error: "Accounts must be an array" });
    }
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2), "utf-8");
    fs.writeFileSync(PERSISTENT_BACKUP, JSON.stringify(accounts, null, 2), "utf-8");
    broadcastAccountsUpdated();
    addLog(`Saved ${accounts.length} real accounts to accounts.json & permanent backup`, "success", "system");
    res.json({ success: true, count: accounts.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Clear all accounts (removes dummy/demo accounts completely)
app.post("/api/accounts/clear_all", (req, res) => {
  try {
    fs.writeFileSync(ACCOUNTS_FILE, "[]", "utf-8");
    fs.writeFileSync(PERSISTENT_BACKUP, "[]", "utf-8");
    fs.writeFileSync(TOKEN_CACHE_FILE, "{}", "utf-8");
    broadcastAccountsUpdated();
    addLog("All accounts cleared. System reset to 100% clean state.", "warning", "system");
    res.json({ success: true, message: "Accounts cleared" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk import raw text or json
app.post("/api/accounts/bulk_import", (req, res) => {
  try {
    const { text, default_region, default_clan_id } = req.body;
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Text is required" });
    }

    let existing: any[] = [];
    if (fs.existsSync(ACCOUNTS_FILE)) {
      try {
        existing = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf-8"));
      } catch {}
    }

    // Try parsing as JSON first
    let importedCount = 0;
    const trimmed = text.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item.uid || item.token) {
              existing = existing.filter((a) => (item.uid && a.uid !== item.uid) || (item.token && a.token !== item.token));
              existing.push(item);
              importedCount++;
            }
          }
        }
      } catch {}
    }

    // Otherwise parse line by line (UID:Password or UID Password or Token)
    if (importedCount === 0) {
      const lines = trimmed.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
      for (const line of lines) {
        if (line.startsWith("#") || line.startsWith("//")) continue;

        let uid = "";
        let password = "";
        let token = "";

        if (line.includes(":") || line.includes("|") || line.includes(",")) {
          const parts = line.split(/[:|,]/).map((p) => p.trim());
          uid = parts[0];
          password = parts[1] || "";
        } else if (line.includes("\t") || line.includes(" ")) {
          const parts = line.split(/[\s\t]+/).map((p) => p.trim());
          uid = parts[0];
          password = parts[1] || "";
        } else if (line.length > 50) {
          // Likely an access token or long hash
          token = line;
        } else {
          uid = line;
        }

        if (token) {
          existing = existing.filter((a) => a.token !== token);
          existing.push({
            token,
            name: `Token_${token.slice(0, 6)}`,
            region: default_region || "BD",
            clan_id: default_clan_id || "",
            created_at: new Date().toISOString(),
          });
          importedCount++;
        } else if (uid) {
          existing = existing.filter((a) => String(a.uid) !== String(uid));
          existing.push({
            uid: String(uid).trim(),
            password: password ? String(password).trim() : "FFFZ",
            name: `FFFZ_${String(uid).slice(-4)}`,
            region: default_region || "BD",
            clan_id: default_clan_id || "",
            created_at: new Date().toISOString(),
          });
          importedCount++;
        }
      }
    }

    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(existing, null, 2), "utf-8");
    fs.writeFileSync(PERSISTENT_BACKUP, JSON.stringify(existing, null, 2), "utf-8");
    broadcastAccountsUpdated();
    addLog(`Bulk imported ${importedCount} real accounts! Total loaded: ${existing.length}`, "success", "system");
    res.json({ success: true, imported: importedCount, total: existing.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/accounts/add", async (req, res) => {
  try {
    const { uid, password, token, name, region, clan_id } = req.body;
    let existing: any[] = [];
    if (fs.existsSync(ACCOUNTS_FILE)) {
      try {
        existing = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf-8"));
      } catch {}
    }

    if (token) {
      existing = existing.filter((a) => a.token !== token);
      existing.push({ token, name: name || "Token Account", region: region || "BD", created_at: new Date().toISOString() });
      addLog(`Added token account (${token.slice(0, 12)}...)`, "success", "system");
    } else if (uid && password) {
      existing = existing.filter((a) => String(a.uid) !== String(uid));
      existing.push({
        uid: String(uid).trim(),
        password: String(password).trim(),
        name: name || `FFFZ_${String(uid).slice(-4)}`,
        region: region || "BD",
        clan_id: clan_id || "",
        created_at: new Date().toISOString(),
      });
      addLog(`Added UID account: ${uid}`, "success", "system");
    } else {
      return res.status(400).json({ error: "Either token or (uid + password) required" });
    }

    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(existing, null, 2), "utf-8");
    fs.writeFileSync(PERSISTENT_BACKUP, JSON.stringify(existing, null, 2), "utf-8");
    broadcastAccountsUpdated();

    // Also forward to bot if running
    if (botProcess && !botProcess.killed) {
      const port = botMode === "main" ? 20333 : 25567;
      fetch(`http://127.0.0.1:${port}/api/account/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      }).catch(() => {});
    }

    res.json({ success: true, total: existing.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/accounts/delete", async (req, res) => {
  try {
    const { uid, token, index } = req.body;
    if (!fs.existsSync(ACCOUNTS_FILE)) {
      return res.json({ success: true, remaining: 0, accounts: [] });
    }
    let existing: any[] = [];
    try {
      existing = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf-8"));
    } catch {
      existing = [];
    }
    const beforeCount = existing.length;

    if (index !== undefined && typeof index === "number" && index >= 0 && index < existing.length) {
      existing.splice(index, 1);
    } else {
      if (uid) {
        const target = String(uid).trim();
        existing = existing.filter((a: any) => {
          const aUid = String(a.uid || "").trim();
          const aAcc = String(a.account_id || "").trim();
          return aUid !== target && aAcc !== target;
        });
      }
      if (token) {
        const targetTok = String(token).trim();
        existing = existing.filter((a: any) => String(a.token || "").trim() !== targetTok);
      }
    }

    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(existing, null, 2), "utf-8");
    fs.writeFileSync(PERSISTENT_BACKUP, JSON.stringify(existing, null, 2), "utf-8");
    broadcastAccountsUpdated();
    addLog(`Account deleted successfully. Remaining accounts: ${existing.length}`, "warning", "system");

    // Forward to running bot
    if (botProcess && !botProcess.killed) {
      const port = botMode === "main" ? 20333 : 25567;
      fetch(`http://127.0.0.1:${port}/api/account/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      }).catch(() => {});
    }

    res.json({ success: true, deleted: beforeCount - existing.length, remaining: existing.length, accounts: existing });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Guild Join Service Execution
app.post("/api/guild/join", async (req, res) => {
  const { guild_id, api_base, test_single, single_uid } = req.body;
  if (!guild_id) {
    return res.status(400).json({ error: "Guild ID is required" });
  }

  let accounts: any[] = [];
  try {
    if (fs.existsSync(ACCOUNTS_FILE)) {
      accounts = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf-8"));
    }
  } catch (err: any) {
    return res.status(500).json({ error: `Failed to read accounts: ${err.message}` });
  }

  if (!accounts || accounts.length === 0) {
    addLog("No accounts found in accounts.json for guild join", "error", "guild");
    return res.status(400).json({ error: "No accounts found in accounts.json" });
  }

  if (single_uid) {
    accounts = accounts.filter((a) => String(a.uid) === String(single_uid));
  } else if (test_single && accounts.length > 0) {
    accounts = [accounts[0]];
  }

  addLog(`Starting Guild Join Bot for Guild ID: ${guild_id} (${accounts.length} account${accounts.length > 1 ? "s" : ""})...`, "info", "guild");

  const endpoint = api_base || process.env.FFFZ_GUILD_API || "https://danger-guild-management-web.vercel.app/join";
  const results: any[] = [];

  // Asynchronously perform joins and log progress
  (async () => {
    for (let i = 0; i < accounts.length; i++) {
      const acc = accounts[i];
      const uid = acc.uid;
      const pwd = acc.password;

      if (!uid || !pwd) {
        addLog(`[${i + 1}/${accounts.length}] Skipped ${acc.name || "Unknown"} (missing UID or password)`, "warning", "guild");
        results.push({ uid, success: false, message: "Missing UID or password" });
        continue;
      }

      const maskedPw = pwd.length > 4 ? pwd.slice(0, 2) + "****" + pwd.slice(-2) : "****";
      addLog(`[${i + 1}/${accounts.length}] Joining UID: ${uid} (PW: ${maskedPw})...`, "info", "guild");

      try {
        const url = `${endpoint}?guild_id=${encodeURIComponent(guild_id)}&uid=${encodeURIComponent(uid)}&password=${encodeURIComponent(pwd)}`;
        const resp = await fetch(url, { signal: AbortSignal.timeout(12000) });
        const text = await resp.text();

        let parsedResp: any = text;
        try {
          parsedResp = JSON.parse(text);
        } catch {}

        if (resp.ok) {
          addLog(`✅ UID ${uid} successfully joined Guild ${guild_id}! Result: ${typeof parsedResp === "object" ? JSON.stringify(parsedResp) : parsedResp}`, "success", "guild");
          results.push({ uid, success: true, message: parsedResp });
        } else {
          addLog(`❌ UID ${uid} join failed: HTTP ${resp.status} - ${text}`, "error", "guild");
          if (text.includes("BR_CLAN_CLAN_IS_FULL")) {
            addLog(`⚠️ গিল্ড ফুল এরর (BR_CLAN_CLAN_IS_FULL): গিল্ড ${guild_id}-এ মেম্বার ক্যাপাসিটি পূর্ণ অথবা পেন্ডিং আবেদন তালিকা (Pending List) ৫০/৫০ ফুল!`, "warning", "guild");
            addLog(`👉 সমাধান: আপনার Free Fire গেমে ঢুকে: ১) কিছু নিষ্ক্রিয় মেম্বার কিক (Kick) করে ৪-৮টি স্লট খালি করুন। ২) গিল্ডের 'Applications' লিস্ট থেকে পেন্ডিং রিকোয়েস্ট ক্লিয়ার করুন। ৩) গিল্ড সেটিংসে Level Requirement 'Level 1' এবং Join Mode 'Auto' করুন।`, "info", "guild");
          } else if (text.includes("BR_CLAN_LEVEL_LIMIT") || text.includes("LEVEL")) {
            addLog(`⚠️ লেভেল এরর: বট আইডিগুলো লেভেল ১। আপনার ফ্রি ফায়ার গিল্ড সেটিংসে গিয়ে জয়েন করার নুন্যতম লেভেল 'Level 1' বা 'Default' করে দিন।`, "warning", "guild");
          } else if (text.includes("OAuth failed") || text.includes("invalid UID or password")) {
            addLog(`💡 নির্দেশিকা: UID ${uid}-এর পাসওয়ার্ড গ্যারেনায় মিলেনি। গেমের পার্সোনাল আইডি দিয়ে পাসওয়ার্ড 'FFFZ' দিলে গ্যারেনা গ্রহণ করে না। 'গেস্ট জেনারেটর' দিয়ে নতুন আইডি বানান।`, "warning", "guild");
          } else if (text.includes("ALREADY_IN_CLAN")) {
            addLog(`ℹ️ UID ${uid} ইতিমধ্যে একটি গিল্ডে যুক্ত আছে।`, "info", "guild");
          }
          results.push({ uid, success: false, message: text });
        }
      } catch (e: any) {
        addLog(`❌ UID ${uid} request error: ${e.message}`, "error", "guild");
        results.push({ uid, success: false, message: e.message });
      }

      await new Promise((r) => setTimeout(r, 600));
    }

    const successes = results.filter((r) => r.success).length;
    addLog(`Guild Join Complete: ${successes}/${accounts.length} joined successfully.`, "success", "guild");
  })();

  res.json({
    success: true,
    message: `Started join process for ${accounts.length} accounts to Guild ${guild_id}`,
    accountsCount: accounts.length,
    guild_id,
  });
});

// 1-Click Guest Account Generation Endpoint (No Password Required)
app.post("/api/accounts/generate", async (req, res) => {
  let { region, clan_id, count, password } = req.body;

  // Auto-detect saved guild ID if none provided
  if (!clan_id) {
    if (fs.existsSync(CONFIG_FILE)) {
      try {
        const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
        clan_id = cfg.guild_id;
      } catch {}
    }
  }

  const finalClanId = String(clan_id || "3105331459").trim();
  const finalRegion = String(region || "BD").toUpperCase().trim();
  const numCount = Math.max(1, Math.min(8, parseInt(count) || 4));
  // Auto-generate strong unique compliant guest password if none provided
  const finalPassword = password && String(password).trim()
    ? String(password).trim()
    : "GUEST_" + Math.random().toString(36).substring(2, 7).toUpperCase() + "BD";

  addLog(`[1-Click Gen] Generating ${numCount} BD Guest Bots for Guild [${finalClanId}] (Auto password)...`, "info", "system");

  // If app.py is already running, call its native api_create_team
  if (botProcess && botMode === "app" && !botProcess.killed) {
    try {
      const resp = await fetch("http://127.0.0.1:25567/api/create_team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          region: finalRegion,
          clan_id: finalClanId,
          count: numCount,
          password: finalPassword,
        }),
      });
      const data = await resp.json();
      broadcastAccountsUpdated();
      return res.json({ ...data, auto_password: true, region: finalRegion, clan_id: finalClanId });
    } catch (err: any) {
      addLog(`Failed to communicate with running bot: ${err.message}`, "warning", "system");
    }
  }

  isGuestGenerating = true;
  genProgressMsg = `১-ক্লিকে ${numCount}টি BD গেস্ট বট তৈরি শুরু হয়েছে...`;

  // If bot is not running or on main.py, spawn a python worker to register accounts
  try {
    const pythonCode = `
import asyncio, json, sys, os
sys.path.insert(0, "${BOT_DIR}")
import app

async def run_gen():
    await app.create_four_accounts("${finalRegion}", "${finalClanId}", ${numCount}, "${finalPassword}")

asyncio.run(run_gen())
`;
    const genProcess = spawn("python3", ["-c", pythonCode], {
      cwd: BOT_DIR,
      env: { ...process.env, PYTHONUNBUFFERED: "1", PYTHONPATH: BOT_DIR },
    });

    genProcess.stdout?.on("data", (d) => {
      const lines = d.toString().split("\n").filter((l: string) => l.trim().length > 0);
      for (const line of lines) {
        genProgressMsg = line;
        addLog(line, "info", "system");
      }
    });

    genProcess.stderr?.on("data", (d) => {
      const lines = d.toString().split("\n").filter((l: string) => l.trim().length > 0);
      for (const line of lines) {
        addLog(line, "warning", "system");
      }
    });

    genProcess.on("close", (code) => {
      isGuestGenerating = false;
      try {
        if (fs.existsSync(ACCOUNTS_FILE)) {
          const accs = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf-8"));
          fs.writeFileSync(PERSISTENT_BACKUP, JSON.stringify(accs, null, 2), "utf-8");
          broadcastAccountsUpdated();
          addLog(`✅ 1-Click Gen Completed: ${accs.length} accounts saved and backed up.`, "success", "system");
        }
      } catch {}
      broadcastAccountsUpdated();
      addLog(`Guest Account Generation finished (exit code ${code})`, code === 0 ? "success" : "warning", "system");
    });

    res.json({
      ok: true,
      msg: `১-ক্লিকে ${numCount}টি BD গেস্ট বট তৈরি শুরু হয়েছে। টার্মিনালে লাইভ প্রগ্রেস দেখুন।`,
      region: finalRegion,
      clan_id: finalClanId,
      auto_password: true
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Cache and Devices Management
app.get("/api/token_cache", (req, res) => {
  try {
    if (!fs.existsSync(TOKEN_CACHE_FILE)) return res.json({ cache: {} });
    const data = JSON.parse(fs.readFileSync(TOKEN_CACHE_FILE, "utf-8"));
    res.json({ cache: data, count: Object.keys(data).length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/token_cache/clear", (req, res) => {
  try {
    fs.writeFileSync(TOKEN_CACHE_FILE, "{}", "utf-8");
    addLog("token_cache.json cleared", "warning", "system");
    res.json({ success: true, message: "Token cache cleared" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/devices", (req, res) => {
  try {
    if (!fs.existsSync(DEVICES_FILE)) return res.json({ devices: {} });
    const data = JSON.parse(fs.readFileSync(DEVICES_FILE, "utf-8"));
    res.json({ devices: data, count: Object.keys(data).length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/devices/clear", (req, res) => {
  try {
    fs.writeFileSync(DEVICES_FILE, "{}", "utf-8");
    addLog("devices.json reset", "warning", "system");
    res.json({ success: true, message: "Device profiles reset" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Download full project zip
app.get("/api/download_project", async (req, res) => {
  try {
    const zipPath = path.join(__dirname, "FF_GUILD_BOT_UPDATED.zip");
    // Use python zipfile to bundle the bot_engine directory
    const pythonZip = `
import zipfile, os
zip_path = "${zipPath}"
with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
    for root, dirs, files in os.walk("${BOT_DIR}"):
        if '__pycache__' in root:
            continue
        for file in files:
            full_path = os.path.join(root, file)
            arcname = os.path.relpath(full_path, "${BOT_DIR}")
            zipf.write(full_path, arcname)
print("ZIP_CREATED")
`;
    const p = spawn("python3", ["-c", pythonZip], { cwd: BOT_DIR });
    p.on("close", (code) => {
      if (code === 0 && fs.existsSync(zipPath)) {
        res.download(zipPath, "FF_GUILD_BOT_SUITE.zip", (err) => {
          try {
            fs.unlinkSync(zipPath);
          } catch {}
        });
      } else {
        res.status(500).json({ error: "Failed to create zip" });
      }
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Vite Integration
async function startServer() {
  const isProd = process.env.NODE_ENV === "production";

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[FF GUILD BOT SUITE] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
