import { getState, subscribe, seedIfEmpty, setTheme } from "./store.js";
import { qs, qsa, todayISO, isoWeekday } from "./utils.js";
import { renderTodayView } from "./views/today.js";
import { renderTasksView, openTaskModal } from "./views/tasks.js";
import { renderProjectsView, openProjectModal } from "./views/projects.js";
import { renderEventsView, openEventModal } from "./views/events.js";
import { renderNotesView, openNoteModal } from "./views/notes.js";
import { renderCalendarView } from "./views/calendar.js";
import { renderScheduleView, openBlockModal } from "./views/schedule.js";

seedIfEmpty();

const viewContainer = qs("#view-container");
const viewTitle = qs("#view-title");
const topbarActions = qs("#topbar-actions");

const VIEWS = {
  today: {
    title: "Hoy",
    render: renderTodayView,
  },
  tasks: {
    title: "Tareas",
    render: renderTasksView,
    action: { label: "Nueva tarea", onClick: () => openTaskModal(null) },
  },
  projects: {
    title: "Proyectos",
    render: renderProjectsView,
    action: { label: "Nuevo proyecto", onClick: () => openProjectModal(null) },
  },
  events: {
    title: "Eventos",
    render: renderEventsView,
    action: { label: "Nuevo evento", onClick: () => openEventModal(null) },
  },
  notes: {
    title: "Notas",
    render: renderNotesView,
    action: { label: "Nueva nota", onClick: () => openNoteModal(null) },
  },
  calendar: {
    title: "Calendario",
    render: renderCalendarView,
    action: { label: "Nuevo evento", onClick: () => openEventModal(null, todayISO()) },
  },
  schedule: {
    title: "Horario",
    render: renderScheduleView,
    action: {
      label: "Actividad",
      onClick: () => openBlockModal(null, { day: isoWeekday(new Date()), startMin: 8 * 60, endMin: 9 * 60 }),
    },
  },
};

let currentView = "today";

function renderCurrentView() {
  const view = VIEWS[currentView];
  viewTitle.textContent = view.title;
  topbarActions.innerHTML = view.action
    ? `<button class="btn btn-primary" id="topbar-action-btn"><svg class="icon"><use href="#icon-plus"/></svg><span>${view.action.label}</span></button>`
    : "";
  if (view.action) {
    qs("#topbar-action-btn").addEventListener("click", view.action.onClick);
  }
  view.render(viewContainer);

  qsa(".nav-item").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === currentView);
  });
}

function switchView(id) {
  if (!VIEWS[id]) return;
  currentView = id;
  renderCurrentView();
  window.scrollTo(0, 0);
}

qsa(".nav-item").forEach((btn) => {
  btn.addEventListener("click", () => switchView(btn.dataset.view));
});

subscribe(() => renderCurrentView());
document.addEventListener("app:refresh", () => renderCurrentView());
document.addEventListener("app:refresh-silent", () => {});

renderCurrentView();

/* ---------------------------------- Tema ---------------------------------- */

function applyTheme() {
  const theme = getState().theme;
  if (theme === "light" || theme === "dark") {
    document.documentElement.setAttribute("data-theme", theme);
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

function systemPrefersDark() {
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

qs("#theme-toggle").addEventListener("click", () => {
  const current = getState().theme;
  const effectiveDark = current === "dark" || (current === "auto" && systemPrefersDark());
  setTheme(effectiveDark ? "light" : "dark");
  applyTheme();
});

subscribe(applyTheme);
applyTheme();

/* ---------------------------------- Service worker ---------------------------------- */

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((err) => {
      console.warn("No se pudo registrar el service worker", err);
    });
  });
}
