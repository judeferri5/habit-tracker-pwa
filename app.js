/* Habit Tracker PWA
   - Single source of truth: localStorage JSON state
   - Vapes: hits per day, avoided cravings, delay lockout, settings, trend chart
   - Drinking: per-day flags for solo + blackout, days-since metrics, 3-month heatmap
*/

const STORAGE_KEY = "habit_tracker_state_v1";

function todayISO(d = new Date()) {
  const x = new Date(d);
  x.setHours(0,0,0,0);
  return x.toISOString().slice(0,10);
}
function parseISO(iso) {
  const [y,m,dd] = iso.split("-").map(Number);
  const d = new Date(y, m-1, dd);
  d.setHours(0,0,0,0);
  return d;
}
function daysBetween(aISO, bISO) {
  const a = parseISO(aISO).getTime();
  const b = parseISO(bISO).getTime();
  return Math.round((b - a) / (24*60*60*1000));
}
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function fmtMoney(n) {
  const val = Number.isFinite(n) ? n : 0;
  return val.toLocaleString(undefined, { style:"currency", currency:"USD" });
}

function defaultState() {
  return {
    settings: {
      vapeDailyGoal: 10,
      vapePricePerHit: 0.50,
      delayMinutes: 20,
    },
    vapes: {
      // per day: { hits: number, avoided: number, events: [{t:number, type:"hit"|"avoid"}] }
      days: {},
      delayEndTs: 0, // epoch ms; Add Hit locked if now < delayEndTs
    },
    drinking: {
      // per day: { solo: boolean, blackout: boolean }
      days: {},
    }
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    // light merge to keep compatibility
    const base = defaultState();
    return {
      ...base,
      ...parsed,
      settings: { ...base.settings, ...(parsed.settings || {}) },
      vapes: { ...base.vapes, ...(parsed.vapes || {}) },
      drinking: { ...base.drinking, ...(parsed.drinking || {}) },
    };
  } catch {
    return defaultState();
  }
}
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ---------- DOM ---------- */
const el = (id) => document.getElementById(id);

const tabVapes = el("tabVapes");
const tabDrinking = el("tabDrinking");
const sectionVapes = el("sectionVapes");
const sectionDrinking = el("sectionDrinking");

const todayLabel = el("todayLabel");
const todayLabel2 = el("todayLabel2");

const todayVapesEl = el("todayVapes");
const todayAvoidedEl = el("todayAvoided");
const todayGoalMeta = el("todayGoalMeta");

const btnAddVape = el("btnAddVape");
const btnDelay = el("btnDelay");
const btnCancelDelay = el("btnCancelDelay");
const delayBox = el("delayBox");
const delayCountdown = el("delayCountdown");

const btnAvoided = el("btnAvoided");
const btnUndoVape = el("btnUndoVape");
const btnClearTodayVapes = el("btnClearTodayVapes");

const vapeStreakEl = el("vapeStreak");
const monthSpendEl = el("monthSpend");
const lifeHitsEl = el("lifeHits");
const lifeSpendEl = el("lifeSpend");
const lifeAvoidedEl = el("lifeAvoided");

const rangeSelect = el("rangeSelect");
const btnRefreshChart = el("btnRefreshChart");

const btnToggleSolo = el("btnToggleSolo");
const btnToggleBlackout = el("btnToggleBlackout");
const soloStateEl = el("soloState");
const blackoutStateEl = el("blackoutState");
const daysSinceSoloEl = el("daysSinceSolo");
const daysSinceBlackoutEl = el("daysSinceBlackout");
const heatmap = el("heatmap");
const heatmapLegend = el("heatmapLegend");

/* Settings modal */
const btnOpenSettings = el("btnOpenSettings");
const btnCloseSettings = el("btnCloseSettings");
const modalBackdrop = el("modalBackdrop");
const settingsModal = el("settingsModal");

const inpDailyGoal = el("inpDailyGoal");
const inpVapePrice = el("inpVapePrice");
const inpDelayMins = el("inpDelayMins");
const btnSaveSettings = el("btnSaveSettings");
const btnResetApp = el("btnResetApp");

/* ---------- State ---------- */
let state = loadState();

