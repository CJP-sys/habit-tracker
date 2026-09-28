import { demoStore, iso } from "./store.js";
import {
  habitStats,
  dateRange,
  dailyRates,
  overallSummary,
  rateForDates,
  isScheduled,
} from "./metrics.js";
import { cloudStore } from "./store.js";
import { getCurrentUser, signOutUser } from "./firebase.js";
import {
  initTheme,
  initModals,
  openModal,
  closeModal,
  toast,
  setTheme,
  applyTheme,
  escapeText,
} from "./ui.js";

const onboardingStyles = document.createElement("link");
onboardingStyles.rel = "stylesheet";
onboardingStyles.href = "css/onboarding.css";
document.head.append(onboardingStyles);

const byId = (id) => document.getElementById(id);
const isDemo = new URLSearchParams(location.search).get("demo") === "true";
const currentUser = await getCurrentUser();
if (!isDemo && !currentUser) {
  location.replace("auth.html");
  await new Promise(() => {});
}
const activeStore = isDemo ? demoStore : cloudStore;
let state;
try {
  state = await activeStore.getState();
} catch (error) {
  const loading = byId("app-loading");
  loading.innerHTML =
    '<span class="loading-mark">!</span><div><b>Unable to load your habits</b><p>Check your connection, then refresh this page.</p></div>';
  console.error("Unable to load habit data", error);
  throw error;
}
let currentView = "today",
  habitFilter = "active",
  calendarDate = new Date(),
  confirmCallback = null;
const todayKey = iso(new Date());
const fmtDate = (
  value,
  options = { month: "short", day: "numeric", year: "numeric" },
) => new Date(value + "T12:00:00").toLocaleDateString(undefined, options);

initTheme();
initModals();
byId("today-date").textContent = new Date()
  .toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
  .toUpperCase();
const hour = new Date().getHours();
byId("day-period").textContent =
  hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";

