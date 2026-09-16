import { getState, addProject, updateProject, deleteProject, addTask, toggleTask, deleteTask } from "../store.js";
import { openModal, closeModal, showToast, confirmAction } from "../ui.js";
import { escapeHtml, PALETTE, colorFor, relativeDayLabel } from "../utils.js";

export function renderProjectsView(container) {
  const state = getState();
  const projects = [...state.projects].sort((a, b) => a.archived - b.archived || b.createdAt - a.createdAt);

  container.innerHTML = "";
  if (!projects.length) {
    container.innerHTML = `<div class="empty-state">Aún no tienes proyectos. Crea uno con "+ Nuevo proyecto".</div>`;
    return;
  }

  const grid = document.createElement("div");
  grid.className = "project-grid";
  grid.innerHTML = projects.map((p) => projectCardHtml(p, state)).join("");
  container.appendChild(grid);

  grid.querySelectorAll("[data-project]").forEach((card) => {
    card.addEventListener("click", () => openProjectDetail(card.dataset.project));
  });
}

function projectCardHtml(p, state) {
  const tasks = state.tasks.filter((t) => t.projectId === p.id);
  const done = tasks.filter((t) => t.done).length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  return `
  <div class="project-card" style="--project-color:${colorFor(p.color)}" data-project="${p.id}">
    <div class="project-card-head">
      <h3>${escapeHtml(p.name)}</h3>
      ${p.archived ? `<span class="badge">Archivado</span>` : ""}
    </div>
    <p>${escapeHtml(p.description || "Sin descripción")}</p>
    <div class="project-progress"><div class="project-progress-bar" style="width:${pct}%"></div></div>
    <div class="project-stats"><span>${done}/${tasks.length} tareas</span><span>${pct}%</span></div>
  </div>`;
}

export function openProjectModal(existing) {
  const form = document.createElement("form");
  form.innerHTML = `
    <div class="field">
      <label>Nombre</label>
      <input type="text" name="name" required value="${escapeHtml(existing?.name || "")}" placeholder="Nombre del proyecto">
    </div>
    <div class="field">
      <label>Descripción</label>
      <textarea name="description" placeholder="¿De qué se trata? (opcional)">${escapeHtml(existing?.description || "")}</textarea>
    </div>
    <div class="field">
      <label>Color</label>
      <div class="color-picker" id="color-picker">
        ${PALETTE.map((c) => `<span class="color-swatch ${((existing?.color || "violet") === c.id) ? "selected" : ""}" data-color="${c.id}" style="background:${c.value}"></span>`).join("")}
      </div>
      <input type="hidden" name="color" value="${existing?.color || "violet"}">
    </div>
    ${existing ? `
    <div class="field checkbox-row">
      <input type="checkbox" id="archived-check" name="archived" ${existing.archived ? "checked" : ""}>
      <label for="archived-check" style="margin:0">Archivar proyecto</label>
    </div>` : ""}
    <div class="modal-footer">
      ${existing ? `<button type="button" class="btn btn-danger" id="project-delete" style="margin-right:auto">Eliminar</button>` : ""}
      <button type="button" class="btn" id="project-cancel">Cancelar</button>
      <button type="submit" class="btn btn-primary">${existing ? "Guardar" : "Crear proyecto"}</button>
    </div>
  `;

  openModal(existing ? "Editar proyecto" : "Nuevo proyecto", form);

  const colorInput = form.querySelector('input[name="color"]');
  form.querySelectorAll(".color-swatch").forEach((sw) => {
    sw.addEventListener("click", () => {
      form.querySelectorAll(".color-swatch").forEach((s) => s.classList.remove("selected"));
      sw.classList.add("selected");
      colorInput.value = sw.dataset.color;
    });
  });

  form.querySelector("#project-cancel").addEventListener("click", closeModal);
  if (existing) {
    form.querySelector("#project-delete").addEventListener("click", () => {
      confirmAction("¿Eliminar este proyecto? Las tareas asociadas quedarán sin proyecto.", () => {
        deleteProject(existing.id);
        closeModal();
        showToast("Proyecto eliminado");
        document.dispatchEvent(new CustomEvent("app:refresh"));
      });
    });
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const data = {
      name: fd.get("name"),
      description: fd.get("description"),
      color: fd.get("color"),
      archived: fd.get("archived") === "on",
    };
    if (!data.name.trim()) return;
    if (existing) {
      updateProject(existing.id, data);
      showToast("Proyecto actualizado");
    } else {
      addProject(data);
      showToast("Proyecto creado");
    }
    closeModal();
    document.dispatchEvent(new CustomEvent("app:refresh"));
  });
}

