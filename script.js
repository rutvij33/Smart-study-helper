// ===== AI Study Helper =====
// Flow: notes -> prompt -> fetch (POST) -> JSON reply -> validate -> render

const $ = (id) => document.getElementById(id);
const KEYS = { api: "sh_api_key", model: "sh_model", theme: "sh_theme", hist: "sh_history" };
const MAX_HISTORY = 20;
let current = null; // result currently on screen: {summary, questions, flashcards}

// ---------- small helpers ----------
// Build a DOM element; textContent keeps AI text safe from HTML injection
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function setStatus(msg, type = "") {
  const s = $("status");
  s.textContent = msg;
  s.className = type; // "", "error", "ok", "loading"
}

// ---------- theme (dark / light, remembered) ----------
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  $("themeBtn").textContent = t === "dark" ? "☀️" : "🌙";
  localStorage.setItem(KEYS.theme, t);
}
function initTheme() {
  const saved = localStorage.getItem(KEYS.theme);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(saved || (prefersDark ? "dark" : "light"));
}

// ---------- prompt ----------
function buildPrompt(notes, style, difficulty) {
  return `You are a study helper. Answer style: ${style}. Quiz difficulty: ${difficulty}.
Reply ONLY with valid JSON in exactly this format, no extra text:
{"summary":"short summary","questions":[{"q":"question","options":["A","B","C","D"],"answer":0}],"flashcards":[{"front":"term or question","back":"answer"}]}
Rules: exactly 5 questions, each with 4 options; "answer" is the index (0-3) of the correct option; 6 flashcards.
Notes:
${notes}`;
}

// ---------- API call ----------
function httpMessage(status) {
  if (status === 400) return "Bad request or invalid API key (400). Check your key and model name.";
  if (status === 401 || status === 403) return `Wrong API key or no access (${status}).`;
  if (status === 404) return "Model not found (404). Check the model name in Settings.";
  if (status === 429) return "Rate limit reached (429). Wait a minute and try again.";
  if (status >= 500) return `AI server error (${status}). Try again later.`;
  return `Request failed with status ${status}.`;
}

async function callAPI(prompt, key, model) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    });
  } catch {
    throw new Error("Network error. Check your internet connection.");
  }
  if (!res.ok) throw new Error(httpMessage(res.status));
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text; // answer text location
}

// ---------- parse + validate ----------
function parseReply(text) {
  if (!text) throw new Error("The AI sent an empty reply. Try again.");
  const clean = text.replace(/```json|```/g, "").trim(); // remove code fences if any
  let data;
  try {
    data = JSON.parse(clean);
  } catch {
    throw new Error("The AI replied in the wrong format. Please click Generate again.");
  }
  validate(data);
  return data;
}

function validate(d) {
  const bad = (what) => { throw new Error(`Invalid AI reply: ${what} missing or wrong.`); };
  if (typeof d.summary !== "string" || !d.summary.trim()) bad("summary");
  if (!Array.isArray(d.questions) || !d.questions.length) bad("questions");
  d.questions.forEach((q) => {
    const ok = typeof q.q === "string" && Array.isArray(q.options) && q.options.length >= 2 &&
      Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length;
    if (!ok) bad("quiz question");
  });
  if (!Array.isArray(d.flashcards) || !d.flashcards.length) bad("flashcards");
  d.flashcards.forEach((c) => { if (!c.front || !c.back) bad("flashcard"); });
}

// ---------- rendering ----------
function renderSummary(text) {
  $("summaryText").textContent = text;
}

function renderQuiz(questions) {
  const box = $("quiz");
  box.innerHTML = "";
  questions.forEach((q, i) => {
    const wrap = el("div", "q");
    wrap.append(el("p", "qtext", `${i + 1}. ${q.q}`));
    q.options.forEach((opt, j) => {
      const label = el("label", "opt");
      const radio = el("input");
      radio.type = "radio"; radio.name = "q" + i; radio.value = j;
      label.append(radio, " " + opt);
      wrap.append(label);
    });
    box.append(wrap);
  });

  const btn = el("button", "", "Submit quiz");
  const result = el("p", "score");
  btn.onclick = () => {
    let score = 0;
    questions.forEach((q, i) => {
      const wrap = box.children[i];
      const picked = wrap.querySelector("input:checked");
      const labels = wrap.querySelectorAll(".opt");
      const right = picked && +picked.value === q.answer;
      labels[q.answer].classList.add("correct");
      if (right) score++;
      else {
        if (picked) labels[+picked.value].classList.add("wrong");
        wrap.append(el("small", "", `Correct answer: ${q.options[q.answer]}`));
      }
      wrap.querySelectorAll("input").forEach((r) => (r.disabled = true));
    });
    result.textContent = `Score: ${score} / ${questions.length}`;
    btn.disabled = true;
  };
  box.append(btn, result);
}