function showView(view) {
  currentView = view;
  document
    .querySelectorAll(".app-view")
    .forEach((section) =>
      section.classList.toggle("active", section.id === "view-" + view),
    );
  document
    .querySelectorAll("[data-view]")
    .forEach((button) =>
      button.classList.toggle("active", button.dataset.view === view),
    );
  document.title =
    (document.querySelector("#view-" + view)?.dataset.title || "Dashboard") +
    " — DailyHabits";
  byId("sidebar").classList.remove("open");
  byId("menu-toggle").setAttribute("aria-expanded", "false");
  if (view === "calendar") renderCalendar();
  if (view === "analytics") renderAnalytics();
  if (view === "notes") renderNotes();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
document
  .querySelectorAll("[data-view]")
  .forEach((button) =>
    button.addEventListener("click", () => showView(button.dataset.view)),
  );
document
  .querySelectorAll("[data-go]")
  .forEach((button) =>
    button.addEventListener("click", () => showView(button.dataset.go)),
  );
byId("menu-toggle").addEventListener("click", () => {
  const open = byId("sidebar").classList.toggle("open");
  byId("menu-toggle").setAttribute("aria-expanded", String(open));
});
byId("profile-button").addEventListener("click", () => showView("settings"));

function summary() {
  return overallSummary(state.habits);
}
function renderAll() {
  renderToday();
  renderHabitCards();
  byId("nav-habit-count").textContent = summary().active.length;
  if (currentView === "calendar") renderCalendar();
  if (currentView === "analytics") renderAnalytics();
  if (currentView === "notes") renderNotes();
}
function renderToday() {
  const data = summary();
  const total = data.active.filter((h) => isScheduled(h, todayKey)).length;
  const rate = total ? Math.round((data.todayDone / total) * 100) : 0;
  const cards = [
    ["🔥", "Current streak", data.current, "days"],
    ["✓", "Completed today", data.todayDone, "/ " + total],
    ["↗", "30-day rate", data.monthRate, "%"],
    ["🏆", "Best streak", data.best, "days"],
  ];
  byId("summary-stats").innerHTML = cards
    .map(
      (card) =>
        '<article class="stat-card"><span class="stat-icon">' +
        card[0] +
        "</span><div><small>" +
        card[1] +
        "</small><b>" +
        card[2] +
        " <em>" +
        card[3] +
        "</em></b></div></article>",
    )
    .join("");
  byId("today-progress-label").textContent =
    data.todayDone + " of " + total + " completed";
  byId("today-progress-bar").style.width = rate + "%";
  const scheduled = data.active.filter((h) => isScheduled(h, todayKey));
  byId("today-habits").innerHTML = scheduled.length
    ? scheduled
        .map((h) => {
          const stats = habitStats(h);
          return (
            '<article class="habit-row"><span class="habit-row-icon" style="background:' +
            h.color +
            "18;color:" +
            h.color +
            '">' +
            h.icon +
            "</span><div><b>" +
            escapeText(h.name) +
            "</b><small>" +
            stats.current +
            " day streak · " +
            escapeText(h.category) +
            '</small></div><button class="check-button ' +
            (h.completions[todayKey] ? "completed" : "") +
            '" data-toggle="' +
            h.id +
            '" aria-label="' +
            (h.completions[todayKey] ? "Mark incomplete" : "Mark complete") +
            '">' +
            (h.completions[todayKey] ? "✓" : "") +
            "</button></article>"
          );
        })
        .join("")
    : '<div class="empty-state"><span class="empty-icon">🌱</span><h3>No habits yet</h3><p>Create one small routine to begin.</p></div>';
  document
    .querySelectorAll("[data-toggle]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        toggleCompletion(button.dataset.toggle, todayKey),
      ),
    );
  const dates = dateRange(7),
    rates = dailyRates(data.active, dates);
  renderChart(byId("weekly-chart"), rates);
  const weekRate = rateForDates(data.active, dates);
  byId("week-rate").textContent = weekRate + "%";
  const sorted = [...data.stats].sort((a, b) => b.rate - a.rate);
  const best = sorted[0];
  byId("insight-panel").innerHTML = best
    ? "<span>💡</span><div><h3>" +
      escapeText(best.habit.name) +
      " is your most consistent habit</h3><p>You completed it " +
      best.rate +
      "% of scheduled days. Keep using what makes this routine easy to repeat.</p></div>"
    : "<span>🌱</span><div><h3>Your first insight is waiting</h3><p>Complete a few habits to reveal patterns.</p></div>";
}
function renderChart(container, items) {
  container.innerHTML = items
    .map(
      (item) =>
        '<div class="chart-col" title="' +
        item.rate +
        '%"><i style="height:' +
        Math.max(4, item.rate) +
        '%"></i><span>' +
        new Date(item.date + "T12:00:00")
          .toLocaleDateString(undefined, { weekday: "short" })
          .slice(0, 2) +
        "</span></div>",
    )
    .join("");
}
async function toggleCompletion(habitId, date) {
  if (date > todayKey) {
    toast(
      "Future date locked",
      "Completions can only be recorded through today.",
      "warning",
    );
    return;
  }
  state = await activeStore.toggleCompletion(habitId, date);
  const habit = state.habits.find((item) => item.id === habitId),
    completed = habit.completions[date];
  renderAll();
  const streak = habitStats(habit).current;
  if (completed && [3, 7, 14, 30, 60, 100].includes(streak))
    toast(
      streak + "-day streak!",
      habit.name + " is becoming part of your routine.",
      "success",
    );
  else
    toast(
      completed ? "Habit completed" : "Completion removed",
      "Progress updated.",
    );
}

