// DOM elements
const micBtn = document.getElementById("mic-btn");
const micLabel = document.getElementById("mic-label");
const statusText = document.getElementById("status-text");
const transcriptBox = document.getElementById("transcript");
const commandBox = document.getElementById("command-box");
const sendBtn = document.getElementById("send-btn");
const clearBtn = document.getElementById("clear-btn");
const editBtn = document.getElementById("edit-btn");

// API key error dialog
const keyErrorOverlay = document.getElementById("key-error-overlay");
const keyErrorMsg = document.getElementById("key-error-msg");
document.getElementById("key-error-reset").addEventListener("click", () => {
  window.voiceTerminal.resetCredentials();
});
document.getElementById("key-error-dismiss").addEventListener("click", () => {
  keyErrorOverlay.style.display = "none";
});

function isAuthError(errMsg) {
  const lower = errMsg.toLowerCase();
  return lower.includes("401") || lower.includes("403") ||
    lower.includes("unauthorized") || lower.includes("invalid") ||
    lower.includes("authentication") || lower.includes("api key") ||
    lower.includes("api_key");
}

function showKeyError(service, errMsg) {
  keyErrorMsg.textContent = `${service} rejected your API key: ${errMsg}`;
  keyErrorOverlay.style.display = "flex";
}

// Custom dropdown elements
const dropdownTrigger = document.getElementById("dropdown-trigger");
const dropdownList = document.getElementById("dropdown-list");
const terminalPreview = document.getElementById("terminal-preview");

// Dropdown state
let selectedTerminalId = "";
let dropdownOpen = false;
const previewCache = new Map();

// Services
const stt = new SonioxSTT();
let detector = null;

// State
let isListening = false;
let sonioxKey = "";
let reminderTimer = null;

// --- Init ---
async function init() {
  // Load config from config.json (via main process)
  const config = await window.voiceTerminal.getConfig();
  sonioxKey = await window.voiceTerminal.getSonioxKey();

  // Configure services from config
  stt.setConfig(config.soniox);
  detector = new StopWordDetector(config.voice.stop_word);

  await loadTerminals();

  // Set up STT callbacks
  stt.onTranscript = handleTranscript;
  stt.onError = (err) => {
    console.error("STT error:", err);
    setStatus("STT error: " + err.message, "idle");
    stopListening();
    if (isAuthError(err.message)) {
      showKeyError("Soniox", err.message);
    }
  };
}

// --- Terminal list ---
async function loadTerminals() {
  const terminals = await window.voiceTerminal.listTerminals();
  dropdownList.innerHTML = "";
  previewCache.clear();

  if (terminals.length === 0) {
    const item = document.createElement("div");
    item.className = "dropdown-item no-terminals";
    item.textContent = "No Kitty windows found";
    dropdownList.appendChild(item);
    selectedTerminalId = "";
    dropdownTrigger.querySelector(".dropdown-trigger-text").textContent =
      "No Kitty windows found";
    return;
  }

  terminals.forEach((t) => {
    const item = document.createElement("div");
    item.className = "dropdown-item";
    item.dataset.id = t.id;
    item.textContent = t.displayName || t.title;

    if (t.id === selectedTerminalId) {
      item.classList.add("selected");
    }

    item.addEventListener("mouseenter", () => handleItemHover(t.id));
    item.addEventListener("click", () => selectTerminal(t.id, item.textContent));
    dropdownList.appendChild(item);
  });

  // If previously selected terminal is gone, reset
  if (selectedTerminalId) {
    const stillExists = terminals.some((t) => t.id === selectedTerminalId);
    if (!stillExists) {
      selectedTerminalId = "";
      dropdownTrigger.querySelector(".dropdown-trigger-text").textContent =
        "Select a terminal...";
    }
  }
}

// --- Custom dropdown ---
function toggleDropdown() {
  if (dropdownOpen) {
    closeDropdown();
  } else {
    openDropdown();
  }
}

