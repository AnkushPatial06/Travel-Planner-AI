/* ============================================================
   Modals — Trip Request modal, Review modal, and My Trips tab content loaders.
   ============================================================ */

/* ============================================================
   TRIP REQUEST MODAL
   ============================================================ */
function openRequestModal({ plannerId = null, destinationId = null, packageId = null } = {}) {
  if (!getToken()) {
    window._pendingAfterLogin = () => openRequestModal({ plannerId, destinationId, packageId });
    openAuthModal('login');
    showToast('Sign in to request a trip', 'error');
    return;
  }
  const modal = document.getElementById('request-modal');
  if (!modal) return;
  document.getElementById('req-planner-id').value = plannerId ?? '';
  document.getElementById('req-destination-id').value = destinationId ?? '';
  document.getElementById('req-package-id').value = packageId ?? '';
  document.getElementById('request-error').textContent = '';
  const today = new Date();
  const in7 = new Date(today); in7.setDate(today.getDate() + 7);
  const in12 = new Date(today); in12.setDate(today.getDate() + 12);
  document.getElementById('req-start-date').value = formatDate(in7);
  document.getElementById('req-end-date').value = formatDate(in12);
  modal.classList.remove('hidden');
}
function closeRequestModal() { document.getElementById('request-modal')?.classList.add('hidden'); }

async function handleRequestSubmit(e) {
  e.preventDefault();
  const errEl = document.getElementById('request-error');
  const btn = document.getElementById('request-submit-btn');
  errEl.textContent = '';
  const plannerId = document.getElementById('req-planner-id').value;
  const destinationId = document.getElementById('req-destination-id').value;
  const start = document.getElementById('req-start-date').value;
  const end = document.getElementById('req-end-date').value;
  if (new Date(start) >= new Date(end)) { errEl.textContent = 'End date must be after start date.'; return; }
  btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Sending…';
  try {
    await apiCreateTripRequest({
      planner_id: plannerId ? parseInt(plannerId) : null,
      destination_id: destinationId ? parseInt(destinationId) : null,
      start_date: new Date(start).toISOString(),
      end_date: new Date(end).toISOString(),
      travelers_count: parseInt(document.getElementById('req-travelers').value) || 1,
      budget: parseFloat(document.getElementById('req-budget').value) || null,
      travel_style: document.getElementById('req-style').value || null,
      requirements: document.getElementById('req-requirements').value || null,
    });
    showToast('Trip request sent! The planner will respond soon. ✈️');
    closeRequestModal();
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    btn.disabled = false; btn.textContent = 'Send Request';
  }
}

/* ============================================================
   REVIEW MODAL
   ============================================================ */
let _reviewRating = 5;
function openReviewModal(plannerUserId = null, destinationId = null) {
  if (!getToken()) {
    window._pendingAfterLogin = () => openReviewModal(plannerUserId, destinationId);
    openAuthModal('login');
    showToast('Sign in to leave a review', 'error');
    return;
  }
  const modal = document.getElementById('review-modal');
  if (!modal) return;
  document.getElementById('rev-planner-id').value = plannerUserId ?? '';
  document.getElementById('rev-destination-id').value = destinationId ?? '';
  document.getElementById('rev-text').value = '';
  document.getElementById('review-error').textContent = '';
  setStarRating(5);
  modal.classList.remove('hidden');
}
function closeReviewModal() { document.getElementById('review-modal')?.classList.add('hidden'); }
function setStarRating(val) {
  _reviewRating = val;
  document.getElementById('rev-rating').value = val;
  document.querySelectorAll('#review-star-picker i').forEach(star => {
    star.classList.toggle('active', parseInt(star.getAttribute('data-val')) <= val);
  });
}
async function handleReviewSubmit(e) {
  e.preventDefault();
  const errEl = document.getElementById('review-error');
  const btn = document.getElementById('review-submit-btn');
  errEl.textContent = '';
  btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Submitting…';
  try {
    await apiCreateReview({
      planner_id: document.getElementById('rev-planner-id').value ? parseInt(document.getElementById('rev-planner-id').value) : null,
      destination_id: document.getElementById('rev-destination-id').value ? parseInt(document.getElementById('rev-destination-id').value) : null,
      rating: _reviewRating,
      review_text: document.getElementById('rev-text').value || null,
    });
    showToast('Thanks for your review! ⭐');
    closeReviewModal();
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    btn.disabled = false; btn.textContent = 'Submit Review';
  }
}

/* ============================================================
   MY TRIPS MODAL — tabs (AI Itineraries / Trip Requests / Favorites)
   ============================================================ */