function renderHabitCards() {
  const visible = state.habits.filter((h) =>
    habitFilter === "archived" ? h.archived : !h.archived,
  );
  byId("habit-list-count").textContent =
    visible.length + " habit" + (visible.length === 1 ? "" : "s");
  byId("habit-cards").innerHTML = visible.length
    ? visible
        .map((h) => {
          const s = habitStats(h);
          return (
            '<article class="habit-card"><div class="habit-card-head"><span class="habit-card-icon" style="background:' +
            h.color +
            "18;color:" +
            h.color +
            '">' +
            h.icon +
            "</span><div><h3>" +
            escapeText(h.name) +
            "</h3><small>" +
            escapeText(h.category) +
            " · " +
            (h.frequency === "daily" ? "Daily" : "Weekdays") +
            '</small></div><div class="menu-wrap"><button class="kebab" data-menu="' +
            h.id +
            '" aria-label="Actions for ' +
            escapeText(h.name) +
            '">⋮</button><div class="card-menu" id="menu-' +
            h.id +
            '" hidden><button data-edit="' +
            h.id +
            '">Edit</button><button data-archive="' +
            h.id +
            '">' +
            (h.archived ? "Restore" : "Archive") +
            '</button><button class="delete" data-delete="' +
            h.id +
            '">Delete</button></div></div></div><div class="habit-card-stats"><div><b>' +
            s.current +
            " days</b><small>Current</small></div><div><b>" +
            s.best +
            " days</b><small>Best</small></div><div><b>" +
            s.total +
            '</b><small>Completed</small></div></div><div class="mini-progress"><i style="width:' +
            s.rate +
            "%;background:" +
            h.color +
            '"></i></div></article>'
          );
        })
        .join("")
    : '<div class="empty-state"><span class="empty-icon">🌱</span><h3>' +
      (habitFilter === "archived" ? "No archived habits" : "No habits yet") +
      "</h3><p>" +
      (habitFilter === "archived"
        ? "Habits you archive will appear here."
        : "Start with one small habit and build from there.") +
      "</p></div>";
  document.querySelectorAll("[data-menu]").forEach((button) =>
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      document.querySelectorAll(".card-menu").forEach((menu) => {
        if (menu.id !== "menu-" + button.dataset.menu) menu.hidden = true;
      });
      byId("menu-" + button.dataset.menu).hidden = !byId(
        "menu-" + button.dataset.menu,
      ).hidden;
    }),
  );
  document
    .querySelectorAll("[data-edit]")
    .forEach((b) =>
      b.addEventListener("click", () => openHabitForm(b.dataset.edit)),
    );
  document
    .querySelectorAll("[data-archive]")
    .forEach((b) =>
      b.addEventListener("click", () => archiveHabit(b.dataset.archive)),
    );
  document
    .querySelectorAll("[data-delete]")
    .forEach((b) =>
      b.addEventListener("click", () => requestDeleteHabit(b.dataset.delete)),
    );
}
document.addEventListener("click", (event) => {
  if (!event.target.closest(".menu-wrap"))
    document
      .querySelectorAll(".card-menu")
      .forEach((menu) => (menu.hidden = true));
});
document.querySelectorAll("[data-habit-filter]").forEach((button) =>
  button.addEventListener("click", () => {
    habitFilter = button.dataset.habitFilter;
    document
      .querySelectorAll("[data-habit-filter]")
      .forEach((b) => b.classList.toggle("active", b === button));
    renderHabitCards();
  }),
);

const habitModal = byId("habit-modal"),
  habitForm = byId("habit-form");
function openHabitForm(habitId) {
  habitForm.reset();
  byId("habit-id").value = "";
  byId("habit-start").value = todayKey;
  byId("habit-color").value = "#347958";
  byId("habit-modal-title").textContent = "Create a habit";
  if (habitId) {
    const h = state.habits.find((item) => item.id === habitId);
    if (!h) return;
    byId("habit-id").value = h.id;
    byId("habit-name").value = h.name;
    byId("habit-icon").value = h.icon;
    byId("habit-category").value = h.category;
    byId("habit-color").value = h.color;
    byId("habit-frequency").value = h.frequency;
    byId("habit-start").value = h.startDate;
    byId("habit-goal").value = h.goal || "";
    byId("habit-modal-title").textContent = "Edit habit";
  }
  openModal(habitModal);
}
document
  .querySelectorAll(".open-habit-modal")
  .forEach((button) => button.addEventListener("click", () => openHabitForm()));
