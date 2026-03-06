/* Habit Tracker
   - Single source of truth: localStorage JSON state
   - Vapes: hits per day, avoided cravings, purchases, delay lockout, trend chart
   - Drinking: per-day flags for solo + blackout, days-since metrics, 3-month Sun–Sat calendar
*/

const STORAGE_KEY = "habit_tracker_state_v1";

function todayISO(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}

function parseISO(iso) {
  const [y, m, dd] = iso.split("-").map(Number);
  const d = new Date(y, m - 1, dd);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysBetween(aISO, bISO) {
  const a = parseISO(aISO).getTime();
  const b = parseISO(bISO).getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function fmtMoney(n) {
  const val = Number.isFinite(n) ? n : 0;
  return val.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function formatDateLabel(iso) {
  if (!iso) return "—";
  return parseISO(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function defaultState() {
  return {
    settings: {
      vapeDailyGoal: 10,
      delayMinutes: 20
    },
    vapes: {
      days: {},
      purchases: [],
      delayEndTs: 0
    },
    drinking: {
      days: {}
    }
  };
}

function normalizePurchase(p) {
  return {
    date: typeof p?.date === "string" ? p.date : todayISO(),
    quantity: clamp(parseInt(p?.quantity || "1", 10), 1, 9999),
    totalPrice: clamp(parseFloat(p?.totalPrice || "0"), 0, 999999)
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();

    const parsed = JSON.parse(raw);
    const base = defaultState();

    const merged = {
      ...base,
      ...parsed,
      settings: { ...base.settings, ...(parsed.settings || {}) },
      vapes: { ...base.vapes, ...(parsed.vapes || {}) },
      drinking: { ...base.drinking, ...(parsed.drinking || {}) }
    };

    merged.vapes.purchases = Array.isArray(merged.vapes.purchases)
      ? merged.vapes.purchases.map(normalizePurchase)
      : [];

    return merged;
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
const btnOpenPurchase = el("btnOpenPurchase");

const vapeStreakEl = el("vapeStreak");
const monthSpendEl = el("monthSpend");
const lifeHitsEl = el("lifeHits");
const lifeSpendEl = el("lifeSpend");
const lifeAvoidedEl = el("lifeAvoided");
const lifeBoughtEl = el("lifeBought");
const avgPerVapeEl = el("avgPerVape");
const lastPurchaseEl = el("lastPurchase");
const lastPurchaseMiniEl = el("lastPurchaseMini");

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
const inpDelayMins = el("inpDelayMins");
const btnSaveSettings = el("btnSaveSettings");
const btnResetApp = el("btnResetApp");

/* Purchase modal */
const purchaseBackdrop = el("purchaseBackdrop");
const purchaseModal = el("purchaseModal");
const btnClosePurchase = el("btnClosePurchase");
const inpPurchaseDate = el("inpPurchaseDate");
const inpPurchaseQty = el("inpPurchaseQty");
const inpPurchaseTotal = el("inpPurchaseTotal");
const btnSavePurchase = el("btnSavePurchase");
const btnUndoPurchase = el("btnUndoPurchase");
const purchaseSummary = el("purchaseSummary");

/* ---------- State ---------- */
let state = loadState();
let activeDrinkISO = todayISO();

/* ---------- Tabs ---------- */
function setTab(which) {
  const isVapes = which === "vapes";
  tabVapes.classList.toggle("chip--active", isVapes);
  tabDrinking.classList.toggle("chip--active", !isVapes);
  sectionVapes.classList.toggle("section--active", isVapes);
  sectionDrinking.classList.toggle("section--active", !isVapes);
}

tabVapes.addEventListener("click", () => setTab("vapes"));
tabDrinking.addEventListener("click", () => setTab("drinking"));

/* ---------- Settings modal ---------- */
function openSettings() {
  inpDailyGoal.value = state.settings.vapeDailyGoal;
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
  const mins = clamp(parseInt(inpDelayMins.value || "1", 10), 1, 9999);

  state.settings.vapeDailyGoal = goal;
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
  closePurchaseModal();
});

/* ---------- Purchase modal ---------- */
function getLastPurchase() {
  if (!state.vapes.purchases.length) return null;
  return [...state.vapes.purchases].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return 0;
  })[state.vapes.purchases.length - 1];
}

function openPurchaseModal() {
  inpPurchaseDate.value = todayISO();
  inpPurchaseQty.value = 1;
  inpPurchaseTotal.value = "";
  purchaseBackdrop.hidden = false;
  purchaseModal.hidden = false;

  const last = getLastPurchase();
  purchaseSummary.textContent = last
    ? `Last buy: ${formatDateLabel(last.date)} • ${last.quantity} for ${fmtMoney(last.totalPrice)}`
    : "Spending is based only on purchases you log here.";
}

function closePurchaseModal() {
  purchaseBackdrop.hidden = true;
  purchaseModal.hidden = true;
}

function addPurchase() {
  const date = inpPurchaseDate.value || todayISO();
  const quantity = clamp(parseInt(inpPurchaseQty.value || "1", 10), 1, 9999);
  const totalPrice = clamp(parseFloat(inpPurchaseTotal.value || "0"), 0, 999999);

  if (!date) return;
  if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
    alert("Enter a total price greater than $0.");
    return;
  }

  state.vapes.purchases.push({ date, quantity, totalPrice });
  saveState();
  closePurchaseModal();
  renderAll();
}

function undoLastPurchase() {
  if (!state.vapes.purchases.length) {
    alert("No purchases to undo.");
    return;
  }

  const purchasesSorted = [...state.vapes.purchases].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return 0;
  });

  const last = purchasesSorted[purchasesSorted.length - 1];
  const idx = state.vapes.purchases.findIndex(
    (p) => p.date === last.date && p.quantity === last.quantity && p.totalPrice === last.totalPrice
  );

  if (idx >= 0) {
    state.vapes.purchases.splice(idx, 1);
    saveState();
    renderAll();
    if (!purchaseModal.hidden) openPurchaseModal();
  }
}

btnOpenPurchase.addEventListener("click", openPurchaseModal);
btnClosePurchase.addEventListener("click", closePurchaseModal);
purchaseBackdrop.addEventListener("click", closePurchaseModal);
btnSavePurchase.addEventListener("click", addPurchase);
btnUndoPurchase.addEventListener("click", undoLastPurchase);

/* ---------- Vapes ---------- */
function getVapeDay(iso) {
  if (!state.vapes.days[iso]) {
    state.vapes.days[iso] = { hits: 0, avoided: 0, events: [] };
  }
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

/* ---------- Delay ---------- */
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

/* ---------- Vape stats ---------- */
function allVapeDatesSorted() {
  return Object.keys(state.vapes.days).sort();
}

function calcVapeStreak() {
  const goal = state.settings.vapeDailyGoal;
  const today = todayISO();
  let streak = 0;

  for (let offset = 0; offset < 3650; offset++) {
    const dISO = todayISO(new Date(parseISO(today).getTime() - offset * 24 * 60 * 60 * 1000));
    const day = state.vapes.days[dISO];
    if (!day) break;
    if ((day.hits || 0) <= goal) streak += 1;
    else break;
  }

  return streak;
}

function calcPurchaseStats() {
  const purchases = [...state.vapes.purchases].sort((a, b) => a.date.localeCompare(b.date));
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  let monthSpend = 0;
  let totalSpend = 0;
  let totalQty = 0;

  for (const p of purchases) {
    totalSpend += p.totalPrice;
    totalQty += p.quantity;

    const d = parseISO(p.date);
    if (d.getFullYear() === y && d.getMonth() === m) {
      monthSpend += p.totalPrice;
    }
  }

  return {
    monthSpend,
    totalSpend,
    totalQty,
    avgPerVape: totalQty > 0 ? totalSpend / totalQty : null,
    lastPurchaseDate: purchases.length ? purchases[purchases.length - 1].date : null
  };
}

function calcLifetimeHitsAvoided() {
  let hits = 0;
  let avoided = 0;

  for (const iso of Object.keys(state.vapes.days)) {
    hits += state.vapes.days[iso]?.hits || 0;
    avoided += state.vapes.days[iso]?.avoided || 0;
  }

  return { hits, avoided };
}

/* ---------- Chart ---------- */
let vapeChart = null;

function buildSeries(rangeValue) {
  const dates = allVapeDatesSorted();

  if (rangeValue === "all") {
    const labels = dates.map((iso) => iso.slice(5));
    const values = dates.map((iso) => state.vapes.days[iso]?.hits || 0);
    return { labels, values };
  }

  const n = parseInt(rangeValue, 10);
  const end = todayISO();
  const startDate = new Date(parseISO(end).getTime() - (n - 1) * 24 * 60 * 60 * 1000);

  const useDates = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    useDates.push(todayISO(d));
  }

  const labels = useDates.map((iso) => iso.slice(5));
  const values = useDates.map((iso) => state.vapes.days[iso]?.hits || 0);

  return { labels, values };
}

function renderChart() {
  const range = rangeSelect.value;
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
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true }
      },
      scales: {
        x: {
          ticks: {
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: isBar ? 7 : (range === "30" ? 10 : 12)
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

/* ---------- Drinking ---------- */
function getDrinkDay(iso) {
  if (!state.drinking.days[iso]) {
    state.drinking.days[iso] = { solo: false, blackout: false };
  }
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
    { start: curStart, end: now, isCurrent: true }
  ];

  const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

    const firstDow = new Date(m.start.getFullYear(), m.start.getMonth(), 1).getDay();
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

      if (iso === activeDrinkISO) {
        cell.classList.add("cal-day--selected");
      }

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
  const label = new Date().toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  });

  todayLabel.textContent = label;
  todayLabel2.textContent = label;
}