async function openDropdown() {
  dropdownOpen = true;
  dropdownTrigger.classList.add("open");
  dropdownList.classList.add("open");
  terminalPreview.classList.add("visible");
  terminalPreview.innerHTML =
    '<span class="preview-placeholder">Hover a terminal to preview...</span>';

  // Refresh terminal list when opening
  await loadTerminals();
}

function closeDropdown() {
  dropdownOpen = false;
  dropdownTrigger.classList.remove("open");
  dropdownList.classList.remove("open");
  terminalPreview.classList.remove("visible");
}

function selectTerminal(id, displayName) {
  const prevId = selectedTerminalId;
  selectedTerminalId = id;
  dropdownTrigger.querySelector(".dropdown-trigger-text").textContent = displayName;

  // Update selected styling
  dropdownList.querySelectorAll(".dropdown-item").forEach((el) => {
    el.classList.toggle("selected", el.dataset.id === id);
  });

  closeDropdown();

  // Stop recording when switching terminal
  if (prevId !== id && isListening) {
    stopListening();
  }
}

let hoverDebounce = null;
async function handleItemHover(terminalId) {
  // Debounce rapid hovers
  clearTimeout(hoverDebounce);
  hoverDebounce = setTimeout(async () => {
    // Check cache first
    if (previewCache.has(terminalId)) {
      showPreview(previewCache.get(terminalId));
      return;
    }

    terminalPreview.innerHTML =
      '<span class="preview-placeholder">Loading preview...</span>';

    try {
      const preview = await window.voiceTerminal.getTerminalPreview(terminalId);
      previewCache.set(terminalId, preview);
      showPreview(preview);
    } catch {
      terminalPreview.innerHTML =
        '<span class="preview-placeholder">Failed to load preview</span>';
    }
  }, 100);
}

function showPreview(text) {
  if (!text || !text.trim()) {
    terminalPreview.innerHTML =
      '<span class="preview-placeholder">(empty terminal)</span>';
    return;
  }
  terminalPreview.textContent = text;
}

// --- Mic toggle ---
async function startListening() {
  if (!sonioxKey) {
    setStatus("SONIOX_API_KEY not set", "idle");
    return;
  }

  try {
    isListening = true;
    micBtn.classList.add("active");
    micLabel.textContent = "Stop";
    setStatus("Listening...", "listening");
    window.voiceTerminal.setMicState(true);

    // Clear previous
    transcriptBox.innerHTML = "";
    transcriptBox.contentEditable = "false";
    editBtn.style.display = "none";
    editBtn.classList.remove("active");
    commandBox.innerHTML = '<span class="placeholder">—</span>';
    sendBtn.disabled = true;
    sendBtn.classList.remove("sent");
    sendBtn.textContent = "Send to Terminal";

    await stt.start(sonioxKey);

    // Gentle beep every 60s while listening
    reminderTimer = setInterval(() => {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.value = 0.08;
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
      osc.onended = () => ctx.close();
    }, 60000);
  } catch (err) {
    console.error("Failed to start:", err);
    setStatus("Mic error: " + err.message, "idle");
    stopListening();
  }
}

function stopListening() {
  isListening = false;
  micBtn.classList.remove("active");
  micLabel.textContent = "Start";
  window.voiceTerminal.setMicState(false);
  stt.stop();
  if (reminderTimer) {
    clearInterval(reminderTimer);
    reminderTimer = null;
  }

  // Show edit button when stopped (if there's transcript text)
  if (transcriptBox.textContent.trim()) {
    editBtn.style.display = "";
  }

  if (
    statusText.textContent === "Listening..." ||
    statusText.textContent.startsWith("Mic error")
  ) {
    setStatus("Idle", "idle");
  }
}

// --- Transcript handling ---
function handleTranscript(fullTranscript, finalTranscript, hasFinal) {
  // Display: final text in black, interim in gray
  const interimPart = fullTranscript.slice(finalTranscript.length);
  transcriptBox.innerHTML = `${escapeHtml(finalTranscript)}<span class="interim">${escapeHtml(interimPart)}</span>`;
  transcriptBox.scrollTop = transcriptBox.scrollHeight;

  // Check stop word on final text only
  if (hasFinal) {
    const result = detector.process(finalTranscript);
    if (result.detected && result.command) {
      handleCommandDetected(result.command);
    }
  }
}

