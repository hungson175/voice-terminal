const { app, ipcMain, session } = require("electron");
const { menubar } = require("menubar");
const path = require("path");
const fs = require("fs");

const kittyService = require("./kitty-service");
const llmService = require("./llm-service");
const credentials = require("./credentials");

// --- PATH fix for packaged app (Finder doesn't inherit shell PATH) ---
if (app.isPackaged) {
  const extraPaths = [
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/Applications/kitty.app/Contents/MacOS",
  ];
  process.env.PATH = `${process.env.PATH}:${extraPaths.join(":")}`;
}

// --- Config path: extraResources when packaged, project root in dev ---
const configPath = app.isPackaged
  ? path.join(process.resourcesPath, "config.json")
  : path.join(__dirname, "..", "config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

// --- Load credentials (Keychain) or .env fallback for dev ---
function loadApiKeys() {
  if (credentials.hasCredentials()) {
    const creds = credentials.getCredentials();
    if (creds.xaiKey) process.env.XAI_API_KEY = creds.xaiKey;
    if (creds.sonioxKey) process.env.SONIOX_API_KEY = creds.sonioxKey;
    if (creds.xaiKey && creds.sonioxKey) return;
  }
  // Dev fallback: .env file
  const envPath = app.isPackaged
    ? null
    : path.join(__dirname, "..", ".env");
  if (envPath && fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx);
          const value = trimmed.slice(eqIdx + 1);
          process.env[key] = value;
        }
      }
    }
  }
}

loadApiKeys();

// --- Determine which page to show ---
function getStartUrl() {
  const needsSetup =
    !credentials.hasCredentials() && !process.env.XAI_API_KEY;
  const page = needsSetup ? "setup.html" : "index.html";
  return `file://${path.join(__dirname, "..", "ui", page)}`;
}

const iconPath = path.join(__dirname, "..", "assets", "mic-iconTemplate.png");
const activeIconPath = path.join(
  __dirname,
  "..",
  "assets",
  "mic-activeTemplate.png"
);

const mb = menubar({
  index: getStartUrl(),
  icon: iconPath,
  preloadWindow: true,
  browserWindow: {
    width: 360,
    height: 560,
    resizable: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  },
});

mb.on("ready", () => {
  console.log("Voice Terminal menubar ready");

  // Auto-grant microphone permission
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      if (permission === "media") {
        callback(true);
      } else {
        callback(false);
      }
    }
  );
});

// DevTools only in dev mode
mb.on("after-create-window", () => {
  if (!app.isPackaged) {
    mb.window.webContents.openDevTools({ mode: "detach" });
  }
});

// --- IPC: Save credentials from setup page, then reload to main UI ---
ipcMain.handle("save-credentials", async (_event, { xaiKey, sonioxKey }) => {
  credentials.saveCredentials(xaiKey, sonioxKey);
  // Set env vars immediately so the current session works
  process.env.XAI_API_KEY = xaiKey;
  process.env.SONIOX_API_KEY = sonioxKey;
  // Reload window to main UI
  mb.window.loadURL(
    `file://${path.join(__dirname, "..", "ui", "index.html")}`
  );
});

// --- IPC: Reset credentials, go back to setup ---
ipcMain.handle("reset-credentials", async () => {
  credentials.clearCredentials();
  delete process.env.XAI_API_KEY;
  delete process.env.SONIOX_API_KEY;
  mb.window.loadURL(
    `file://${path.join(__dirname, "..", "ui", "setup.html")}`
  );
});

// --- IPC: Quit app ---
ipcMain.on("quit-app", () => {
  app.quit();
});

// Toggle tray icon when mic state changes
ipcMain.on("mic-state", (_event, isActive) => {
  const icon = isActive ? activeIconPath : iconPath;
  mb.tray.setImage(icon);
});

// Provide config to renderer
ipcMain.handle("get-config", async () => config);

// List Kitty terminal windows
ipcMain.handle("list-terminals", async () => {
  try {
    return await kittyService.listTerminals();
  } catch (err) {
    console.error("Failed to list terminals:", err.message);
    return [];
  }
});

// Send corrected command to Kitty
ipcMain.handle("send-command", async (_event, { terminalId, command }) => {
  try {
    const [socket, windowId] = terminalId.split("::");
    await kittyService.sendCommand(socket, windowId, command);
    console.log(`[kitty] Sent to window ${windowId}: ${command}`);
    return { success: true };
  } catch (err) {
    console.error("Failed to send command:", err.message);
    return { success: false, error: err.message };
  }
});

// Get terminal context for LLM disambiguation
ipcMain.handle("get-terminal-context", async (_event, terminalId) => {
  try {
    const [socket, windowId] = terminalId.split("::");
    const lines = config.voice?.context_lines || 100;
    return await kittyService.getContext(socket, windowId, lines);
  } catch (err) {
    console.error("Failed to get context:", err.message);
    return "";
  }
});

// Get terminal preview (last 20 lines for dropdown)
ipcMain.handle("get-terminal-preview", async (_event, terminalId) => {
  try {
    const [socket, windowId] = terminalId.split("::");
    return await kittyService.getContext(socket, windowId, 20);
  } catch (err) {
    console.error("Failed to get preview:", err.message);
    return "";
  }
});

// Correct transcript via LLM
ipcMain.handle(
  "correct-transcript",
  async (_event, { transcript, terminalContext }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      throw new Error("XAI_API_KEY not set — run setup or add .env");
    }
    return await llmService.correctTranscript(
      transcript,
      terminalContext,
      apiKey,
      config.llm
    );
  }
);

// Provide Soniox API key to renderer
ipcMain.handle("get-soniox-key", async () => {
  return process.env.SONIOX_API_KEY || "";
});
