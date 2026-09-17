// Widget para vincular notas existentes a una tarea o evento (a diferencia
// de los adjuntos, no sube archivos: solo referencia notas ya creadas).

import { getState } from "./store.js";
import { escapeHtml } from "./utils.js";
import { openPopover, closeActivePopover } from "./pickers.js";
import { openNoteModal } from "./views/notes.js";

export class LinkedNotesField {
  constructor({ noteIds = [] } = {}) {
    this.ids = [...noteIds];
    this.el = document.createElement("div");
    this.el.className = "field linked-notes-field";
    this.render();
  }

  render() {
    const state = getState();
    const linked = this.ids.map((id) => state.notes.find((n) => n.id === id)).filter(Boolean);
    this.el.innerHTML = `
      <label>Notas vinculadas</label>
      <div class="attach-list">
        ${linked.length ? linked.map((n) => `
          <div class="attach-chip" data-id="${n.id}">
            <svg class="icon" style="width:16px;height:16px"><use href="#icon-notes"/></svg>
            <span class="attach-name" title="${escapeHtml(n.title)}">${escapeHtml(n.title)}</span>
            <button type="button" class="icon-btn" data-open="${n.id}" title="Abrir nota">
              <svg class="icon" style="width:15px;height:15px"><use href="#icon-edit"/></svg>
            </button>
            <button type="button" class="icon-btn danger" data-remove="${n.id}" title="Quitar">
              <svg class="icon" style="width:15px;height:15px"><use href="#icon-close"/></svg>
            </button>
          </div>
        `).join("") : `<div class="attach-empty">Sin notas vinculadas.</div>`}
      </div>
      <button type="button" class="btn btn-sm attach-upload" id="link-note-btn">
        <svg class="icon" style="width:15px;height:15px"><use href="#icon-notes"/></svg>
        <span>Vincular nota</span>
      </button>
    `;

    this.el.querySelectorAll("[data-open]").forEach((btn) => {
      btn.addEventListener("click", () => openNoteModal(state.notes.find((n) => n.id === btn.dataset.open)));
    });
    this.el.querySelectorAll("[data-remove]").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.ids = this.ids.filter((id) => id !== btn.dataset.remove);
        this.render();
      });
    });
    this.el.querySelector("#link-note-btn").addEventListener("click", () => this.openPicker());
  }

  openPicker() {
    const btn = this.el.querySelector("#link-note-btn");
    const state = getState();
    const available = state.notes.filter((n) => !this.ids.includes(n.id));

    const content = document.createElement("div");
    content.innerHTML = `
      <input type="text" class="link-note-search" placeholder="Buscar nota...">
      <div class="dt-select-list scrollbar-thin" style="margin-top:8px"></div>
    `;
    const listEl = content.querySelector(".dt-select-list");
    const searchInput = content.querySelector(".link-note-search");

    const renderList = (query = "") => {
      const q = query.trim().toLowerCase();
      const filtered = available.filter((n) => !q || n.title.toLowerCase().includes(q));
      listEl.innerHTML = filtered.length
        ? filtered.map((n) => `<button type="button" class="dt-select-opt" data-id="${n.id}"><span>${escapeHtml(n.title)}</span></button>`).join("")
        : `<div class="attach-empty">Sin notas disponibles.</div>`;
      listEl.querySelectorAll("[data-id]").forEach((optBtn) => {
        optBtn.addEventListener("click", () => {
          this.ids.push(optBtn.dataset.id);
          this.render();
          closeActivePopover();
        });
      });
    };
    renderList();
    searchInput.addEventListener("input", () => renderList(searchInput.value));

    openPopover(btn, content, { matchWidth: true });
    setTimeout(() => searchInput.focus(), 30);
  }

  getIds() {
    return this.ids;
  }
}

export function linkedNotesBadge(ids) {
  const count = (ids || []).length;
  if (!count) return "";
  return `<span class="badge"><svg class="icon" style="width:12px;height:12px"><use href="#icon-notes"/></svg>${count}</span>`;
}
