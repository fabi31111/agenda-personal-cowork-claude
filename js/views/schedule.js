import { getState, addScheduleBlock, updateScheduleBlock, deleteScheduleBlock } from "../store.js";
import { openModal, closeModal, showToast, confirmAction } from "../ui.js";
import {
  escapeHtml, DOW_LABELS, DOW_LABELS_FULL, MONTH_LABELS, PALETTE, colorFor,
  minutesToTime, timeToMinutes, startOfWeek, addDays, toISODate, todayISO,
} from "../utils.js";
import { createTimePicker, createSelectPicker } from "../pickers.js";

const START_HOUR = 6;
const END_HOUR = 23; // exclusivo, última franja termina a las 23:00
const ROWS = (END_HOUR - START_HOUR) * 2; // franjas de 30 min

let weekOffset = 0;

function getWeekStart() {
  return addDays(startOfWeek(new Date()), weekOffset * 7);
}

function formatWeekRange(weekStart) {
  const weekEnd = addDays(weekStart, 6);
  if (weekStart.getMonth() === weekEnd.getMonth()) {
    return `${weekStart.getDate()}–${weekEnd.getDate()} de ${MONTH_LABELS[weekStart.getMonth()].toLowerCase()}`;
  }
  return `${weekStart.getDate()} ${MONTH_LABELS[weekStart.getMonth()].slice(0, 3).toLowerCase()} – ${weekEnd.getDate()} ${MONTH_LABELS[weekEnd.getMonth()].slice(0, 3).toLowerCase()}`;
}