const onboardingModal = byId("onboarding-modal");
const starterHabits = {
  coding: {
    name: "Code for 30 minutes",
    icon: "💻",
    category: "Coding",
    color: "#6558b5",
    frequency: "weekdays",
  },
  reading: {
    name: "Read 10 pages",
    icon: "📚",
    category: "Study",
    color: "#c8782d",
    frequency: "daily",
  },
  movement: {
    name: "Take a morning walk",
    icon: "🏃",
    category: "Fitness",
    color: "#347958",
    frequency: "weekdays",
  },
  water: {
    name: "Drink 8 glasses",
    icon: "💧",
    category: "Health",
    color: "#347aa2",
    frequency: "daily",
  },
};
function dismissOnboarding() {
  sessionStorage.setItem("dailyhabits-onboarding-dismissed", "true");
  closeModal(onboardingModal);
}
document.querySelectorAll("[data-starter]").forEach((button) =>
  button.addEventListener("click", async () => {
    const starter = starterHabits[button.dataset.starter];
    button.disabled = true;
    try {
      state = await activeStore.saveHabit({
        ...starter,
        startDate: todayKey,
        goal: null,
        archived: false,
        completions: {},
      });
      dismissOnboarding();
      renderAll();
      toast(
        "Your first habit is ready",
        "Keep it small and show up once today.",
        "success",
      );
    } catch (error) {
      button.disabled = false;
      toast(
        "Unable to add that habit",
        "Check your connection and try again.",
        "error",
      );
      console.error("Unable to create starter habit", error);
    }
  }),
);
byId("onboarding-custom").addEventListener("click", () => {
  dismissOnboarding();
  openHabitForm();
});
byId("onboarding-skip").addEventListener("click", dismissOnboarding);
habitForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = byId("habit-name").value.trim(),
    existingId = byId("habit-id").value;
  if (!name) {
    byId("habit-name-error").textContent = "Give your habit a name.";
    return;
  }
  if (
    state.habits.some(
      (h) => h.id !== existingId && h.name.toLowerCase() === name.toLowerCase(),
    )
  ) {
    byId("habit-name-error").textContent =
      "A habit with this name already exists.";
    return;
  }
  byId("habit-name-error").textContent = "";
  const old = state.habits.find((h) => h.id === existingId);
  state = await activeStore.saveHabit({
    id: existingId || undefined,
    name,
    icon: byId("habit-icon").value,
    category: byId("habit-category").value,
    color: byId("habit-color").value,
    frequency: byId("habit-frequency").value,
    startDate: byId("habit-start").value,
    goal: Number(byId("habit-goal").value) || null,
    ...(old ? { archived: old.archived, completions: old.completions } : {}),
  });
  closeModal(habitModal);
  renderAll();
  toast(existingId ? "Changes saved" : "Habit created successfully");
});
async function archiveHabit(id) {
  const habit = state.habits.find((h) => h.id === id);
  state = await activeStore.archiveHabit(id, !habit.archived);
  renderAll();
  toast(habit.archived ? "Habit restored" : "Habit archived");
}
function requestDeleteHabit(id) {
  const habit = state.habits.find((h) => h.id === id);
  byId("confirm-title").textContent = "Delete " + habit.name + "?";
  byId("confirm-message").textContent =
    "Its completion history will also be removed. This cannot be undone.";
  confirmCallback = async () => {
    state = await activeStore.deleteHabit(id);
    closeModal(byId("confirm-modal"));
    renderAll();
    toast("Habit deleted", "The habit and its history were removed.", "info");
  };
  openModal(byId("confirm-modal"));
}
byId("confirm-action").addEventListener("click", () => confirmCallback?.());

function renderCalendar() {
  const year = calendarDate.getFullYear(),
    month = calendarDate.getMonth(),
    days = new Date(year, month + 1, 0).getDate();
  byId("calendar-title").textContent = calendarDate.toLocaleDateString(
    undefined,
    { month: "long", year: "numeric" },
  );
  const habits = state.habits.filter((h) => !h.archived);
  let html = '<div class="cal-cell header name">Habit</div>';
  for (let d = 1; d <= days; d += 1)
    html += '<div class="cal-cell header">' + d + "</div>";
  habits.forEach((h) => {
    html +=
      '<div class="cal-cell name">' +
      h.icon +
      " " +
      escapeText(h.name) +
      "</div>";
    for (let d = 1; d <= days; d += 1) {
      const key =
          year +
          "-" +
          String(month + 1).padStart(2, "0") +
          "-" +
          String(d).padStart(2, "0"),
        future = key > todayKey,
        complete = Boolean(h.completions[key]),
        scheduled = isScheduled(h, key);
      html +=
        '<button class="cal-cell day ' +
        (complete ? "completed " : "") +
        (key === todayKey ? "today " : "") +
        '" data-cal-habit="' +
        h.id +
        '" data-cal-date="' +
        key +
        '" ' +
        (future || !scheduled ? "disabled" : "") +
        ' aria-label="' +
        escapeText(h.name) +
        " on " +
        key +
        (complete ? ", completed" : "") +
        '">' +
        (complete ? "✓" : "") +
        "</button>";
    }
  });
  const grid = byId("habit-calendar");
  grid.style.gridTemplateColumns = "165px repeat(" + days + ",32px)";
  grid.innerHTML = habits.length
    ? html
    : '<div class="empty-state"><h3>No habits to display</h3></div>';
  grid
    .querySelectorAll("[data-cal-habit]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        toggleCompletion(button.dataset.calHabit, button.dataset.calDate),
      ),
    );
}
byId("prev-month").addEventListener("click", () => {
  calendarDate.setMonth(calendarDate.getMonth() - 1);
  renderCalendar();
});
byId("next-month").addEventListener("click", () => {
  calendarDate.setMonth(calendarDate.getMonth() + 1);
  renderCalendar();
});
byId("calendar-today").addEventListener("click", () => {
  calendarDate = new Date();
  renderCalendar();
});