async function loadMyRequestsTab() {
  const list = document.getElementById('my-requests-list');
  list.innerHTML = '<div class="dest-loading"><i class="fa-solid fa-circle-notch fa-spin"></i></div>';
  const requests = await apiGetMyTripRequests();
  if (!requests.length) { list.innerHTML = '<p class="empty-state">No trip requests yet. Visit a planner or package page to request a trip.</p>'; return; }
  list.innerHTML = requests.map(requestCardHtml).join('');
}
async function loadMyFavoritesTab() {
  const list = document.getElementById('my-favorites-list');
  list.innerHTML = '<div class="dest-loading"><i class="fa-solid fa-circle-notch fa-spin"></i></div>';
  favoritesCache = await apiGetFavorites();
  if (!favoritesCache.length) {
    list.innerHTML = '<p class="empty-state"><i class="fa-solid fa-heart" style="font-size:2rem;display:block;margin-bottom:12px;opacity:.3;color:var(--red)"></i>No favorites yet.<br>Tap the <i class="fa-solid fa-heart" style="color:var(--red)"></i> heart icon on any destination, planner, or package.</p>';
    return;
  }

  // Use cached data for name lookups
  const allDests = window._allDestinations || [];
  const allPlanners = window._allPlanners || [];
  const allPkgs = window._allPackages || [];

  list.innerHTML = favoritesCache.map(f => {
    let type, icon, name, clickFn;
    if (f.planner_id) {
      type = 'Planner'; icon = 'fa-user-tie';
      const p = allPlanners.find(pl => pl.user_id === f.planner_id);
      name = p ? p.name : `Planner #${f.planner_id}`;
      clickFn = `openPlannerModal(${allPlanners.find(pl=>pl.user_id===f.planner_id)?.id || 0})`;
    } else if (f.package_id) {
      type = 'Package'; icon = 'fa-suitcase-rolling';
      const pkg = allPkgs.find(pk => pk.id === f.package_id);
      name = pkg ? pkg.title : `Package #${f.package_id}`;
      clickFn = `openPackageModal(${f.package_id})`;
    } else {
      type = 'Destination'; icon = 'fa-map-location-dot';
      const d = allDests.find(de => de.id === f.destination_id);
      name = d ? d.name : `Destination #${f.destination_id}`;
      clickFn = `openDestinationModal(${f.destination_id})`;
    }
    const date = new Date(f.created_at).toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'});
    return `
      <div class="saved-trip-card" style="cursor:pointer" onclick="${clickFn}">
        <div class="stc-header">
          <span class="stc-dest"><i class="fa-solid ${icon}"></i> <strong>${type}</strong>: ${escHtml(name)}</span>
          <span class="stc-date">${date}</span>
        </div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button class="request-action-btn" onclick="event.stopPropagation();${clickFn}"><i class="fa-solid fa-eye"></i> View</button>
          <button class="request-action-btn danger" onclick="event.stopPropagation();removeFavFromTab(${f.id},this)"><i class="fa-solid fa-heart-broken"></i> Remove</button>
        </div>
      </div>`;
  }).join('');
}

async function removeFavFromTab(favId, btn) {
  btn.disabled = true;
  try {
    await apiRemoveFavorite(favId);
    favoritesCache = favoritesCache.filter(f => f.id !== favId);
    const card = btn.closest('.saved-trip-card');
    if (card) card.remove();
    showToast('Removed from favorites');
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
  }
}
function requestCardHtml(t) {
  const statusClass = (t.status || 'pending').toLowerCase();
  const start = new Date(t.start_date).toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'});
  const end = new Date(t.end_date).toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'});
  const user = getUser();
  const isPlannerSide = user && (t.planner_id === user.id);
  const actions = isPlannerSide && statusClass === 'pending' ? `
      <div class="request-card-actions">
        <button class="request-action-btn" data-trip-id="${t.id}" data-status="accepted">Accept</button>
        <button class="request-action-btn danger" data-trip-id="${t.id}" data-status="rejected">Decline</button>
      </div>` : (isPlannerSide && statusClass === 'accepted' ? `
      <div class="request-card-actions">
        <button class="request-action-btn" data-trip-id="${t.id}" data-status="completed">Mark Completed</button>
      </div>` : '');
  return `
    <div class="request-card">
      <div class="request-card-top">
        <strong>Trip Request #${t.id}</strong>
        <span class="request-status-badge ${statusClass}">${escHtml(t.status)}</span>
      </div>
      <div class="request-card-meta">
        <span><i class="fa-solid fa-calendar"></i> ${start} → ${end}</span>
        <span><i class="fa-solid fa-users"></i> ${t.travelers_count} traveler${t.travelers_count !== 1 ? 's' : ''}</span>
        ${t.budget ? `<span><i class="fa-solid fa-indian-rupee-sign"></i> ₹${Number(t.budget).toLocaleString('en-IN')}</span>` : ''}
        ${t.travel_style ? `<span><i class="fa-solid fa-tag"></i> ${escHtml(t.travel_style)}</span>` : ''}
      </div>
      ${t.requirements ? `<p style="font-size:.85rem;color:var(--text-2);margin-bottom:10px">${escHtml(t.requirements)}</p>` : ''}
      ${actions}
    </div>`;
}
function wireRequestActions(container) {
  container.querySelectorAll('.request-action-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tripId = btn.getAttribute('data-trip-id');
      const status = btn.getAttribute('data-status');
      btn.disabled = true;
      try {
        await apiUpdateTripStatus(tripId, status);
        showToast(`Trip request marked as ${status}.`);
        if (document.getElementById('dash-requests')?.classList.contains('active')) loadDashRequests();
        if (document.getElementById('mt-requests')?.classList.contains('active')) loadMyRequestsTab();
      } catch (err) {
        showToast(err.message, 'error');
        btn.disabled = false;
      }
    });
  });
}

function switchMyTripsTab(tabId) {
  document.querySelectorAll('#mt-tabs .mt-tab-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-mt-tab') === tabId));
  document.querySelectorAll('#my-trips-modal .mt-panel').forEach(p => p.classList.toggle('active', p.id === tabId));
  if (tabId === 'mt-requests') loadMyRequestsTab().then(() => wireRequestActions(document.getElementById('my-requests-list')));
  if (tabId === 'mt-favorites') loadMyFavoritesTab();
}

