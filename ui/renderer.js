// Default Soniox context terms (used when localStorage is empty)
const DEFAULT_TERMS = [
  "Claude Code", "tmux", "tm-send", "LLM", "API", "GitHub", "pytest",
  "uv", "pnpm", "Celery", "Redis", "FastAPI", "Docker", "Kubernetes",
  "git", "npm", "pip", "debug", "refactor", "deploy", "endpoint",
  "middleware", "async", "await", "webhook", "caching", "SSH",
  "localhost", "frontend", "backend", "TypeScript", "Python",
];

const DEFAULT_TRANSLATION_TERMS = [
  { source: "cross code", target: "Claude Code" },
  { source: "cloud code", target: "Claude Code" },
  { source: "cloth code", target: "Claude Code" },
  { source: "tea mux", target: "tmux" },
  { source: "tee mux", target: "tmux" },
  { source: "T mux", target: "tmux" },
  { source: "TMAX", target: "tmux" },
  { source: "tm send", target: "tm-send" },
  { source: "T M send", target: "tm-send" },
  { source: "team send", target: "tm-send" },
  { source: "L M", target: "LLM" },
  { source: "elem", target: "LLM" },
  { source: "A P I", target: "API" },
  { source: "a p i", target: "API" },
  { source: "get hub", target: "GitHub" },
  { source: "git hub", target: "GitHub" },
  { source: "pie test", target: "pytest" },
  { source: "pi test", target: "pytest" },
  { source: "you v", target: "uv" },
  { source: "UV", target: "uv" },
  { source: "pee npm", target: "pnpm" },
  { source: "P NPM", target: "pnpm" },
  { source: "salary", target: "Celery" },
  { source: "seller e", target: "Celery" },
  { source: "celery", target: "Celery" },
  { source: "did bug", target: "debug" },
  { source: "dee bug", target: "debug" },
  { source: "dee back", target: "debug" },
  { source: "re fact er", target: "refactor" },
  { source: "duh ploy", target: "deploy" },
  { source: "fast a p i", target: "FastAPI" },
  { source: "fast API", target: "FastAPI" },
  { source: "docker", target: "Docker" },
  { source: "web hook", target: "webhook" },
  { source: "end point", target: "endpoint" },
  { source: "middle ware", target: "middleware" },
];

// DOM elements
const micBtn = document.getElementById("mic-btn");
const micLabel = document.getElementById("mic-label");
const statusText = document.getElementById("status-text");
const transcriptBox = document.getElementById("transcript");
const translatedBox = document.getElementById("translated");
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

  // Clean up stale localStorage from old LLM flow
  localStorage.removeItem("skipLlm");

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

// --- Soniox context config helpers ---
function getSavedTerms() {
  const stored = localStorage.getItem("sonioxTerms");
  if (stored) {
    try { return JSON.parse(stored); } catch { /* fall through */ }
  }
  return DEFAULT_TERMS;
}

function getSavedTranslationTerms() {
  const stored = localStorage.getItem("sonioxTranslationTerms");
  if (stored) {
    try { return JSON.parse(stored); } catch { /* fall through */ }
  }
  return DEFAULT_TRANSLATION_TERMS;
}

