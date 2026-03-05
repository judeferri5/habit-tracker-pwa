/* Habit Tracker PWA
   - Single source of truth: localStorage JSON state
   - Vapes: hits per day, avoided cravings, delay lockout, settings, trend chart
   - Drinking: per-day flags for solo + blackout, days-since metrics, 3-month Sun–Sat calendar
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
      vapeDevicePrice: 13.00,
      daysPerVape: 3,
      delayMinutes: 20,
    },
    vapes: {
      // per day: { hits: number, avoided: number, events: [{t:number, type:"hit"|"avoid"}] }
      days: {},
      delayEndTs: 0,
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

const btnLogToday = el("btnLogToday");
const btnLogYesterday = el("btnLogYesterday");
const activeDrinkLabel = el("activeDrinkLabel");
const drinkCalendar = el("drinkCalendar");

/* Settings modal */
const btnOpenSettings = el("btnOpenSettings");
const btnCloseSettings = el("btnCloseSettings");
const modalBackdrop = el("modalBackdrop");
const settingsModal = el("settingsModal");

const inpDailyGoal = el("inpDailyGoal");
const inpVapeDevicePrice = el("inpVapeDevicePrice");
const inpDaysPerVape = el("inpDaysPerVape");
const inpDelayMins = el("inpDelayMins");
const btnSaveSettings = el("btnSaveSettings");
const btnResetApp = el("btnResetApp");

/* ---------- State ---------- */
let state = loadState();
let activeDrinkISO = todayISO();

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
  inpDailyGoal.value = state.settings.vapeDailyGoal;
  inpVapeDevicePrice.value = state.settings.vapeDevicePrice;
  inpDaysPerVape.value = state.settings.daysPerVape;
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
  const devicePrice = clamp(parseFloat(inpVapeDevicePrice.value || "0"), 0, 999999);
  const daysPer = clamp(parseInt(inpDaysPerVape.value || "1", 10), 1, 9999);
  const mins = clamp(parseInt(inpDelayMins.value || "1", 10), 1, 9999);

  state.settings.vapeDailyGoal = goal;
  state.settings.vapeDevicePrice = devicePrice;
  state.settings.daysPerVape = daysPer;
  state.settings.delayMinutes = mins;

  saveState();
  closeSettings();
  renderAll();
});

