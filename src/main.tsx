import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.tsx";
import "./index.css";
import "./i18n"; // Initialize i18next – must be imported before any component
import { ErrorBoundary } from "./components/ErrorBoundary";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos
      gcTime: 1000 * 60 * 30, // 30 minutos
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function showRuntimeOverlay(err: { message?: string; stack?: string } | string) {
  const msg = typeof err === 'string' ? err : (err.message || 'Error desconocido');
  const stack = typeof err === 'string' ? '' : (err.stack || '');
  
  // Log detailed error to console for debugging
  console.error('Runtime error:', msg, stack);
  
  // In production, show generic error message without stack trace
  const isProduction = import.meta.env.PROD;
  const displayMessage = isProduction 
    ? 'Ocurrió un error inesperado. Por favor, recarga la página.'
    : msg;
  const displayStack = isProduction ? '' : stack;
  
  let el = document.getElementById('__runtime_error_overlay__');
  if (!el) {
    el = document.createElement('div');
    el.id = '__runtime_error_overlay__';
    el.style.position = 'fixed';
    el.style.left = '0';
    el.style.top = '0';
    el.style.right = '0';
    el.style.bottom = '0';
    el.style.zIndex = '99999';
    el.style.background = 'rgba(0,0,0,0.6)';
    el.style.color = 'white';
    el.style.padding = '24px';
    el.style.overflow = 'auto';
    el.innerHTML = `<div style="max-width:900px;margin:48px auto;background:#111827;padding:20px;border-radius:10px;">
      <h2 style="margin:0 0 8px;color:#fecaca">Error</h2>
      <pre id="__runtime_error_text__" style="white-space:pre-wrap;color:#fff;background:transparent"></pre>
      <div style="margin-top:12px;display:flex;gap:8px"><button id="__runtime_error_reload__" style="background:#ef4444;color:white;border:none;padding:8px 12px;border-radius:6px;">Recargar</button></div>
    </div>`;
    document.body.appendChild(el);
    const btn = document.getElementById('__runtime_error_reload__');
    btn?.addEventListener('click', () => window.location.reload());
  }
  const text = document.getElementById('__runtime_error_text__');
  if (text) text.textContent = displayStack ? displayMessage + '\n\n' + displayStack : displayMessage;
}

window.addEventListener('error', (e) => {
  console.error('Global error caught:', e.error || e.message, e.error?.stack);
  showRuntimeOverlay(e.error || e.message || String(e));
});

window.addEventListener('unhandledrejection', (e) => {
  // Supabase navigatorLock AbortError on component unmount — safe to ignore
  if (e.reason instanceof Error && e.reason.name === 'AbortError') return;
  if (typeof e.reason === 'string' && e.reason.includes('aborted')) return;
  console.error('Unhandled rejection:', e.reason);
  showRuntimeOverlay(e.reason || 'Unhandled promise rejection');
});

// Check for required environment variables
const checkEnvironment = () => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    const missingVars = [];
    if (!supabaseUrl) missingVars.push('VITE_SUPABASE_URL');
    if (!supabaseKey) missingVars.push('VITE_SUPABASE_PUBLISHABLE_KEY');
    
    console.error('❌ Missing environment variables:', missingVars.join(', '));
    return false;
  }
  return true;
};

// Only render if environment is valid
if (checkEnvironment()) {
  createRoot(document.getElementById("root")!).render(
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </QueryClientProvider>
  );
} else {
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = `
      <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #071d7f 0%, #1e40af 100%); color: white; padding: 20px;">
        <div style="max-width: 600px; background: rgba(0, 0, 0, 0.3); padding: 40px; border-radius: 12px; border: 2px solid rgba(255, 255, 255, 0.2);">
          <h1 style="margin-top: 0; font-size: 28px;">⚙️ Configuración requerida</h1>
          <p style="font-size: 16px; line-height: 1.6; margin: 20px 0;">
            La aplicación no se pudo inicializar porque faltan variables de entorno críticas.
          </p>
          <div style="background: rgba(0, 0, 0, 0.5); padding: 16px; border-radius: 8px; margin: 20px 0; font-family: monospace; font-size: 14px;">
            <p style="margin: 8px 0;">Faltantes:</p>
            <ul style="margin: 8px 0; padding-left: 20px;">
              <li>VITE_SUPABASE_URL</li>
              <li>VITE_SUPABASE_PUBLISHABLE_KEY</li>
            </ul>
          </div>
          <p style="font-size: 14px; color: rgba(255, 255, 255, 0.8); margin: 20px 0;">
            Por favor, configura estas variables en tu ambiente de deployment o .env.local
          </p>
          <p style="font-size: 12px; color: rgba(255, 255, 255, 0.6);">
            Abre la consola del navegador (F12) para más detalles.
          </p>
        </div>
      </div>
    `;
  }
}
