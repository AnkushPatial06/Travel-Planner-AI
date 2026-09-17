/* ============================================================
   Core — backend config, global app state, and shared DOM references.
   ============================================================ */

/* ============================================================
   BOOKING.AI — APP LOGIC v2.0
   ============================================================ */

// ── Backend Configuration ──────────────────────────────────
const BACKEND_URL = (
  window.location.protocol === 'file:' ||
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1'
) ? 'http://127.0.0.1:8000' : '';

// ── State ──────────────────────────────────────────────────
let currentTripData = null;
let selectedFlight    = null;
let selectedHotel     = null;
let tripNights        = 1;
let hotelsData        = [];
let flightsData       = [];
let searchAbortController = null;
let loadingStepsInterval  = null;

// ── DOM Refs ──────────────────────────────────────────────
const searchForm      = document.getElementById('search-form');
const outboundInput   = document.getElementById('outbound-date');
const returnInput     = document.getElementById('return-date');
const budgetInput     = document.getElementById('budget');
const loadingEl       = document.getElementById('loading');
const welcomeEl       = document.getElementById('welcome-screen');
const resultsEl       = document.getElementById('results-section');
const tabBtns         = document.querySelectorAll('.tab-btn');
const tabPanels       = document.querySelectorAll('.tab-panel');

// Budget sidebar refs
const elTotalBudget   = document.getElementById('display-total-budget');
const elTotalSpent    = document.getElementById('display-total-spent');
const elRemaining     = document.getElementById('display-remaining');
const elProgress      = document.getElementById('budget-progress');
const elStatus        = document.getElementById('budget-status');
const elFlight        = document.getElementById('breakdown-flight');
const elStay          = document.getElementById('breakdown-stay');
const elDonutFill     = document.getElementById('donut-fill');
const elDonutPct      = document.getElementById('donut-pct');
const elSelFlight     = document.getElementById('bc-sel-flight');
const elSelHotel      = document.getElementById('bc-sel-hotel');

// ── Init Dates ─────────────────────────────────────────────
function splitLines(value) {
  return (value || '').split(/\r?\n|,/).map(v => v.trim()).filter(Boolean);
}

async function setPackageStatus(packageId, status, btn) {
  btn.disabled = true;
  try {
    await apiUpdatePackageStatus(packageId, status);
    showToast(`Package marked ${status}.`);
    loadDashPackages();
    loadPackagesSection();
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
  }
}

async function deleteDashPackage(packageId, btn) {
  btn.disabled = true;
  try {
    await apiDeletePackage(packageId);
    showToast('Package deleted.');
    loadDashPackages();
    loadPackagesSection();
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
  }
}

async function loadDashChats() {
  const list = document.getElementById('dash-chats-list');
  if (!list) return;
  list.innerHTML = '<div class="dest-loading"><i class="fa-solid fa-circle-notch fa-spin"></i></div>';
  const rooms = await apiGetChatRooms();
  list.innerHTML = rooms.length ? rooms.map(room => `
    <div class="request-card">
      <div class="request-card-top">
        <strong>${escHtml(room.traveler?.name || room.planner?.name || 'Traveler')}</strong>
        <span class="request-status-badge accepted">Chat</span>
      </div>
      <div class="request-card-meta"><span><i class="fa-solid fa-clock"></i> ${new Date(room.updated_at).toLocaleString('en-IN')}</span></div>
      <div class="request-card-actions">
        <button class="request-action-btn" onclick="openExistingUserChat(${room.id})"><i class="fa-solid fa-comments"></i> Open Chat</button>
      </div>
    </div>`).join('') : '<p class="empty-state">No chats yet.</p>';
}

async function loadDashBlogs() {
  const sel = document.getElementById('blog-destination');
  if (sel && sel.options.length < 2) {
    const dests = window._allDestinations && window._allDestinations.length ? window._allDestinations : await apiGetDestinations();
    sel.innerHTML = dests.map(d => `<option value="${d.id}">${escHtml(d.name)}</option>`).join('');
  }
}

async function handleDashBlogSubmit(e) {
  e.preventDefault();
  const errEl = document.getElementById('dash-blog-error');
  const btn = document.getElementById('dash-blog-submit');
  errEl.textContent = '';
  btn.disabled = true;
  try {
    await apiCreateBlog({
      destination_id: parseInt(document.getElementById('blog-destination').value),
      title: document.getElementById('blog-title').value,
      content: document.getElementById('blog-content').value,
      image_url: document.getElementById('blog-image').value || null,
    });
    showToast('Blog published.');
    document.getElementById('dash-blog-form').reset();
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Publish Blog';
  }
}

document.addEventListener('DOMContentLoaded', () => {
    const today    = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const nextWeek = new Date(tomorrow);
    nextWeek.setDate(tomorrow.getDate() + 6);

    if (outboundInput) {
        outboundInput.value = formatDate(tomorrow);
    }

    if (returnInput) {
        returnInput.value = formatDate(nextWeek);
    }

    // Nav scroll style
    window.addEventListener('scroll', () => {
        const topnav =
            document.getElementById('topnav');

        if (topnav) {
            topnav.style.boxShadow =
                window.scrollY > 10
                    ? '0 4px 24px rgba(0,0,0,.35)'
                    : '0 2px 12px rgba(0,0,0,.3)';
        }
    });

    // Initial budget display
    updateBudgetTracker(50000);
});