/* ---------- Tabs ---------- */
function setTab(which) {
  const v = which === "vapes";
  tabVapes.classList.toggle("chip--active", v);
  tabDrinking.classList.toggle("chip--active", !v);
  sectionVapes.classList.toggle("section--active", v);
  sectionDrinking.classList.toggle("section--active", !v);
}
tabVapes.addEventListener("click", () => setTab("vapes"));
tabDrinking.addEventListener("click", () => setTab("drinking"));

/* ---------- Modal ---------- */
function openSettings() {
  // populate inputs
  inpDailyGoal.value = state.settings.vapeDailyGoal;
  inpVapePrice.value = state.settings.vapePricePerHit;
  inpDelayMins.value = state.settings.delayMinutes;

  modalBackdrop.hidden = false;
  settingsModal.hidden = false;
}
function closeSettings() {
  modalBackdrop.hidden = true;
  settingsModal.hidden = true;
}
btnOpenSettings.addEventListener("click", openSettings);
btnCloseSettings.addEventListener("click", closeSettings);
modalBackdrop.addEventListener("click", closeSettings);

btnSaveSettings.addEventListener("click", () => {
  const goal = clamp(parseInt(inpDailyGoal.value || "0", 10), 0, 9999);
  const price = clamp(parseFloat(inpVapePrice.value || "0"), 0, 999999);
  const mins = clamp(parseInt(inpDelayMins.value || "1", 10), 1, 9999);

  state.settings.vapeDailyGoal = goal;
  state.settings.vapePricePerHit = price;
  state.settings.delayMinutes = mins;

  saveState();
  closeSettings();
  renderAll();
});

btnResetApp.addEventListener("click", () => {
  const ok = confirm("Reset ALL data? This wipes everything on this device.");
  if (!ok) return;
  state = defaultState();
  saveState();
  renderAll();
  closeSettings();
});

/* ---------- Vapes: helpers ---------- */
function getVapeDay(iso) {
  if (!state.vapes.days[iso]) state.vapes.days[iso] = { hits: 0, avoided: 0, events: [] };
  return state.vapes.days[iso];
}
function addVapeHit() {
  const now = Date.now();
  if (now < (state.vapes.delayEndTs || 0)) return;

  const iso = todayISO();
  const d = getVapeDay(iso);
  d.hits += 1;
  d.events.push({ t: now, type: "hit" });
  saveState();
  renderAll();
}
function addAvoided() {
  const iso = todayISO();
  const d = getVapeDay(iso);
  d.avoided += 1;
  d.events.push({ t: Date.now(), type: "avoid" });
  saveState();
  renderAll();
}
function undoLastHit() {
  const iso = todayISO();
  const d = getVapeDay(iso);

  // Remove last "hit" event if exists, otherwise decrement hits if > 0
  for (let i = d.events.length - 1; i >= 0; i--) {
    if (d.events[i].type === "hit") {
      d.events.splice(i, 1);
      d.hits = Math.max(0, d.hits - 1);
      saveState();
      renderAll();
      return;
    }
  }
  if (d.hits > 0) {
    d.hits -= 1;
    saveState();
    renderAll();
  }
}
function clearTodayVapes() {
  const ok = confirm("Clear today's vape hits + avoided cravings?");
  if (!ok) return;
  const iso = todayISO();
  state.vapes.days[iso] = { hits: 0, avoided: 0, events: [] };
  saveState();
  renderAll();
}

/* Delay logic */
let delayInterval = null;

