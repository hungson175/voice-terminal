const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("voiceTerminal", {
  // Mic state (tray icon)
  setMicState: (isActive) => ipcRenderer.send("mic-state", isActive),

  // Terminal management
  listTerminals: () => ipcRenderer.invoke("list-terminals"),
  sendCommand: (terminalId, command) =>
    ipcRenderer.invoke("send-command", { terminalId, command }),
  getTerminalContext: (terminalId) =>
    ipcRenderer.invoke("get-terminal-context", terminalId),

  // LLM correction
  correctTranscript: (transcript, terminalContext) =>
    ipcRenderer.invoke("correct-transcript", { transcript, terminalContext }),

  // Soniox API key (for direct WebSocket from renderer)
  getSonioxKey: () => ipcRenderer.invoke("get-soniox-key"),

  // Config
  getConfig: () => ipcRenderer.invoke("get-config"),
});
