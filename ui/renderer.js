// DOM elements
const micBtn = document.getElementById("mic-btn");
const micLabel = document.getElementById("mic-label");
const statusText = document.getElementById("status-text");
const transcriptBox = document.getElementById("transcript");
const commandBox = document.getElementById("command-box");
const sendBtn = document.getElementById("send-btn");
const clearBtn = document.getElementById("clear-btn");
const editBtn = document.getElementById("edit-btn");
const terminalSelect = document.getElementById("terminal-select");

// Services
const stt = new SonioxSTT();
let detector = null;

// State
let isListening = false;
let sonioxKey = "";

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
  };
}

// --- Terminal list ---
async function loadTerminals() {
  const terminals = await window.voiceTerminal.listTerminals();
  terminalSelect.innerHTML = "";

  if (terminals.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No Kitty windows found";
    opt.disabled = true;
    opt.selected = true;
    terminalSelect.appendChild(opt);
    return;
  }

  terminals.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.displayName || t.title;
    terminalSelect.appendChild(opt);
  });
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
    const terminalId = terminalSelect.value;
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
  }
}

// --- Send command ---
async function handleSend() {
  const terminalId = terminalSelect.value;
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

// Refresh terminal list on dropdown focus
terminalSelect.addEventListener("focus", loadTerminals);

// Stop recording when switching terminal (keep transcript)
terminalSelect.addEventListener("change", () => {
  if (isListening) stopListening();
});

// --- Boot ---
init();