export function renderScheduleView(container) {
  container.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <div class="calendar-header">
      <div class="calendar-title" id="week-title"></div>
      <div class="calendar-nav">
        <button class="icon-btn" id="week-prev"><svg class="icon"><use href="#icon-chevron-left"/></svg></button>
        <button class="btn btn-sm" id="week-today">Esta semana</button>
        <button class="icon-btn" id="week-next"><svg class="icon"><use href="#icon-chevron-right"/></svg></button>
      </div>
    </div>
    <div class="schedule-wrap scrollbar-thin"><div class="schedule-grid" id="schedule-grid"></div></div>
  `;
  container.appendChild(wrap);

  wrap.querySelector("#week-prev").addEventListener("click", () => {
    weekOffset -= 1;
    renderScheduleView(container);
  });
  wrap.querySelector("#week-next").addEventListener("click", () => {
    weekOffset += 1;
    renderScheduleView(container);
  });
  wrap.querySelector("#week-today").addEventListener("click", () => {
    weekOffset = 0;
    renderScheduleView(container);
  });

  const weekStart = getWeekStart();
  wrap.querySelector("#week-title").textContent = formatWeekRange(weekStart);

  renderGrid(wrap.querySelector("#schedule-grid"), weekStart);
}

function renderGrid(gridEl, weekStart) {
  const state = getState();
  const today = todayISO();
  gridEl.style.gridTemplateRows = `auto repeat(${ROWS}, 22px)`;

  let html = `<div class="schedule-corner"></div>`;
  for (let d = 0; d < 7; d++) {
    const dayDate = addDays(weekStart, d);
    const isToday = toISODate(dayDate) === today;
    html += `<div class="schedule-dow ${isToday ? "today" : ""}">${DOW_LABELS[d]} ${dayDate.getDate()}/${dayDate.getMonth() + 1}</div>`;
  }

  for (let r = 0; r < ROWS; r++) {
    const rowLine = r + 2;
    if (r % 2 === 0) {
      const label = minutesToTime(START_HOUR * 60 + r * 30);
      html += `<div class="schedule-timecol" style="grid-column:1;grid-row:${rowLine} / span 2">${label}</div>`;
    }
    for (let d = 0; d < 7; d++) {
      html += `<div class="schedule-cell ${r % 2 ? "half-hour" : ""}" style="grid-column:${d + 2};grid-row:${rowLine}" data-day="${d}" data-row="${r}"></div>`;
    }
  }

  state.scheduleBlocks.forEach((b) => {
    const startRow = Math.max(0, Math.round((b.startMin - START_HOUR * 60) / 30));
    const endRow = Math.min(ROWS, Math.round((b.endMin - START_HOUR * 60) / 30));
    if (endRow <= startRow) return;
    html += `
      <div class="schedule-block" style="grid-column:${b.day + 2};grid-row:${startRow + 2} / ${endRow + 2};background:${colorFor(b.color)}" data-block="${b.id}">
        <span class="block-time">${minutesToTime(b.startMin)}–${minutesToTime(b.endMin)}</span>
        ${escapeHtml(b.title)}
      </div>`;
  });

  gridEl.innerHTML = html;

  gridEl.querySelectorAll(".schedule-cell").forEach((cell) => {
    cell.addEventListener("click", () => {
      const day = Number(cell.dataset.day);
      const row = Number(cell.dataset.row);
      const startMin = START_HOUR * 60 + row * 30;
      const endMin = Math.min(END_HOUR * 60, startMin + 60);
      openBlockModal(null, { day, startMin, endMin });
    });
  });
  gridEl.querySelectorAll(".schedule-block").forEach((blockEl) => {
    blockEl.addEventListener("click", () => {
      openBlockModal(state.scheduleBlocks.find((b) => b.id === blockEl.dataset.block));
    });
  });
}

export function openBlockModal(existing, defaults) {
  const day = existing?.day ?? defaults?.day ?? 0;
  const startMin = existing?.startMin ?? defaults?.startMin ?? START_HOUR * 60;
  const endMin = existing?.endMin ?? defaults?.endMin ?? startMin + 60;

  const form = document.createElement("form");
  form.innerHTML = `
    <div class="field">
      <label>Actividad</label>
      <input type="text" name="title" required value="${escapeHtml(existing?.title || "")}" placeholder="Ej: Clase de matemáticas">
    </div>
    <div class="field">
      <label>Día</label>
      <div data-slot="day"></div>
    </div>
    <div class="field-row">
      <div class="field">
        <label>Hora inicio</label>
        <div data-slot="start"></div>
      </div>
      <div class="field">
        <label>Hora fin</label>
        <div data-slot="end"></div>
      </div>
    </div>
    <div class="field">
      <label>Color</label>
      <div class="color-picker" id="color-picker">
        ${PALETTE.map((c) => `<span class="color-swatch ${((existing?.color || "violet") === c.id) ? "selected" : ""}" data-color="${c.id}" style="background:${c.value}"></span>`).join("")}
      </div>
      <input type="hidden" name="color" value="${existing?.color || "violet"}">
    </div>
    <div class="modal-footer">
      ${existing ? `<button type="button" class="btn btn-danger" id="block-delete" style="margin-right:auto">Eliminar</button>` : ""}
      <button type="button" class="btn" id="block-cancel">Cancelar</button>
      <button type="submit" class="btn btn-primary">${existing ? "Guardar" : "Añadir"}</button>
    </div>
  `;

  const dayPicker = createSelectPicker({
    name: "day",
    value: day,
    options: DOW_LABELS_FULL.map((label, i) => ({ value: i, label })),
  });
  form.querySelector('[data-slot="day"]').replaceWith(dayPicker.el);

  const startPicker = createTimePicker({ name: "start", value: minutesToTime(startMin), allowClear: false, minuteStep: 1 });
  form.querySelector('[data-slot="start"]').replaceWith(startPicker.el);
  const endPicker = createTimePicker({ name: "end", value: minutesToTime(endMin), allowClear: false, minuteStep: 1 });
  form.querySelector('[data-slot="end"]').replaceWith(endPicker.el);

  openModal(existing ? "Editar actividad" : "Nueva actividad", form);

  const colorInput = form.querySelector('input[name="color"]');
  form.querySelectorAll(".color-swatch").forEach((sw) => {
    sw.addEventListener("click", () => {
      form.querySelectorAll(".color-swatch").forEach((s) => s.classList.remove("selected"));
      sw.classList.add("selected");
      colorInput.value = sw.dataset.color;
    });
  });

  form.querySelector("#block-cancel").addEventListener("click", closeModal);
  if (existing) {
    form.querySelector("#block-delete").addEventListener("click", () => {
      confirmAction("¿Eliminar esta actividad del horario?", () => {
        deleteScheduleBlock(existing.id);
        closeModal();
        showToast("Actividad eliminada");
        document.dispatchEvent(new CustomEvent("app:refresh"));
      });
    });
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const startM = timeToMinutes(fd.get("start"));
    let endM = timeToMinutes(fd.get("end"));
    if (endM <= startM) endM = startM + 30;
    const data = {
      title: fd.get("title"),
      day: Number(fd.get("day")),
      startMin: startM,
      endMin: endM,
      color: fd.get("color"),
    };
    if (!data.title.trim()) return;
    if (existing) {
      updateScheduleBlock(existing.id, data);
      showToast("Actividad actualizada");
    } else {
      addScheduleBlock(data);
      showToast("Actividad añadida");
    }
    closeModal();
    document.dispatchEvent(new CustomEvent("app:refresh"));
  });
}
