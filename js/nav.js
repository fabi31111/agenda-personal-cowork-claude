// Pequeño helper para navegar entre pestañas desde cualquier vista sin
// crear dependencias circulares con app.js (que es quien escucha el evento).

export function navigateTo(view, opts = {}) {
  document.dispatchEvent(new CustomEvent("app:navigate", { detail: { view, ...opts } }));
}