// --- Soniox context injection ---
async function buildSonioxContext() {
  const context = {
    general: [
      { key: "domain", value: "Software Development" },
      { key: "speaker", value: "Vietnamese developer" },
    ],
    terms: getSavedTerms(),
    translation_terms: getSavedTranslationTerms(),
  };

  // Inject terminal context as text (last 50 lines)
  if (selectedTerminalId) {
    try {
      const termText = await window.voiceTerminal.getTerminalContext(selectedTerminalId);
      if (termText) {
        context.text = termText.slice(-4000);
      }
    } catch {
      // Non-critical, proceed without terminal context
    }
  }

  return context;
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
    configToggle.disabled = true;

    // Clear previous
    transcriptBox.innerHTML = "";
    transcriptBox.contentEditable = "false";
    translatedBox.innerHTML = "";
    editBtn.style.display = "none";
    editBtn.classList.remove("active");
    commandBox.innerHTML = '<span class="placeholder">—</span>';
    sendBtn.disabled = true;
    sendBtn.classList.remove("sent");
    sendBtn.textContent = "Send to Terminal";

    // Build Soniox context with terminal text + translation terms
    const context = await buildSonioxContext();
    await stt.start(sonioxKey, context);

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
  configToggle.disabled = false;
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
function handleTranscript(fullOriginal, finalOriginal, fullTranslated, finalTranslated, hasFinal) {
  // Display original Vietnamese: final in black, interim in gray
  const origInterim = fullOriginal.slice(finalOriginal.length);
  transcriptBox.innerHTML = `${escapeHtml(finalOriginal)}<span class="interim">${escapeHtml(origInterim)}</span>`;
  transcriptBox.scrollTop = transcriptBox.scrollHeight;

  // Display English translation: final in black, interim in gray
  const transInterim = fullTranslated.slice(finalTranslated.length);
  translatedBox.innerHTML = `${escapeHtml(finalTranslated)}<span class="interim">${escapeHtml(transInterim)}</span>`;
  translatedBox.scrollTop = translatedBox.scrollHeight;

  // Check stop word on translated (English) final text — stop word is "thank you"
  if (hasFinal) {
    const result = detector.process(finalTranslated);
    if (result.detected && result.command) {
      handleCommandDetected(result.command);
    }
  }
}

// --- Command detected (stop word triggered) ---
async function handleCommandDetected(rawCommand) {
  stt.resetTranscript();
  transcriptBox.innerHTML = "";
  translatedBox.innerHTML = "";

  const command = rawCommand.trim();
  const terminalId = selectedTerminalId;

  commandBox.innerHTML = escapeHtml(command);

  // Auto-send if terminal is selected
  if (terminalId && command) {
    setStatus("Sending...", "processing");
    try {
      const result = await window.voiceTerminal.sendCommand(terminalId, command);
      if (result.success) {
        setStatus("Sent! Listening...", "listening");
      } else {
        setStatus("Send failed, listening...", "listening");
      }
    } catch (err) {
      console.error("Send failed:", err);
      setStatus("Send failed, listening...", "listening");
    }
  } else {
    sendBtn.disabled = false;
    setStatus("Ready to send", "sent");
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
    '<span class="placeholder">Vietnamese transcript...</span>';
  translatedBox.innerHTML =
    '<span class="placeholder">English translation...</span>';
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

// --- Config panel ---
const configToggle = document.getElementById("config-toggle");
const configPanel = document.getElementById("config-panel");
const mainPanel = document.getElementById("main-panel");
const configTermsArea = document.getElementById("config-terms");
const translationTbody = document.getElementById("translation-tbody");
const configStatus = document.getElementById("config-status");

function showConfigPanel() {
  // Populate fields from localStorage (or defaults)
  configTermsArea.value = getSavedTerms().join(", ");
  populateTranslationTable(getSavedTranslationTerms());
  configStatus.textContent = "";

  mainPanel.style.display = "none";
  configPanel.style.display = "";
}

function hideConfigPanel() {
  configPanel.style.display = "none";
  mainPanel.style.display = "";
}

function populateTranslationTable(pairs) {
  translationTbody.innerHTML = "";
  pairs.forEach((pair) => addTranslationRow(pair.source, pair.target));
}

function addTranslationRow(source, target) {
  const tr = document.createElement("tr");

  const td1 = document.createElement("td");
  const input1 = document.createElement("input");
  input1.type = "text";
  input1.value = source || "";
  input1.placeholder = "misheard";
  td1.appendChild(input1);

  const td2 = document.createElement("td");
  const input2 = document.createElement("input");
  input2.type = "text";
  input2.value = target || "";
  input2.placeholder = "correct";
  td2.appendChild(input2);

  const td3 = document.createElement("td");
  const delBtn = document.createElement("button");
  delBtn.className = "delete-row-btn";
  delBtn.title = "Remove";
  delBtn.textContent = "\u00D7";
  delBtn.addEventListener("click", () => tr.remove());
  td3.appendChild(delBtn);

  tr.append(td1, td2, td3);
  translationTbody.appendChild(tr);
}

function saveConfig() {
  // Parse terms textarea
  const termsRaw = configTermsArea.value;
  const terms = termsRaw.split(",").map((t) => t.trim()).filter(Boolean);

  // Collect translation rows
  const rows = translationTbody.querySelectorAll("tr");
  const translationTerms = [];
  rows.forEach((row) => {
    const inputs = row.querySelectorAll("input");
    const source = inputs[0].value.trim();
    const target = inputs[1].value.trim();
    if (source && target) {
      translationTerms.push({ source, target });
    }
  });

  localStorage.setItem("sonioxTerms", JSON.stringify(terms));
  localStorage.setItem("sonioxTranslationTerms", JSON.stringify(translationTerms));

  configStatus.textContent = "Saved!";
  setTimeout(() => { configStatus.textContent = ""; }, 2000);
}

function resetConfigToDefaults() {
  configTermsArea.value = DEFAULT_TERMS.join(", ");
  populateTranslationTable(DEFAULT_TRANSLATION_TERMS);
  configStatus.textContent = "Defaults loaded. Click Save to apply.";
  setTimeout(() => { configStatus.textContent = ""; }, 3000);
}

configToggle.addEventListener("click", showConfigPanel);
document.getElementById("config-back").addEventListener("click", hideConfigPanel);
document.getElementById("config-save").addEventListener("click", saveConfig);
document.getElementById("config-reset").addEventListener("click", resetConfigToDefaults);
document.getElementById("add-row-btn").addEventListener("click", () => addTranslationRow("", ""));

// --- Boot ---
init();