function startDelay() {
  const mins = state.settings.delayMinutes;
  const end = Date.now() + mins * 60 * 1000;
  state.vapes.delayEndTs = end;
  saveState();
  renderDelayUI();
}
function cancelDelay() {
  state.vapes.delayEndTs = 0;
  saveState();
  renderDelayUI();
}
function renderDelayUI() {
  const now = Date.now();
  const end = state.vapes.delayEndTs || 0;
  const active = now < end;

  btnAddVape.disabled = active;
  btnDelay.disabled = active;

  delayBox.hidden = !active;

  if (delayInterval) {
    clearInterval(delayInterval);
    delayInterval = null;
  }

  if (!active) return;

  const tick = () => {
    const remaining = Math.max(0, end - Date.now());
    const s = Math.ceil(remaining / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    delayCountdown.textContent = `${mm}:${ss}`;

    if (remaining <= 0) {
      cancelDelay(); // will re-render
    }
  };

  tick();
  delayInterval = setInterval(tick, 250);
}

/* ---------- Vapes: stats ---------- */
function allVapeDatesSorted() {
  return Object.keys(state.vapes.days).sort();
}
function calcVapeStreak() {
  const goal = state.settings.vapeDailyGoal;
  const dates = allVapeDatesSorted();
  if (dates.length === 0) return 0;

  // streak counts backwards from today; missing day breaks streak.
  const today = todayISO();
  let streak = 0;

  for (let offset = 0; offset < 3650; offset++) {
    const dISO = todayISO(new Date(parseISO(today).getTime() - offset*24*60*60*1000));
    const day = state.vapes.days[dISO];
    if (!day) break; // missing day breaks
    if ((day.hits || 0) <= goal) streak += 1;
    else break;
  }
  return streak;
}
function calcLifetime() {
  let hits = 0, avoided = 0;
  for (const iso of Object.keys(state.vapes.days)) {
    hits += state.vapes.days[iso]?.hits || 0;
    avoided += state.vapes.days[iso]?.avoided || 0;
  }
  const spend = hits * state.settings.vapePricePerHit;
  return { hits, avoided, spend };
}
function calcThisMonthSpend() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-based
  let hits = 0;

  for (const iso of Object.keys(state.vapes.days)) {
    const d = parseISO(iso);
    if (d.getFullYear() === y && d.getMonth() === m) {
      hits += state.vapes.days[iso]?.hits || 0;
    }
  }
  return hits * state.settings.vapePricePerHit;
}

/* ---------- Chart ---------- */
let vapeChart = null;

function buildSeries(rangeValue) {
  const dates = allVapeDatesSorted();
  if (dates.length === 0) return { labels: [], values: [] };

  let useDates = dates;

  if (rangeValue !== "all") {
    const n = parseInt(rangeValue, 10);
    const end = todayISO();
    const startDate = new Date(parseISO(end).getTime() - (n - 1) * 24*60*60*1000);

    useDates = [];
    for (let i = 0; i < n; i++) {
      const d = new Date(startDate.getTime() + i * 24*60*60*1000);
      useDates.push(todayISO(d));
    }
  }

  const labels = useDates.map(iso => iso.slice(5)); // MM-DD
  const values = useDates.map(iso => state.vapes.days[iso]?.hits || 0);

  return { labels, values };
}

function renderChart() {
  const range = rangeSelect.value;
  const { labels, values } = buildSeries(range);

  const ctx = document.getElementById("vapeChart").getContext("2d");

  if (vapeChart) vapeChart.destroy();

  vapeChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Hits",
        data: values,
        tension: 0.25,
        pointRadius: range === "all" ? 0 : 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true }
      },
      scales: {
        x: {
          ticks: {
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: range === "10" ? 10 : (range === "30" ? 10 : 12),
          },
          grid: { display: false }
        },
        y: {
          beginAtZero: true,
          ticks: { precision: 0 },
          grid: { color: "rgba(255,255,255,0.08)" }
        }
      }
    }
  });
}

btnRefreshChart.addEventListener("click", renderChart);

/* ---------- Drinking ---------- */
function getDrinkDay(iso) {
  if (!state.drinking.days[iso]) state.drinking.days[iso] = { solo: false, blackout: false };
  return state.drinking.days[iso];
}

function toggleSoloToday() {
  const iso = todayISO();
  const d = getDrinkDay(iso);
  d.solo = !d.solo;
  saveState();
  renderAll();
}
function toggleBlackoutToday() {
  const iso = todayISO();
  const d = getDrinkDay(iso);
  d.blackout = !d.blackout;
  saveState();
  renderAll();
}

btnToggleSolo.addEventListener("click", toggleSoloToday);
btnToggleBlackout.addEventListener("click", toggleBlackoutToday);

function findMostRecent(flagKey) {
  const dates = Object.keys(state.drinking.days).sort();
  for (let i = dates.length - 1; i >= 0; i--) {
    const iso = dates[i];
    if (state.drinking.days[iso]?.[flagKey]) return iso;
  }
  return null;
}
function calcDaysSince(flagKey) {
  const recent = findMostRecent(flagKey);
  if (!recent) return "∞";
  const t = todayISO();
  return String(daysBetween(recent, t));
}