function renderCards(cards) {
  const box = $("cards");
  box.innerHTML = "";
  const updateCount = () => {
    const n = box.querySelectorAll(".known-btn.on").length;
    $("knownCount").textContent = `Known: ${n} / ${cards.length}`;
  };
  cards.forEach((c) => {
    const item = el("div");
    const flip = el("div", "flip");
    const inner = el("div", "inner");
    inner.append(el("div", "face", c.front), el("div", "face back", c.back));
    flip.append(inner);
    flip.onclick = () => flip.classList.toggle("flipped");

    const known = el("button", "known-btn", "Not known");
    known.onclick = () => {
      known.classList.toggle("on");
      known.textContent = known.classList.contains("on") ? "✅ Known" : "Not known";
      updateCount();
    };
    item.append(flip, known);
    box.append(item);
  });
  updateCount();
}

function showResults(data) {
  current = data;
  renderSummary(data.summary);
  renderQuiz(data.questions);
  renderCards(data.flashcards);
  $("results").classList.remove("hidden");
  switchTab("summary");
}

function switchTab(name) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("hidden", p.id !== "tab-" + name));
}

// ---------- history (localStorage) ----------
function loadHistory() {
  try { return JSON.parse(localStorage.getItem(KEYS.hist)) || []; }
  catch { return []; }
}
function saveHistory(notes, data) {
  const list = loadHistory();
  list.unshift({ id: Date.now(), title: notes.slice(0, 40), notes, data });
  localStorage.setItem(KEYS.hist, JSON.stringify(list.slice(0, MAX_HISTORY)));
  renderHistory();
}
function renderHistory() {
  const ul = $("history");
  ul.innerHTML = "";
  const list = loadHistory();
  if (!list.length) { ul.append(el("li", "", "No history yet.")); return; }
  list.forEach((item) => {
    const li = el("li");
    li.append(el("span", "", item.title + (item.notes.length > 40 ? "…" : "")),
      el("small", "", new Date(item.id).toLocaleString()));
    li.onclick = () => { $("notes").value = item.notes; updateCounter(); showResults(item.data); };
    ul.append(li);
  });
}

// ---------- actions: copy, download, speak ----------
async function copySummary() {
  if (!current) return;
  try {
    await navigator.clipboard.writeText(current.summary);
    setStatus("Summary copied to clipboard.", "ok");
  } catch {
    setStatus("Could not copy. Select the text and copy manually.", "error");
  }
}
function downloadSummary() {
  if (!current) return;
  const blob = new Blob([current.summary], { type: "text/plain" });
  const a = el("a");
  a.href = URL.createObjectURL(blob);
  a.download = "summary.txt";
  a.click();
  URL.revokeObjectURL(a.href);
}
function toggleSpeak() {
  if (!("speechSynthesis" in window)) return setStatus("Speech is not supported in this browser.", "error");
  if (speechSynthesis.speaking) { speechSynthesis.cancel(); return; }
  if (current) speechSynthesis.speak(new SpeechSynthesisUtterance(current.summary));
}

// ---------- notes counter ----------
function updateCounter() {
  const len = $("notes").value.length;
  $("counter").textContent = `${len} / 6000`;
  $("warn").textContent = len >= 5000 ? "Very long text – the AI may miss details." : "";
}

// ---------- main generate flow ----------
async function onGenerate() {
  const key = $("apiKey").value.trim();
  const model = $("model").value.trim() || "gemini-2.5-flash";
  const notes = $("notes").value.trim();

  if (!key) { $("settings").open = true; return setStatus("Please add your API key in Settings.", "error"); }
  if (!notes) return setStatus("Please enter some notes or a topic first.", "error");

  $("generateBtn").disabled = true; // stop double clicks
  setStatus("Generating... please wait", "loading");
  try {
    const prompt = buildPrompt(notes, $("style").value, $("difficulty").value);
    const text = await callAPI(prompt, key, model);
    const data = parseReply(text);
    showResults(data);
    saveHistory(notes, data);
    setStatus("Done! ✅", "ok");
  } catch (err) {
    setStatus(err.message, "error");
  } finally {
    $("generateBtn").disabled = false;
  }
}

// ---------- init ----------
function init() {
  initTheme();
  $("apiKey").value = localStorage.getItem(KEYS.api) || "";
  $("model").value = localStorage.getItem(KEYS.model) || "gemini-2.5-flash";
  renderHistory();

  $("themeBtn").onclick = () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  $("saveSettings").onclick = () => {
    localStorage.setItem(KEYS.api, $("apiKey").value.trim());
    localStorage.setItem(KEYS.model, $("model").value.trim());
    setStatus("Settings saved.", "ok");
  };
  $("notes").addEventListener("input", updateCounter);
  $("generateBtn").onclick = onGenerate;
  $("copyBtn").onclick = copySummary;
  $("downloadBtn").onclick = downloadSummary;
  $("speakBtn").onclick = toggleSpeak;
  $("clearHistory").onclick = () => {
    if (confirm("Delete all history?")) { localStorage.removeItem(KEYS.hist); renderHistory(); }
  };
  document.querySelectorAll(".tab").forEach((t) => (t.onclick = () => switchTab(t.dataset.tab)));
}
init();
