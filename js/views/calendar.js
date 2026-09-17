import { getState, toggleTask } from "../store.js";
import { showToast } from "../ui.js";
import {
  escapeHtml, todayISO, toISODate, parseISODate, isoWeekday, MONTH_LABELS, DOW_LABELS, colorFor,
} from "../utils.js";
import { openEventModal } from "./events.js";
import { openTaskModal } from "./tasks.js";

let viewDate = startOfMonth(new Date());
let selectedDate = todayISO();

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function renderCalendarView(container) {
  container.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <div class="calendar-header">
      <div class="calendar-title" id="cal-title"></div>
      <div class="calendar-nav">
        <button class="icon-btn" id="cal-prev"><svg class="icon"><use href="#icon-chevron-left"/></svg></button>
        <button class="btn btn-sm" id="cal-today">Hoy</button>
        <button class="icon-btn" id="cal-next"><svg class="icon"><use href="#icon-chevron-right"/></svg></button>
      </div>
    </div>
    <div class="calendar-grid" id="cal-grid"></div>
    <div class="calendar-agenda card" id="cal-agenda"></div>
  `;
  container.appendChild(wrap);

  const gridEl = wrap.querySelector("#cal-grid");
  const agendaEl = wrap.querySelector("#cal-agenda");

  wrap.querySelector("#cal-prev").addEventListener("click", () => {
    viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
    renderCalendarView(container);
  });
  wrap.querySelector("#cal-next").addEventListener("click", () => {
    viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
    renderCalendarView(container);
  });
  wrap.querySelector("#cal-today").addEventListener("click", () => {
    viewDate = startOfMonth(new Date());
    selectedDate = todayISO();
    renderCalendarView(container);
  });

  wrap.querySelector("#cal-title").textContent = `${MONTH_LABELS[viewDate.getMonth()]} ${viewDate.getFullYear()}`;

  renderGrid(gridEl, agendaEl);
  renderAgenda(agendaEl);
}

function renderGrid(gridEl, agendaEl) {
  const state = getState();
  const today = todayISO();
  const firstOfMonth = viewDate;
  const firstWeekday = isoWeekday(firstOfMonth);
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(gridStart.getDate() - firstWeekday);

  let html = DOW_LABELS.map((d) => `<div class="calendar-dow">${d}</div>`).join("");

  for (let i = 0; i < 42; i++) {
    const cellDate = new Date(gridStart);
    cellDate.setDate(cellDate.getDate() + i);
    const iso = toISODate(cellDate);
    const outside = cellDate.getMonth() !== firstOfMonth.getMonth();
    const isToday = iso === today;
    const isSelected = iso === selectedDate;

    const dayEvents = state.events.filter((e) => e.date === iso);
    const dayTasks = state.tasks.filter((t) => t.dueDate === iso);
    const items = [
      ...dayEvents.map((e) => ({ type: "event", color: e.color, label: e.title })),
      ...dayTasks.map((t) => ({ type: "task", color: "violet", label: t.title, done: t.done })),
    ];
    const shown = items.slice(0, 2);
    const extra = items.length - shown.length;

    const createdHere = state.tasks.some((t) => toISODate(new Date(t.createdAt)) === iso)
      || state.events.some((e) => toISODate(new Date(e.createdAt)) === iso);

    html += `
      <div class="calendar-cell ${outside ? "outside" : ""} ${isToday ? "today" : ""} ${isSelected ? "selected" : ""}" data-date="${iso}">
        ${createdHere ? `<span class="calendar-created-dot" title="Se creó una tarea o evento este día"></span>` : ""}
        <div class="calendar-daynum">${cellDate.getDate()}</div>
        <div class="chips-col">
          ${shown.map((it) => `<div class="calendar-chip" style="${it.type === "event" ? `background:${colorFor(it.color)}22;color:${colorFor(it.color)}` : ""} ${it.done ? "text-decoration:line-through;opacity:.6" : ""}">${escapeHtml(it.label)}</div>`).join("")}
          ${extra > 0 ? `<div class="calendar-more">+${extra} más</div>` : ""}
        </div>
        ${items.length ? `<div class="calendar-dots" title="${items.length} elemento(s) este día">${items.slice(0, 8).map((it) => `<span class="calendar-mini-dot" style="background:${it.type === "event" ? colorFor(it.color) : "var(--accent)"}${it.done ? ";opacity:.35" : ""}"></span>`).join("")}</div>` : ""}
      </div>`;
  }

  gridEl.innerHTML = html;
  gridEl.querySelectorAll("[data-date]").forEach((cell) => {
    cell.addEventListener("click", () => {
      selectedDate = cell.dataset.date;
      renderGrid(gridEl, agendaEl);
      renderAgenda(agendaEl);
    });
  });
}

function renderAgenda(agendaEl) {
  const state = getState();
  const events = state.events.filter((e) => e.date === selectedDate)
    .sort((a, b) => (a.startTime || "") < (b.startTime || "") ? -1 : 1);
  const tasks = state.tasks.filter((t) => t.dueDate === selectedDate);
  const d = parseISODate(selectedDate);
  const dateLabel = d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

  agendaEl.innerHTML = `
    <div class="calendar-agenda-head">
      <h3>${dateLabel}</h3>
    </div>
    <div class="agenda-day-list">
      ${!events.length && !tasks.length ? `<div class="empty-state">Nada programado este día.</div>` : ""}
      ${events.map((e) => `
        <div class="agenda-item" data-event="${e.id}">
          <div class="agenda-item-time">${e.startTime || ""}</div>
          <div style="flex:1">
            <div style="font-weight:650;font-size:13.5px">${escapeHtml(e.title)}</div>
            ${e.location ? `<div style="font-size:11.5px;color:var(--text-faint)">${escapeHtml(e.location)}</div>` : ""}
          </div>
          <span class="dot" style="background:${colorFor(e.color)};margin-top:4px"></span>
        </div>
      `).join("")}
      ${tasks.map((t) => `
        <div class="agenda-item" data-task="${t.id}">
          <div class="agenda-item-time">${t.dueTime || ""}</div>
          <div style="flex:1">
            <div style="font-weight:650;font-size:13.5px;${t.done ? "text-decoration:line-through;opacity:.6" : ""}">${escapeHtml(t.title)}</div>
          </div>
          <span class="badge">${t.done ? "Hecha" : "Tarea"}</span>
        </div>
      `).join("")}
    </div>
    <div class="modal-footer-split" style="margin-top:16px">
      <button class="btn btn-sm" id="agenda-add-task">+ Tarea</button>
      <button class="btn btn-sm btn-primary" id="agenda-add-event">+ Evento</button>
    </div>
  `;

  agendaEl.querySelectorAll("[data-event]").forEach((elm) => {
    elm.addEventListener("click", () => openEventModal(events.find((e) => e.id === elm.dataset.event)));
  });
  agendaEl.querySelectorAll("[data-task]").forEach((elm) => {
    elm.addEventListener("click", () => openTaskModal(tasks.find((t) => t.id === elm.dataset.task)));
  });
  agendaEl.querySelector("#agenda-add-task").addEventListener("click", () => openTaskModal(null, selectedDate));
  agendaEl.querySelector("#agenda-add-event").addEventListener("click", () => openEventModal(null, selectedDate));
}
