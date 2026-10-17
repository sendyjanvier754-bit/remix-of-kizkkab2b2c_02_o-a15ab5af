/** Full-screen runtime error overlay (ported from the old main.tsx). Browser-only. */
export function showRuntimeOverlay(err: { message?: string; stack?: string } | string) {
  if (typeof document === "undefined") return;
  const msg = typeof err === "string" ? err : err.message || "Error desconocido";
  const stack = typeof err === "string" ? "" : err.stack || "";

  console.error("Runtime error:", msg, stack);

  // In production, show a generic message without the stack trace
  const isProduction = import.meta.env.PROD;
  const displayMessage = isProduction ? "Ocurrió un error inesperado. Por favor, recarga la página." : msg;
  const displayStack = isProduction ? "" : stack;

  let el = document.getElementById("__runtime_error_overlay__");
  if (!el) {
    el = document.createElement("div");
    el.id = "__runtime_error_overlay__";
    el.style.position = "fixed";
    el.style.left = "0";
    el.style.top = "0";
    el.style.right = "0";
    el.style.bottom = "0";
    el.style.zIndex = "99999";
    el.style.background = "rgba(0,0,0,0.6)";
    el.style.color = "white";
    el.style.padding = "24px";
    el.style.overflow = "auto";
    el.innerHTML = `<div style="max-width:900px;margin:48px auto;background:#111827;padding:20px;border-radius:10px;">
      <h2 style="margin:0 0 8px;color:#fecaca">Error</h2>
      <pre id="__runtime_error_text__" style="white-space:pre-wrap;color:#fff;background:transparent"></pre>
      <div style="margin-top:12px;display:flex;gap:8px"><button id="__runtime_error_reload__" style="background:#ef4444;color:white;border:none;padding:8px 12px;border-radius:6px;">Recargar</button></div>
    </div>`;
    document.body.appendChild(el);
    const btn = document.getElementById("__runtime_error_reload__");
    btn?.addEventListener("click", () => window.location.reload());
  }
  const text = document.getElementById("__runtime_error_text__");
  if (text) text.textContent = displayStack ? displayMessage + "\n\n" + displayStack : displayMessage;
}