function openProjectDetail(projectId) {
  const state = getState();
  const project = state.projects.find((p) => p.id === projectId);
  if (!project) return;
  const tasks = state.tasks.filter((t) => t.projectId === projectId)
    .sort((a, b) => a.done - b.done || (a.dueDate || "9999") < (b.dueDate || "9999") ? -1 : 1);

  const wrap = document.createElement("div");
  render();
  openModal(project.name, wrap, {});

  function render() {
    wrap.innerHTML = `
      <p style="font-size:13.5px;color:var(--text-dim);margin-bottom:14px;">${escapeHtml(project.description || "Sin descripción")}</p>
      <div class="quick-add">
        <input type="text" id="quick-task-title" placeholder="Añadir tarea a este proyecto...">
        <button class="btn btn-primary btn-sm" id="quick-task-add"><svg class="icon"><use href="#icon-plus"/></svg></button>
      </div>
      <div class="list" id="project-task-list"></div>
      <div class="modal-footer-split">
        <button class="btn btn-sm" id="project-edit-btn"><svg class="icon"><use href="#icon-edit"/></svg> Editar proyecto</button>
      </div>
    `;
    const listEl = wrap.querySelector("#project-task-list");
    if (!tasks.length) {
      listEl.innerHTML = `<div class="empty-state">Sin tareas todavía.</div>`;
    } else {
      listEl.innerHTML = tasks.map((t) => `
        <div class="task-item ${t.done ? "done" : ""}">
          <div class="task-check ${t.done ? "checked" : ""}" data-check="${t.id}"><svg class="icon"><use href="#icon-check"/></svg></div>
          <div class="task-body">
            <div class="task-title">${escapeHtml(t.title)}</div>
            ${t.dueDate ? `<div class="task-meta"><span class="badge badge-accent">${relativeDayLabel(t.dueDate)}</span></div>` : ""}
          </div>
          <div class="task-actions">
            <button class="icon-btn danger" data-del="${t.id}"><svg class="icon"><use href="#icon-trash"/></svg></button>
          </div>
        </div>`).join("");
      listEl.querySelectorAll("[data-check]").forEach((elm) => {
        elm.addEventListener("click", () => {
          toggleTask(elm.dataset.check);
          const t = tasks.find((x) => x.id === elm.dataset.check);
          t.done = !t.done;
          render();
          document.dispatchEvent(new CustomEvent("app:refresh-silent"));
        });
      });
      listEl.querySelectorAll("[data-del]").forEach((elm) => {
        elm.addEventListener("click", () => {
          confirmAction("¿Eliminar esta tarea?", () => {
            deleteTask(elm.dataset.del);
            const idx = tasks.findIndex((x) => x.id === elm.dataset.del);
            if (idx > -1) tasks.splice(idx, 1);
            render();
            document.dispatchEvent(new CustomEvent("app:refresh-silent"));
          });
        });
      });
    }

    wrap.querySelector("#quick-task-add").addEventListener("click", addQuick);
    wrap.querySelector("#quick-task-title").addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); addQuick(); }
    });
    wrap.querySelector("#project-edit-btn").addEventListener("click", () => openProjectModal(project));
  }

  function addQuick() {
    const input = wrap.querySelector("#quick-task-title");
    const title = input.value.trim();
    if (!title) return;
    const t = addTask({ title, projectId });
    tasks.unshift(t);
    input.value = "";
    render();
    document.dispatchEvent(new CustomEvent("app:refresh-silent"));
  }
}