function renderVapes() {
  const iso = todayISO();
  const d = getVapeDay(iso);

  todayVapesEl.textContent = String(d.hits || 0);
  todayAvoidedEl.textContent = String(d.avoided || 0);
  todayGoalMeta.textContent = `Goal: ${state.settings.vapeDailyGoal} hits`;

  vapeStreakEl.textContent = String(calcVapeStreak());

  const hitStats = calcLifetimeHitsAvoided();
  const purchaseStats = calcPurchaseStats();

  monthSpendEl.textContent = fmtMoney(purchaseStats.monthSpend);
  lifeHitsEl.textContent = String(hitStats.hits);
  lifeSpendEl.textContent = fmtMoney(purchaseStats.totalSpend);
  lifeAvoidedEl.textContent = String(hitStats.avoided);
  lifeBoughtEl.textContent = String(purchaseStats.totalQty);
  avgPerVapeEl.textContent = purchaseStats.avgPerVape == null ? "—" : fmtMoney(purchaseStats.avgPerVape);
  lastPurchaseEl.textContent = formatDateLabel(purchaseStats.lastPurchaseDate);
  lastPurchaseMiniEl.textContent = formatDateLabel(purchaseStats.lastPurchaseDate);

  renderDelayUI();
}

function renderDrinking() {
  getDrinkDay(activeDrinkISO);
  const d = state.drinking.days[activeDrinkISO];

  soloStateEl.textContent = d.solo ? "Yes" : "No";
  blackoutStateEl.textContent = d.blackout ? "Yes" : "No";

  daysSinceSoloEl.textContent = calcDaysSince("solo");
  daysSinceBlackoutEl.textContent = calcDaysSince("blackout");

  const label = parseISO(activeDrinkISO).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
  activeDrinkLabel.textContent = `Editing: ${label}`;

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
  const y = new Date(parseISO(todayISO()).getTime() - 24 * 60 * 60 * 1000);
  activeDrinkISO = todayISO(y);
  renderAll();
});

/* ---------- Init ---------- */
renderAll();