btnResetApp.addEventListener("click", () => {
  const ok = confirm("Reset ALL data? This wipes everything on this device.");
  if (!ok) return;
  state = defaultState();
  activeDrinkISO = todayISO();
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
  const ok = confirm("Clear today's vape hits + avoided?");
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
    if (remaining <= 0) cancelDelay();
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
  const today = todayISO();
  let streak = 0;

  for (let offset = 0; offset < 3650; offset++) {
    const dISO = todayISO(new Date(parseISO(today).getTime() - offset*24*60*60*1000));
    const day = state.vapes.days[dISO];
    if (!day) break; // missing day breaks streak (your original behavior)
    if ((day.hits || 0) <= goal) streak += 1;
    else break;
  }
  return streak;
}

function calcLifetime() {
  let hits = 0, avoided = 0;
  const daysTracked = Object.keys(state.vapes.days).length;

  for (const iso of Object.keys(state.vapes.days)) {
    hits += state.vapes.days[iso]?.hits || 0;
    avoided += state.vapes.days[iso]?.avoided || 0;
  }

  const estPerDay = state.settings.vapeDevicePrice / state.settings.daysPerVape;
  const spend = estPerDay * daysTracked;

  return { hits, avoided, spend };
}

function dayOfMonth() {
  return new Date().getDate();
}
function calcThisMonthSpendEst() {
  const daily = state.settings.vapeDevicePrice / state.settings.daysPerVape;
  const elapsed = dayOfMonth();
  return daily * elapsed;
}

/* ---------- Chart ---------- */
let vapeChart = null;

function buildSeries(rangeValue) {
  const dates = allVapeDatesSorted();
  if (dates.length === 0) return { labels: [], values: [] };

  let useDates = dates;

  if (rangeValue !== "all") {
    const n = parseInt(rangeValue, 10); // "7" works the same as "30"
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
  const range = rangeSelect.value; // "7", "30", "90", or "all"
  const { labels, values } = buildSeries(range);

  const canvas = document.getElementById("vapeChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  if (vapeChart) vapeChart.destroy();

  const isBar = range === "7";
  const isAll = range === "all";
  const pointRadius = (isBar || isAll) ? 0 : 2;

  vapeChart = new Chart(ctx, {
    type: isBar ? "bar" : "line",
    data: {
      labels,
      datasets: [{
        label: "Hits",
        data: values,
        tension: isBar ? 0 : 0.25,
        pointRadius
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: true } },
      scales: {
        x: {
          ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: isBar ? 7 : (range === "30" ? 10 : 12) },
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

/* ---------- Drinking ---------- */
function getDrinkDay(iso) {
  if (!state.drinking.days[iso]) state.drinking.days[iso] = { solo: false, blackout: false };
  return state.drinking.days[iso];
}

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
  return String(daysBetween(recent, todayISO()));
}

function toggleSoloForActiveDay() {
  const d = getDrinkDay(activeDrinkISO);
  d.solo = !d.solo;
  saveState();
  renderAll();
}
function toggleBlackoutForActiveDay() {
  const d = getDrinkDay(activeDrinkISO);
  d.blackout = !d.blackout;
  saveState();
  renderAll();
}

function drinkDayColor(iso) {
  const d = state.drinking.days[iso];
  if (!d) return "rgba(255,255,255,0.04)";
  if (d.blackout) return "rgba(255,90,90,0.35)";
  if (d.solo) return "rgba(255,200,90,0.25)";
  return "rgba(120,255,220,0.12)";
}

function monthStart(dateObj) {
  return new Date(dateObj.getFullYear(), dateObj.getMonth(), 1);
}
function monthEnd(dateObj) {
  return new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0);
}
function addMonths(dateObj, delta) {
  return new Date(dateObj.getFullYear(), dateObj.getMonth() + delta, 1);
}

function renderDrinkCalendar3Months() {
  if (!drinkCalendar) return;

  drinkCalendar.innerHTML = "";

  const now = parseISO(todayISO());
  const curStart = monthStart(now);
  const prev1Start = addMonths(curStart, -1);
  const prev2Start = addMonths(curStart, -2);

  const months = [
    { start: prev2Start, end: monthEnd(prev2Start), isCurrent: false },
    { start: prev1Start, end: monthEnd(prev1Start), isCurrent: false },
    { start: curStart,  end: now,                 isCurrent: true  }, // through today
  ];

  const weekdayLabels = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  for (const m of months) {
    const wrap = document.createElement("div");
    wrap.className = "month";

    const header = document.createElement("div");
    header.className = "month-header";

    const title = document.createElement("div");
    title.className = "month-title";
    title.textContent = m.start.toLocaleString(undefined, { month: "long", year: "numeric" });

    const sub = document.createElement("div");
    sub.className = "month-sub";
    sub.textContent = m.isCurrent ? "Through today" : "Full month";

    header.appendChild(title);
    header.appendChild(sub);
    wrap.appendChild(header);

    const weekdays = document.createElement("div");
    weekdays.className = "weekdays";
    for (const w of weekdayLabels) {
      const x = document.createElement("div");
      x.className = "weekday";
      x.textContent = w;
      weekdays.appendChild(x);
    }
    wrap.appendChild(weekdays);

    const grid = document.createElement("div");
    grid.className = "month-grid";

    // blanks until first weekday
    const firstDow = new Date(m.start.getFullYear(), m.start.getMonth(), 1).getDay(); // 0=Sun
    for (let i = 0; i < firstDow; i++) {
      const blank = document.createElement("div");
      blank.className = "cal-day cal-day--blank";
      grid.appendChild(blank);
    }

    const lastDay = m.isCurrent ? m.end.getDate() : monthEnd(m.start).getDate();
    for (let day = 1; day <= lastDay; day++) {
      const dObj = new Date(m.start.getFullYear(), m.start.getMonth(), day);
      const iso = todayISO(dObj);

      const cell = document.createElement("div");
      cell.className = "cal-day";
      cell.style.background = drinkDayColor(iso);
      cell.title = iso;

      if (iso === activeDrinkISO) cell.classList.add("cal-day--selected");

      const num = document.createElement("div");
      num.className = "cal-num";
      num.textContent = String(day);
      cell.appendChild(num);

      cell.addEventListener("click", () => {
        activeDrinkISO = iso;
        renderAll();
      });

      grid.appendChild(cell);
    }

    wrap.appendChild(grid);
    drinkCalendar.appendChild(wrap);
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

  const estPerDay = state.settings.vapeDevicePrice / state.settings.daysPerVape;
  todayGoalMeta.textContent = `Goal: ${state.settings.vapeDailyGoal} • Est/day: ${fmtMoney(estPerDay)}`;

  vapeStreakEl.textContent = String(calcVapeStreak());

  monthSpendEl.textContent = fmtMoney(calcThisMonthSpendEst());

  const life = calcLifetime();
  lifeHitsEl.textContent = String(life.hits);
  lifeSpendEl.textContent = fmtMoney(life.spend);
  lifeAvoidedEl.textContent = String(life.avoided);

  renderDelayUI();
}

function renderDrinking() {
  // Ensure active day exists
  getDrinkDay(activeDrinkISO);
  const d = state.drinking.days[activeDrinkISO];

  soloStateEl.textContent = d.solo ? "Yes" : "No";
  blackoutStateEl.textContent = d.blackout ? "Yes" : "No";

  daysSinceSoloEl.textContent = calcDaysSince("solo");
  daysSinceBlackoutEl.textContent = calcDaysSince("blackout");

  if (activeDrinkLabel) {
    const label = parseISO(activeDrinkISO).toLocaleDateString(undefined, { month:"short", day:"numeric", year:"numeric" });
    activeDrinkLabel.textContent = `Editing: ${label}`;
  }

  renderDrinkCalendar3Months();
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
btnRefreshChart.addEventListener("click", renderChart);

btnToggleSolo.addEventListener("click", toggleSoloForActiveDay);
btnToggleBlackout.addEventListener("click", toggleBlackoutForActiveDay);

btnLogToday.addEventListener("click", () => {
  activeDrinkISO = todayISO();
  renderAll();
});
btnLogYesterday.addEventListener("click", () => {
  const y = new Date(parseISO(todayISO()).getTime() - 24*60*60*1000);
  activeDrinkISO = todayISO(y);
  renderAll();
});

/* ---------- PWA service worker ---------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

/* ---------- Init ---------- */
renderAll();