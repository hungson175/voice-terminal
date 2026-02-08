/**
 * Kitty terminal service — auto-detect windows, send commands, read text.
 *
 * Discovers kitty instances by scanning /tmp/mykitty-* sockets,
 * then uses `kitty @` remote control for all operations.
 */

const { execFile, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

/**
 * Discover all kitty sockets on the system.
 * Looks for /tmp/mykitty-* socket files.
 */
function discoverSockets() {
  const tmpDir = "/tmp";
  try {
    return fs
      .readdirSync(tmpDir)
      .filter((f) => f.startsWith("mykitty-"))
      .map((f) => `unix:${path.join(tmpDir, f)}`)
      .filter((socketPath) => {
        // Verify socket file still exists
        const filePath = socketPath.replace("unix:", "");
        try {
          const stat = fs.statSync(filePath);
          return stat.isSocket();
        } catch {
          return false;
        }
      });
  } catch {
    return [];
  }
}

/**
 * Run a kitty @ command and return output.
 * When stdinData is provided, pipes it via stdin (reliable for long text).
 */
function kittyCommand(socketPath, args, stdinData) {
  return new Promise((resolve, reject) => {
    if (stdinData != null) {
      // Use spawn + stdin for long text (avoids arg length limits & timeout)
      const timeout = Math.max(10000, stdinData.length * 20);
      const child = spawn("kitty", ["@", "--to", socketPath, ...args]);
      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error(`kitty @ ${args[0]} timed out after ${timeout}ms`));
      }, timeout);
      child.stdout.on("data", (d) => (stdout += d));
      child.stderr.on("data", (d) => (stderr += d));
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          reject(new Error(`kitty @ ${args[0]} failed: ${stderr}`));
        } else {
          resolve(stdout);
        }
      });
      child.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
      child.stdin.write(stdinData);
      child.stdin.end();
    } else {
      execFile(
        "kitty",
        ["@", "--to", socketPath, ...args],
        { timeout: 5000 },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(`kitty @ ${args[0]} failed: ${stderr || error.message}`));
            return;
          }
          resolve(stdout);
        }
      );
    }
  });
}

/**
 * List all kitty windows across all discovered instances.
 * Returns flat array of { id, title, cwd, socket, tabId, windowId }.
 */
async function listTerminals() {
  const sockets = discoverSockets();
  const terminals = [];

  for (const socket of sockets) {
    try {
      const raw = await kittyCommand(socket, ["ls"]);
      const data = JSON.parse(raw);

      for (const osWindow of data) {
        for (const tab of osWindow.tabs || []) {
          for (const win of tab.windows || []) {
            const cwd = win.cwd || "";
            const dir = cwd.replace(/^\/Users\/[^/]+/, "~");
            const title = win.title || `Window ${win.id}`;

            terminals.push({
              id: `${socket}::${win.id}`,
              windowId: win.id,
              socket,
              title: title,
              cwd: dir,
              displayName: `${title} (${dir})`,
            });
          }
        }
      }
    } catch {
      // Socket might be stale, skip
    }
  }

  return terminals;
}

/**
 * Get text content from a kitty window (last N lines).
 */
async function getText(socket, windowId) {
  const raw = await kittyCommand(socket, [
    "get-text",
    "--match",
    `id:${windowId}`,
  ]);
  return raw;
}

/**
 * Get last N lines of text from a kitty window for LLM context.
 */
async function getContext(socket, windowId, lines = 50) {
  const text = await getText(socket, windowId);
  const allLines = text.split("\n");
  return allLines.slice(-lines).join("\n");
}

/**
 * Send a command to a kitty window (text + Return key).
 */
async function sendCommand(socket, windowId, text) {
  // Pipe text via stdin for reliability with long commands
  await kittyCommand(socket, [
    "send-text",
    "--stdin",
    "--match",
    `id:${windowId}`,
  ], text);
  // Delay before Enter so the terminal app finishes processing long input
  if (text.length > 200) {
    await new Promise((r) => setTimeout(r, 500));
  }
  await kittyCommand(socket, [
    "send-key",
    "--match",
    `id:${windowId}`,
    "Return",
  ]);
}

module.exports = { listTerminals, getText, getContext, sendCommand };
