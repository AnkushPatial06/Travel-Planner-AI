/* ============================================================
   Auth — auth token/session state helpers.
   ============================================================ */

// ── Auth State ───────────────────────────────────────────────────────────────
const AUTH_KEY = 'tp_auth';
function getAuth()  { try { return JSON.parse(localStorage.getItem(AUTH_KEY)); } catch { return null; } }
function setAuth(d) { localStorage.setItem(AUTH_KEY, JSON.stringify(d)); }
function clearAuth(){ localStorage.removeItem(AUTH_KEY); }
function getToken() { const a = getAuth(); return a ? a.access_token : null; }
function getUser()  { const a = getAuth(); return a ? a.user : null; }

// ── Toast notification ────────────────────────────────────────────────────────
function showToast(message, type = 'success') {
  const t = document.createElement('div');
  t.className = `tp-toast tp-toast-${type}`;
  t.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i> ${message}`;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('tp-toast-show'));
  setTimeout(() => { t.classList.remove('tp-toast-show'); setTimeout(() => t.remove(), 400); }, 3000);
}

