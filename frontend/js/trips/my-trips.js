/* ============================================================
   Trips — save itinerary + 'My Trips' modal shell.
   ============================================================ */

// ── Save itinerary ────────────────────────────────────────────────────────────
async function handleSaveItinerary() {
  if (!getToken()) {
    window._pendingAfterLogin = handleSaveItinerary;
    openAuthModal('login');
    showToast('Please sign in to save your trip', 'error');
    return;
  }
  const btn = document.getElementById('btn-save-itinerary');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Saving…'; }
  try {
    const sDate = document.getElementById('search-date')?.value || null;
    const eDate = document.getElementById('search-return')?.value || null;
    const travelers = parseInt(document.getElementById('search-travelers')?.value || 1);
    const budget = document.getElementById('search-budget')?.value || null;

    await apiSaveAITrip({
      destination_name: window._lastDestination || 'Unknown',
      generated_itinerary: window._lastItinerary || '',
      start_date: sDate,
      end_date: eDate,
      travelers_count: travelers,
      budget: budget,
      preferences: {},
    });
    showToast('Itinerary saved to your account! 🎉');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-bookmark"></i> Save Trip'; }
  }
}

// ── My Trips Modal ────────────────────────────────────────────────────────────
async function openMyTripsModal() {
  if (!getToken()) {
    openAuthModal('login');
    showToast('Sign in to view your saved trips', 'error');
    return;
  }
  const modal = document.getElementById('my-trips-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  switchMyTripsTab('mt-ai-trips');
  const list = document.getElementById('my-trips-list');
  list.innerHTML = '<div class="dest-loading"><i class="fa-solid fa-circle-notch fa-spin"></i></div>';
  const trips = await apiGetMyTrips();
  if (!trips.length) {
    list.innerHTML = '<p class="empty-state"><i class="fa-solid fa-suitcase-rolling" style="font-size:2rem;display:block;margin-bottom:12px;opacity:.3"></i>No saved trips yet.<br>Search for a destination, generate an itinerary, and tap <strong>Save Trip</strong>.</p>';
    return;
  }
  list.innerHTML = trips.map(t => {
    const date = new Date(t.created_at).toLocaleDateString('en-IN', {day: 'numeric', month: 'short', year: 'numeric'});
    const preview = (t.generated_itinerary || '').substring(0, 200).replace(/#+\s*/g, '').replace(/\*\*/g, '').trim();
    const budgetHtml = t.budget ? `<span style="margin-left:auto;font-weight:700;color:var(--brand)">₹${Number(t.budget).toLocaleString('en-IN')}</span>` : '';
    return `
      <div class="saved-trip-card">
        <div class="stc-header">
          <span class="stc-dest"><i class="fa-solid fa-location-dot"></i> ${t.destination_name || 'Unknown'}</span>
          ${budgetHtml}
          <span class="stc-date">${date}</span>
        </div>
        <p class="stc-preview">${preview}…</p>
        <div style="display:flex;gap:8px;margin-top:10px">
          <button class="request-action-btn" onclick="expandItinerary(${t.id}, this)" data-trip-id="${t.id}">
            <i class="fa-solid fa-eye"></i> View
          </button>
          <button class="request-action-btn danger" onclick="deleteAITrip(${t.id}, this)">
            <i class="fa-solid fa-trash"></i> Delete
          </button>
        </div>
        <div class="expanded-itinerary" id="exp-${t.id}" style="display:none;margin-top:12px;padding:14px;background:var(--surface-2);border-radius:10px;font-size:.85rem;line-height:1.7;max-height:400px;overflow-y:auto"></div>
      </div>`;
  }).join('');
}
function closeMyTripsModal() {
  const modal = document.getElementById('my-trips-modal');
  if (modal) modal.classList.add('hidden');
}

// Expand an AI trip's itinerary inline in My Trips modal
function expandItinerary(tripId, btn) {
  const expDiv = document.getElementById(`exp-${tripId}`);
  if (!expDiv) return;
  if (expDiv.style.display === 'block') {
    expDiv.style.display = 'none';
    btn.innerHTML = '<i class="fa-solid fa-eye"></i> View';
    return;
  }
  // Find the trip from already-rendered data
  btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
  apiGetMyTrips().then(trips => {
    const trip = trips.find(t => t.id === tripId);
    if (trip && trip.generated_itinerary) {
      expDiv.innerHTML = marked.parse(trip.generated_itinerary);
      expDiv.style.display = 'block';
      btn.innerHTML = '<i class="fa-solid fa-eye-slash"></i> Hide';
    } else {
      btn.innerHTML = '<i class="fa-solid fa-eye"></i> View';
    }
  }).catch(() => { btn.innerHTML = '<i class="fa-solid fa-eye"></i> View'; });
}

// Delete an AI trip from the backend
async function deleteAITrip(tripId, btn) {
  if (!confirm('Delete this saved itinerary?')) return;
  const token = getToken();
  if (!token) { showToast('Sign in required', 'error'); return; }
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
  try {
    const res = await fetch(BACKEND_URL + `/api/ai-trips/${tripId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (res.ok || res.status === 204) {
      const card = btn.closest('.saved-trip-card');
      if (card) card.remove();
      showToast('Itinerary deleted.');
    } else {
      throw new Error('Delete failed');
    }
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-trash"></i> Delete';
  }
}

