// Store central con persistencia en localStorage.

import { uid, todayISO } from "./utils.js";

const STORAGE_KEY = "agenda-personal-v1";

const DEFAULT_STATE = {
  version: 1,
  theme: "auto", // "light" | "dark" | "auto"
  projects: [],
  tasks: [],
  events: [],
  notes: [],
  scheduleBlocks: [],
  seeded: false,
};

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    return { ...structuredClone(DEFAULT_STATE), ...parsed };
  } catch (e) {
    console.error("No se pudo leer el almacenamiento local", e);
    return structuredClone(DEFAULT_STATE);
  }
}

let state = load();
const listeners = new Set();

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function notify() {
  persist();
  listeners.forEach((fn) => fn(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getState() {
  return state;
}

export function setTheme(theme) {
  state.theme = theme;
  notify();
}

/* ---------------------------- Proyectos ---------------------------- */

export function addProject(data) {
  const project = {
    id: uid(),
    name: data.name.trim(),
    description: data.description?.trim() || "",
    color: data.color || "violet",
    archived: false,
    createdAt: Date.now(),
  };
  state.projects.push(project);
  notify();
  return project;
}

export function updateProject(id, patch) {
  const p = state.projects.find((x) => x.id === id);
  if (!p) return;
  Object.assign(p, patch);
  notify();
}

export function deleteProject(id) {
  state.projects = state.projects.filter((p) => p.id !== id);
  state.tasks.forEach((t) => { if (t.projectId === id) t.projectId = null; });
  notify();
}

/* ---------------------------- Tareas ---------------------------- */

export function addTask(data) {
  const task = {
    id: uid(),
    title: data.title.trim(),
    description: data.description?.trim() || "",
    done: false,
    dueDate: data.dueDate || null,
    dueTime: data.dueTime || null,
    priority: data.priority || "normal", // low | normal | high
    projectId: data.projectId || null,
    createdAt: Date.now(),
  };
  state.tasks.push(task);
  notify();
  return task;
}

export function updateTask(id, patch) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) return;
  Object.assign(t, patch);
  notify();
}

export function toggleTask(id) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) return;
  t.done = !t.done;
  t.completedAt = t.done ? Date.now() : null;
  notify();
}

export function deleteTask(id) {
  state.tasks = state.tasks.filter((t) => t.id !== id);
  notify();
}

/* ---------------------------- Eventos ---------------------------- */

export function addEvent(data) {
  const event = {
    id: uid(),
    title: data.title.trim(),
    description: data.description?.trim() || "",
    date: data.date,
    startTime: data.startTime || null,
    endTime: data.endTime || null,
    location: data.location?.trim() || "",
    color: data.color || "violet",
    createdAt: Date.now(),
  };
  state.events.push(event);
  notify();
  return event;
}

export function updateEvent(id, patch) {
  const e = state.events.find((x) => x.id === id);
  if (!e) return;
  Object.assign(e, patch);
  notify();
}

export function deleteEvent(id) {
  state.events = state.events.filter((e) => e.id !== id);
  notify();
}

/* ---------------------------- Notas ---------------------------- */

export function addNote(data) {
  const note = {
    id: uid(),
    title: data.title.trim() || "Sin título",
    content: data.content || "",
    tags: data.tags || [],
    color: data.color || "violet",
    pinned: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  state.notes.push(note);
  notify();
  return note;
}

export function updateNote(id, patch) {
  const n = state.notes.find((x) => x.id === id);
  if (!n) return;
  Object.assign(n, patch, { updatedAt: Date.now() });
  notify();
}

export function togglePinNote(id) {
  const n = state.notes.find((x) => x.id === id);
  if (!n) return;
  n.pinned = !n.pinned;
  notify();
}

export function deleteNote(id) {
  state.notes = state.notes.filter((n) => n.id !== id);
  notify();
}

/* ---------------------------- Horario ---------------------------- */

export function addScheduleBlock(data) {
  const block = {
    id: uid(),
    day: data.day, // 0-6, lunes=0
    startMin: data.startMin,
    endMin: data.endMin,
    title: data.title.trim(),
    color: data.color || "violet",
  };
  state.scheduleBlocks.push(block);
  notify();
  return block;
}

export function updateScheduleBlock(id, patch) {
  const b = state.scheduleBlocks.find((x) => x.id === id);
  if (!b) return;
  Object.assign(b, patch);
  notify();
}

export function deleteScheduleBlock(id) {
  state.scheduleBlocks = state.scheduleBlocks.filter((b) => b.id !== id);
  notify();
}

/* ---------------------------- Seed inicial ---------------------------- */

export function seedIfEmpty() {
  if (state.seeded) return;
  state.seeded = true;

  const project = {
    id: uid(),
    name: "Bienvenida",
    description: "Un proyecto de ejemplo. Puedes editarlo o borrarlo.",
    color: "violet",
    archived: false,
    createdAt: Date.now(),
  };
  state.projects.push(project);

  state.tasks.push({
    id: uid(),
    title: "Explorar la agenda",
    description: "Revisa las pestañas: Tareas, Proyectos, Eventos, Notas, Calendario y Horario.",
    done: false,
    dueDate: todayISO(),
    dueTime: null,
    priority: "normal",
    projectId: project.id,
    createdAt: Date.now(),
  });

  state.notes.push({
    id: uid(),
    title: "Bienvenida a tu agenda",
    content: "Esta es tu agenda personal.\n\n- Hoy: resumen del día.\n- Tareas: pendientes con fecha y prioridad.\n- Proyectos: agrupa tareas relacionadas.\n- Eventos: citas con hora y lugar.\n- Notas: ideas y apuntes.\n- Calendario: vista mensual de eventos y tareas.\n- Horario: tu planilla semanal.",
    tags: ["bienvenida"],
    color: "amber",
    pinned: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  notify();
}