/* Heatmap: last 3 months (approx 92 days) */
function heatColor(iso) {
  const d = state.drinking.days[iso];
  if (!d) return "rgba(255,255,255,0.04)";
  if (d.blackout) return "rgba(255,90,90,0.35)";
  if (d.solo) return "rgba(255,200,90,0.25)";
  return "rgba(120,255,220,0.12)";
}
function renderHeatmapLegend() {
  heatmapLegend.innerHTML = "";
  const items = [
    { label: "None logged", color: "rgba(255,255,255,0.04)" },
    { label: "Good day (no solo / blackout)", color: "rgba(120,255,220,0.12)" },
    { label: "Solo drink", color: "rgba(255,200,90,0.25)" },
    { label: "Bad blackout", color: "rgba(255,90,90,0.35)" },
  ];
  for (const it of items) {
    const wrap = document.createElement("div");
    wrap.className = "legend-item";
    const sw = document.createElement("div");
    sw.className = "legend-swatch";
    sw.style.background = it.color;
    wrap.appendChild(sw);
    const tx = document.createElement("div");
    tx.textContent = it.label;
    wrap.appendChild(tx);
    heatmapLegend.appendChild(wrap);
  }
}

function renderHeatmap() {
  heatmap.innerHTML = "";
  renderHeatmapLegend();

  const end = parseISO(todayISO());
  const start = new Date(end.getTime() - 91 * 24*60*60*1000);

  for (let i = 0; i < 92; i++) {
    const d = new Date(start.getTime() + i * 24*60*60*1000);
    const iso = todayISO(d);

    const cell = document.createElement("div");
    cell.className = "day";
    cell.style.background = heatColor(iso);
    cell.title = iso;

    const month = document.createElement("div");
    month.className = "m";
    month.textContent = (d.getDate() === 1) ? d.toLocaleString(undefined, { month: "short" }) : "";
    cell.appendChild(month);

    const num = document.createElement("div");
    num.className = "d";
    num.textContent = String(d.getDate());
    cell.appendChild(num);

    cell.addEventListener("click", () => {
      const day = getDrinkDay(iso);
      // Cycle: none -> solo -> blackout -> none
      if (!day.solo && !day.blackout) { day.solo = true; day.blackout = false; }
      else if (day.solo && !day.blackout) { day.solo = false; day.blackout = true; }
      else { day.solo = false; day.blackout = false; }
      saveState();
      renderAll();
    });

    heatmap.appendChild(cell);
  }
}

/* ---------- Render ---------- */
function renderDates() {
  const label = new Date().toLocaleDateString(undefined, { weekday:"short", month:"short", day:"numeric" });
  todayLabel.textContent = label;
  todayLabel2.textContent = label;
}

function renderVapes() {
  const iso = todayISO();
  const d = getVapeDay(iso);

  todayVapesEl.textContent = String(d.hits || 0);
  todayAvoidedEl.textContent = String(d.avoided || 0);

  todayGoalMeta.textContent = `Goal: ${state.settings.vapeDailyGoal} hits • $${state.settings.vapePricePerHit.toFixed(2)}/hit`;

  vapeStreakEl.textContent = String(calcVapeStreak());

  const monthSpend = calcThisMonthSpend();
  monthSpendEl.textContent = fmtMoney(monthSpend);

  const life = calcLifetime();
  lifeHitsEl.textContent = String(life.hits);
  lifeSpendEl.textContent = fmtMoney(life.spend);
  lifeAvoidedEl.textContent = String(life.avoided);

  renderDelayUI();
}

function renderDrinking() {
  const iso = todayISO();
  const d = getDrinkDay(iso);

  soloStateEl.textContent = d.solo ? "Yes" : "No";
  blackoutStateEl.textContent = d.blackout ? "Yes" : "No";

  daysSinceSoloEl.textContent = calcDaysSince("solo");
  daysSinceBlackoutEl.textContent = calcDaysSince("blackout");

  renderHeatmap();
}

function renderAll() {
  renderDates();
  renderVapes();
  renderDrinking();
  renderChart();
}

/* ---------- Event wiring ---------- */
btnAddVape.addEventListener("click", addVapeHit);
btnAvoided.addEventListener("click", addAvoided);
btnUndoVape.addEventListener("click", undoLastHit);
btnClearTodayVapes.addEventListener("click", clearTodayVapes);

btnDelay.addEventListener("click", startDelay);
btnCancelDelay.addEventListener("click", cancelDelay);

rangeSelect.addEventListener("change", renderChart);

/* ---------- PWA service worker ---------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

/* ---------- Init ---------- */
renderAll();