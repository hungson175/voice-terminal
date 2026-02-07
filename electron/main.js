const { ipcMain, session } = require("electron");
const { menubar } = require("menubar");
const path = require("path");
const fs = require("fs");

const kittyService = require("./kitty-service");
const llmService = require("./llm-service");

// Load config
const configPath = path.join(__dirname, "..", "config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

// Load .env file
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
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

const iconPath = path.join(__dirname, "..", "assets", "mic-iconTemplate.png");
const activeIconPath = path.join(
  __dirname,
  "..",
  "assets",
  "mic-activeTemplate.png"
);

const mb = menubar({
  index: `file://${path.join(__dirname, "..", "ui", "index.html")}`,
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

// Open DevTools for debugging (remove later)
mb.on("after-create-window", () => {
  mb.window.webContents.openDevTools({ mode: "detach" });
});

// Toggle tray icon when mic state changes
ipcMain.on("mic-state", (_event, isActive) => {
  const icon = isActive ? activeIconPath : iconPath;
  mb.tray.setImage(icon);
});

// Provide config to renderer
ipcMain.handle("get-config", async () => config);

// Real: list Kitty terminal windows
ipcMain.handle("list-terminals", async () => {
  try {
    return await kittyService.listTerminals();
  } catch (err) {
    console.error("Failed to list terminals:", err.message);
    return [];
  }
});

// Real: send corrected command to Kitty
ipcMain.handle("send-command", async (_event, { terminalId, command }) => {
  try {
    // terminalId format: "unix:/tmp/mykitty-PID::windowId"
    const [socket, windowId] = terminalId.split("::");
    await kittyService.sendCommand(socket, windowId, command);
    console.log(`[kitty] Sent to window ${windowId}: ${command}`);
    return { success: true };
  } catch (err) {
    console.error("Failed to send command:", err.message);
    return { success: false, error: err.message };
  }
});

// Real: get terminal context for LLM disambiguation
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

// Real: correct transcript via LLM
ipcMain.handle(
  "correct-transcript",
  async (_event, { transcript, terminalContext }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      throw new Error("XAI_API_KEY not set in .env");
    }
    return await llmService.correctTranscript(
      transcript,
      terminalContext,
      apiKey,
      config.llm
    );
  }
);

// Provide Soniox API key to renderer (for direct WebSocket)
ipcMain.handle("get-soniox-key", async () => {
  return process.env.SONIOX_API_KEY || "";
});