// --- Command detected (stop word triggered) ---
// Continuous mode: correct → auto-send → clear → keep listening
async function handleCommandDetected(rawCommand) {
  // Reset transcript but keep mic running
  stt.resetTranscript();
  transcriptBox.innerHTML = "";
  setStatus("Correcting...", "processing");

  try {
    // Get terminal context for LLM disambiguation
    const terminalId = selectedTerminalId;
    let terminalContext = "";
    if (terminalId) {
      terminalContext =
        await window.voiceTerminal.getTerminalContext(terminalId);
    }

    // Call LLM correction
    const corrected = await window.voiceTerminal.correctTranscript(
      rawCommand,
      terminalContext
    );

    commandBox.innerHTML = escapeHtml(corrected);

    // Auto-send if terminal is selected
    if (terminalId) {
      setStatus("Sending...", "processing");
      const result = await window.voiceTerminal.sendCommand(terminalId, corrected);
      if (result.success) {
        setStatus("Sent! Listening...", "listening");
      } else {
        setStatus("Send failed, listening...", "listening");
      }
    } else {
      // No terminal selected — show command for manual send
      sendBtn.disabled = false;
      setStatus("Ready to send", "sent");
    }
  } catch (err) {
    console.error("LLM correction failed:", err);
    commandBox.innerHTML = escapeHtml(rawCommand);
    sendBtn.disabled = false;
    setStatus("Correction failed, listening...", "listening");
    if (isAuthError(err.message || "")) {
      showKeyError("xAI", err.message);
    }
  }
}

// --- Send command ---
async function handleSend() {
  const terminalId = selectedTerminalId;
  const command = commandBox.textContent;

  if (!terminalId || !command || command === "—") return;

  sendBtn.disabled = true;
  sendBtn.textContent = "Sending...";

  const result = await window.voiceTerminal.sendCommand(terminalId, command);

  if (result.success) {
    sendBtn.textContent = "Sent!";
    sendBtn.classList.add("sent");
    setStatus("Command sent", "sent");
  } else {
    sendBtn.textContent = "Failed";
    setStatus("Send failed: " + (result.error || ""), "idle");
  }

  setTimeout(() => {
    sendBtn.textContent = "Send to Terminal";
    sendBtn.classList.remove("sent");
  }, 2000);
}

// --- Clear ---
function handleClear() {
  if (isListening) stopListening();
  stt.resetTranscript();
  transcriptBox.innerHTML =
    '<span class="placeholder">Transcript will appear here...</span>';
  commandBox.innerHTML = '<span class="placeholder">—</span>';
  sendBtn.disabled = true;
  sendBtn.classList.remove("sent");
  sendBtn.textContent = "Send to Terminal";
  setStatus("Idle", "idle");
}

// --- Helpers ---
function setStatus(text, className) {
  statusText.textContent = text;
  statusText.className = "status " + className;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// --- Event listeners ---
micBtn.addEventListener("click", () => {
  if (isListening) {
    stopListening();
  } else {
    startListening();
  }
});

sendBtn.addEventListener("click", handleSend);
clearBtn.addEventListener("click", handleClear);

// Edit button toggles transcript editing
editBtn.addEventListener("click", () => {
  const editing = transcriptBox.contentEditable === "true";
  transcriptBox.contentEditable = editing ? "false" : "true";
  editBtn.classList.toggle("active", !editing);
  if (!editing) transcriptBox.focus();
});

// Custom dropdown toggle
dropdownTrigger.addEventListener("click", toggleDropdown);

// Close dropdown when clicking outside
document.addEventListener("click", (e) => {
  if (dropdownOpen && !e.target.closest(".terminal-dropdown")) {
    closeDropdown();
  }
});

// Reset API keys
document.getElementById("reset-keys-btn").addEventListener("click", () => {
  window.voiceTerminal.resetCredentials();
});

// Quit button
document.getElementById("quit-btn").addEventListener("click", () => {
  window.voiceTerminal.quitApp();
});

// --- Boot ---
init();
