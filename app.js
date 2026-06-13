import {
  aggregateSignals,
  analyzeEntry,
  calculateStreak,
  sanitizeEntry
} from "./wellness.js";

const STORAGE_KEY = "steadymind.entries.v1";
const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

const state = {
  entries: loadEntries(),
  selectedTags: new Set(),
  conversation: []
};

const elements = {
  form: $("#checkin-form"),
  journal: $("#journal"),
  count: $("#character-count"),
  status: $("#form-status"),
  reflectionDialog: $("#reflection-dialog"),
  reflectionContent: $("#reflection-content"),
  exerciseDialog: $("#exercise-dialog"),
  exerciseContent: $("#exercise-content"),
  settingsDialog: $("#settings-dialog")
};

function loadEntries() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((entry) => entry && typeof entry === "object").map(sanitizeEntry)
      : [];
  } catch {
    return [];
  }
}

function saveEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.entries));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function requestWellness(payload) {
  const response = await fetch("/api/wellness", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Support is temporarily unavailable.");
  return result;
}

function recentContext() {
  return state.entries.slice(-5).map((entry) => ({
    mood: entry.mood,
    tags: entry.tags,
    themes: (entry.analysis?.themes || []).map((theme) => theme.name),
    note: entry.text.slice(0, 240)
  }));
}

function setDateAndGreeting() {
  const now = new Date();
  $("#today-date").textContent = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(now);
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  $("#today-title").firstChild.textContent = `${greeting}, `;
}

function navigate(viewId) {
  const validView = $(`#${viewId}.view`) ? viewId : "today";
  $$(".view").forEach((view) => {
    const active = view.id === validView;
    view.hidden = !active;
    view.classList.toggle("active", active);
  });
  $$(".nav-link").forEach((link) => {
    const active = link.dataset.view === validView;
    link.classList.toggle("active", active);
    active ? link.setAttribute("aria-current", "page") : link.removeAttribute("aria-current");
  });
  renderDashboard();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function buildChart(entries, large = false) {
  const recent = entries.slice(-7);
  if (!recent.length) return `<p class="empty-state">Your mood line will appear after your first check-in.</p>`;

  const width = large ? 760 : 320;
  const height = large ? 220 : 100;
  const pad = large ? 30 : 12;
  const points = recent.map((entry, index) => {
    const x = recent.length === 1 ? width / 2 : pad + (index * (width - pad * 2)) / (recent.length - 1);
    const y = pad + ((5 - entry.mood) * (height - pad * 2)) / 4;
    return { x, y, date: entry.createdAt };
  });
  const labels = large
    ? points.map(({ x, date }) => {
        const label = new Intl.DateTimeFormat("en-IN", { weekday: "short" }).format(new Date(date));
        return `<text x="${x}" y="${height - 3}" text-anchor="middle" fill="#66736b" font-size="11">${label}</text>`;
      }).join("")
    : "";

  return `
    <svg class="mood-chart" viewBox="0 0 ${width} ${height}" aria-hidden="true">
      <line x1="${pad}" y1="${height / 2}" x2="${width - pad}" y2="${height / 2}" stroke="#dfe4dd" stroke-dasharray="4 5"/>
      <polyline points="${points.map(({ x, y }) => `${x},${y}`).join(" ")}" fill="none" stroke="#28624d" stroke-width="${large ? 4 : 3}" stroke-linecap="round" stroke-linejoin="round"/>
      ${points.map(({ x, y }) => `<circle cx="${x}" cy="${y}" r="${large ? 6 : 4}" fill="#fffcf5" stroke="#28624d" stroke-width="3"/>`).join("")}
      ${labels}
    </svg>`;
}

function renderSignalList(target, signals) {
  if (!signals.length) {
    target.innerHTML = `<p class="empty-state">A few check-ins will help reveal recurring themes.</p>`;
    return;
  }
  target.innerHTML = signals.slice(0, 5).map((signal) => `
    <div class="signal-row">
      <strong>${escapeHtml(signal.name)}</strong>
      <span>${signal.count} mention${signal.count === 1 ? "" : "s"}</span>
    </div>
  `).join("");
}

function renderDashboard() {
  const recent = state.entries.slice(-7);
  const moods = recent.map((entry) => entry.mood);
  const average = moods.length ? moods.reduce((sum, mood) => sum + mood, 0) / moods.length : 0;
  const labels = ["Drained", "Low", "Okay", "Good", "Strong"];
  const latest = recent.at(-1);

  $("#streak-count").textContent = calculateStreak(state.entries);
  $("#mini-chart").innerHTML = buildChart(state.entries);
  $("#full-chart").innerHTML = buildChart(state.entries, true);
  const chartLabel = moods.length
    ? `Mood history for ${moods.length} recent check-ins: ${moods.join(", ")} out of 5`
    : "No mood history yet";
  $("#mini-chart").setAttribute("aria-label", chartLabel);
  $("#full-chart").setAttribute("aria-label", chartLabel);
  $("#pulse-label").textContent = average ? labels[Math.round(average) - 1] : "No data yet";
  $("#chart-caption").textContent = latest
    ? `Latest check-in: ${labels[latest.mood - 1].toLowerCase()}. Your entries remain on this device.`
    : "Check in today to begin noticing patterns.";
  renderSignalList($("#trigger-list"), aggregateSignals(state.entries, "themes"));
  renderSignalList($("#strength-list"), aggregateSignals(state.entries, "strengths"));
}

function showReflection(entry) {
  if (entry.analysis?.isCrisis) {
    elements.reflectionContent.replaceChildren($("#crisis-template").content.cloneNode(true));
  } else {
    const reflection = entry.analysis?.reflection || {};
    const acknowledgement = reflection.acknowledgement || "Thank you for checking in today.";
    const insight = reflection.insight || "";
    const action = reflection.action || "Take one slow breath and rest.";
    const encouragement = reflection.encouragement || "You are doing what you can, and that is enough.";
    const theme = entry.analysis?.hiddenPattern || entry.analysis?.themes?.[0]?.name;
    const steps = entry.analysis?.mindfulness?.steps || [];
    elements.reflectionContent.innerHTML = `
      <p class="eyebrow">A reflection for this moment</p>
      <h2 id="reflection-title">Let's make today feel smaller.</h2>
      <p class="reflection-summary">${escapeHtml(acknowledgement)}</p>
      ${theme && insight ? `<div class="reflection-section"><h3>Pattern noticed</h3><p>${escapeHtml(insight)}</p></div>` : ""}
      <div class="reflection-section"><h3>Try this now</h3><p>${escapeHtml(action)}</p></div>
      ${steps.length ? `<div class="reflection-section"><h3>${escapeHtml(entry.analysis.mindfulness.title)} · ${escapeHtml(entry.analysis.mindfulness.duration)}</h3><ol>${steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol></div>` : ""}
      <div class="reflection-section"><h3>Keep with you</h3><p>${escapeHtml(encouragement)}</p></div>
      ${entry.analysis?.followUpQuestion ? `<div class="reflection-section"><h3>Reflect</h3><p>${escapeHtml(entry.analysis.followUpQuestion)}</p></div>` : ""}
      <p class="fine-print">${entry.analysis?.source === "ai" ? "Generated by AI from this check-in and minimized recent context." : "Generated locally because AI is not configured."} It can be wrong; keep what helps and leave what does not.</p>
    `;
  }
  elements.reflectionDialog.showModal();
}

async function handleSubmit(event) {
  event.preventDefault();
  const text = elements.journal.value.trim();
  if (!text) {
    elements.status.textContent = "Please write a few words before reflecting.";
    elements.journal.focus();
    return;
  }

  const mood = Number(new FormData(elements.form).get("mood"));
  const tags = [...state.selectedTags];
  const localAnalysis = analyzeEntry({ text, mood, tags });
  if (localAnalysis.isCrisis) {
    showReflection({ analysis: localAnalysis });
    elements.status.textContent = "Immediate support options are shown.";
    return;
  }

  const submitButton = $('button[type="submit"]', elements.form);
  submitButton.disabled = true;
  elements.status.textContent = "Creating your personalized reflection.";
  let generated;
  try {
    generated = await requestWellness({ mode: "checkin", message: text, mood, tags, recent: recentContext() });
  } catch {
    generated = {
      acknowledgement: localAnalysis.reflection.acknowledgement,
      hiddenPattern: localAnalysis.reflection.insight,
      copingStrategy: localAnalysis.reflection.action,
      encouragement: localAnalysis.reflection.encouragement,
      triggers: localAnalysis.themes.map((theme) => theme.name),
      strengths: localAnalysis.strengths.map((strength) => strength.name),
      source: "local"
    };
  } finally {
    submitButton.disabled = false;
  }

  const analysis = {
    ...localAnalysis,
    source: generated.source,
    hiddenPattern: generated.hiddenPattern,
    mindfulness: generated.mindfulness,
    followUpQuestion: generated.followUpQuestion,
    themes: (generated.triggers || []).map((name) => ({ name, count: 1 })),
    strengths: (generated.strengths || []).map((name) => ({ name, count: 1 })),
    reflection: {
      acknowledgement: generated.acknowledgement,
      insight: generated.hiddenPattern,
      action: generated.copingStrategy,
      encouragement: generated.encouragement
    }
  };
  const entry = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), text, mood, tags, analysis };
  state.entries.push(entry);
  saveEntries();
  renderDashboard();
  showReflection(entry);

  elements.form.reset();
  $('input[name="mood"][value="3"]').checked = true;
  elements.journal.value = "";
  elements.count.textContent = "0 / 1200";
  state.selectedTags.clear();
  $$(".quick-tags button").forEach((button) => {
    button.classList.remove("selected");
    button.setAttribute("aria-pressed", "false");
  });
  elements.status.textContent = "Your private check-in has been saved.";
}

function appendChat(role, content) {
  const bubble = document.createElement("p");
  bubble.className = `chat-bubble ${role}`;
  bubble.textContent = content;
  $("#chat-log").append(bubble);
  $(".companion-message").scrollTop = $(".companion-message").scrollHeight;
}

async function handleChat(event) {
  event.preventDefault();
  const input = $("#chat-input");
  const message = input.value.trim();
  if (!message) return;

  appendChat("user", message);
  state.conversation.push({ role: "user", content: message });
  input.value = "";
  const button = $('button[type="submit"]', $("#chat-form"));
  button.disabled = true;
  try {
    const result = await requestWellness({
      mode: "chat",
      message,
      mood: state.entries.at(-1)?.mood || 3,
      recent: recentContext(),
      conversation: state.conversation
    });
    if (result.crisis) {
      showReflection({ analysis: { isCrisis: true } });
      appendChat("assistant", "Your safety matters most. Please use the immediate support options I've opened.");
      return;
    }
    const reply = `${result.acknowledgement} ${result.copingStrategy} ${result.followUpQuestion}`;
    appendChat("assistant", reply);
    state.conversation.push({ role: "assistant", content: reply });
  } catch {
    appendChat("assistant", "I cannot reach the AI service right now. Try one slow exhale, then tell a trusted person what feels hardest.");
  } finally {
    button.disabled = false;
    input.focus();
  }
}

function showExercise(type) {
  const exercises = {
    breathing: {
      title: "Follow one gentle cycle",
      content: `<div class="breathing-visual"><strong>Breathe slowly</strong></div>
        <p>Inhale through your nose for 4 counts. Exhale softly for 6. Repeat six times without forcing the breath.</p>`
    },
    "tiny-step": {
      title: "Make the task almost too easy",
      content: `<p>Choose one:</p><ul><li>Open the chapter and read one heading.</li><li>Solve only the first line of one question.</li><li>Write three topics for the next study block.</li></ul><p>Starting is the goal. Continuing is optional.</p>`
    },
    grounding: {
      title: "Come back to the room",
      content: `<p>Without rushing, notice:</p><ol><li>Five things you can see.</li><li>Four things your body can feel.</li><li>Three sounds you can hear.</li><li>Two things you can smell.</li><li>One kind thing you can say to yourself.</li></ol>`
    }
  };
  const exercise = exercises[type];
  elements.exerciseContent.innerHTML = `
    <p class="eyebrow">Guided reset</p>
    <h2 id="exercise-title">${exercise.title}</h2>
    ${exercise.content}
    <p class="fine-print">Stop if this feels uncomfortable. A practice should support you, not become another task to pass.</p>
  `;
  elements.exerciseDialog.showModal();
}

function exportData() {
  const blob = new Blob([JSON.stringify(state.entries, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `steadymind-export-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function bindEvents() {
  $$(".nav-link").forEach((link) => link.addEventListener("click", (event) => {
    event.preventDefault();
    navigate(link.dataset.view);
    history.replaceState(null, "", `#${link.dataset.view}`);
  }));
  elements.journal.addEventListener("input", () => {
    elements.count.textContent = `${elements.journal.value.length} / 1200`;
  });
  elements.form.addEventListener("submit", handleSubmit);
  $("#chat-form").addEventListener("submit", handleChat);

  $$(".quick-tags button").forEach((button) => button.addEventListener("click", () => {
    const tag = button.dataset.tag;
    state.selectedTags.has(tag) ? state.selectedTags.delete(tag) : state.selectedTags.add(tag);
    button.classList.toggle("selected");
    button.setAttribute("aria-pressed", String(state.selectedTags.has(tag)));
  }));
  $$(".suggestion-chips button").forEach((button) => button.addEventListener("click", () => {
    $("#chat-input").value = button.dataset.prompt;
    $("#chat-input").focus();
  }));
  $$(".exercise-button").forEach((button) => button.addEventListener("click", () => showExercise(button.dataset.exercise)));
  $$(".dialog-close").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));
  $$("dialog").forEach((dialog) => dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  }));

  $("#open-settings").addEventListener("click", () => elements.settingsDialog.showModal());
  $("#export-data").addEventListener("click", exportData);
  $("#delete-data").addEventListener("click", () => {
    if (!confirm("Delete every journal entry and mood check-in from this browser? This cannot be undone.")) return;
    localStorage.removeItem(STORAGE_KEY);
    state.entries = [];
    renderDashboard();
    elements.settingsDialog.close();
    elements.status.textContent = "All local wellness data has been deleted.";
  });
}

async function showAIStatus() {
  try {
    const response = await fetch("/api/health");
    const health = await response.json();
    $("#ai-status").textContent = health.aiConfigured
      ? "Gemini AI enabled · messages are sent only when you submit"
      : "Local demo mode · add GEMINI_API_KEY to enable Gemini";
  } catch {
    $("#ai-status").textContent = "Offline support mode";
  }
}

setDateAndGreeting();
bindEvents();
renderDashboard();
navigate(location.hash.slice(1) || "today");
showAIStatus();