function renderAnalytics() {
  const active = summary().active,
    weekDates = dateRange(7),
    monthDates = dateRange(30),
    weekRate = rateForDates(active, weekDates),
    monthRate = rateForDates(active, monthDates),
    ranked = active
      .map((h) => ({ h, rate: rateForDates([h], monthDates) }))
      .sort((a, b) => b.rate - a.rate);
  const items = [
    ["Weekly completion", weekRate + "%"],
    ["Monthly completion", monthRate + "%"],
    ["Most consistent", ranked[0]?.h.name || "—"],
    ["Needs attention", ranked.at(-1)?.h.name || "—"],
  ];
  byId("analytics-summary").innerHTML = items
    .map(
      (item) =>
        '<article class="analytics-kpi"><small>' +
        item[0] +
        "</small><b>" +
        escapeText(item[1]) +
        "</b></article>",
    )
    .join("");
  renderChart(byId("analytics-week-chart"), dailyRates(active, weekDates));
  byId("habit-rates").innerHTML = ranked.length
    ? ranked
        .map(
          (item) =>
            '<div><div class="rate-row-head"><span>' +
            item.h.icon +
            " " +
            escapeText(item.h.name) +
            "</span><b>" +
            item.rate +
            '%</b></div><div class="rate-track"><i style="width:' +
            item.rate +
            "%;background:" +
            item.h.color +
            '"></i></div></div>',
        )
        .join("")
    : '<div class="empty-state"><h3>Not enough data yet</h3><p>Complete a few habits and your progress will appear here.</p></div>';
}

const noteModal = byId("note-modal");
function renderNotes() {
  const query = byId("note-search").value.trim().toLowerCase();
  const notes = [...state.notes]
    .filter((note) => note.text.toLowerCase().includes(query))
    .sort((a, b) => b.date.localeCompare(a.date));
  byId("notes-list").innerHTML = notes.length
    ? notes
        .map(
          (note) =>
            '<article class="note-card"><time datetime="' +
            note.date +
            '">' +
            fmtDate(note.date, {
              month: "long",
              day: "numeric",
              year: "numeric",
            }) +
            "</time><p>" +
            escapeText(note.text) +
            '</p><div class="note-actions"><button data-edit-note="' +
            note.id +
            '">Edit</button><button data-delete-note="' +
            note.id +
            '">Delete</button></div></article>',
        )
        .join("")
    : '<div class="empty-state"><span class="empty-icon">✎</span><h3>No notes found</h3><p>Capture a small win or lesson from today.</p></div>';
  document
    .querySelectorAll("[data-edit-note]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        openNoteForm(button.dataset.editNote),
      ),
    );
  document
    .querySelectorAll("[data-delete-note]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        deleteNote(button.dataset.deleteNote),
      ),
    );
}
function openNoteForm(id) {
  byId("note-form").reset();
  byId("note-id").value = "";
  byId("note-date").value = todayKey;
  byId("note-modal-title").textContent = "Add a note";
  if (id) {
    const note = state.notes.find((item) => item.id === id);
    byId("note-id").value = note.id;
    byId("note-date").value = note.date;
    byId("note-text").value = note.text;
    byId("note-modal-title").textContent = "Edit note";
  }
  openModal(noteModal);
}
byId("open-note-modal").addEventListener("click", () => openNoteForm());
byId("note-search").addEventListener("input", renderNotes);
byId("note-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = byId("note-text").value.trim();
  if (!text) {
    byId("note-error").textContent = "Write a short reflection first.";
    return;
  }
  state = await activeStore.saveNote({
    id: byId("note-id").value || undefined,
    date: byId("note-date").value,
    text,
  });
  closeModal(noteModal);
  renderNotes();
  toast("Note saved");
});
function deleteNote(id) {
  const note = state.notes.find((item) => item.id === id);
  byId("confirm-title").textContent = "Delete this note?";
  byId("confirm-message").textContent =
    note.text.slice(0, 100) + (note.text.length > 100 ? "…" : "");
  confirmCallback = async () => {
    state = await activeStore.deleteNote(id);
    closeModal(byId("confirm-modal"));
    renderNotes();
    toast("Note deleted", "", "info");
  };
  openModal(byId("confirm-modal"));
}

byId("save-profile").addEventListener("click", async () => {
  const name = byId("profile-name").value.trim();
  if (!name) return;
  state = await activeStore.updateProfile({
    name,
    weekStart: state.profile.weekStart,
  });
  applyIdentity();
  toast("Profile saved");
});
const themePreference = localStorage.getItem("dailyhabits-theme") || "system";
byId("theme-select").value = themePreference;
byId("theme-select").addEventListener("change", (event) =>
  setTheme(event.target.value),
);
byId("week-select").value = state.profile.weekStart || "monday";
byId("week-select").addEventListener("change", async (event) => {
  state = await activeStore.updateProfile({
    name: state.profile.name,
    weekStart: event.target.value,
  });
  toast("Preference saved");
});
if (isDemo) {
  byId("reset-demo").addEventListener("click", () => {
    byId("confirm-title").textContent = "Reset demo data?";
    byId("confirm-message").textContent =
      "Your demo changes will be replaced with the original sample habits and notes.";
    confirmCallback = async () => {
      state = await demoStore.reset();
      closeModal(byId("confirm-modal"));
      applyIdentity();
      renderAll();
      toast("Demo data reset");
    };
    openModal(byId("confirm-modal"));
  });
} else {
  byId("demo-reset-section").hidden = true;
}

function applyIdentity() {
  const name = state.profile.name || "DailyHabits member",
    initials = name
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  document.querySelector("#view-today .page-heading h1").innerHTML =
    'Good <span id="day-period">' +
    (hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening") +
    "</span>, " +
    escapeText(name) +
    ' <span class="wave">👋</span>';
  byId("profile-button").textContent = initials;
  byId("profile-name").value = name;
  byId("profile-email").value = isDemo
    ? "demo@dailyhabits.app"
    : state.profile.email || currentUser?.email || "";
  const badge = document.querySelector(".demo-badge");
  badge.lastChild.textContent = isDemo ? "Demo mode" : "Cloud synced";
  const exit = document.querySelector(".logout-link");
  exit.lastChild.textContent = isDemo ? "Exit demo" : "Log out";
}
function updateConnectionStatus() {
  if (isDemo) return;
  const badge = document.querySelector(".demo-badge"),
    offline = !navigator.onLine;
  badge.classList.toggle("offline", offline);
  badge.lastChild.textContent = offline ? "Offline" : "Cloud synced";
}
window.addEventListener("online", () => {
  updateConnectionStatus();
  toast("Back online", "Cloud sync is available again.", "info");
});
window.addEventListener("offline", () => {
  updateConnectionStatus();
  toast(
    "You’re offline",
    "Changes may not sync until you reconnect.",
    "warning",
  );
});
document
  .querySelector(".logout-link")
  .addEventListener("click", async (event) => {
    if (isDemo) return;
    event.preventDefault();
    await signOutUser();
    location.replace("index.html");
  });

applyIdentity();
updateConnectionStatus();
renderAll();
renderNotes();
applyTheme(themePreference);
byId("app-loading").hidden = true;
if (
  !isDemo &&
  !state.habits.length &&
  sessionStorage.getItem("dailyhabits-onboarding-dismissed") !== "true"
)
  setTimeout(() => openModal(onboardingModal), 250);
