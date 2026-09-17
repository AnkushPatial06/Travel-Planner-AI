/* ============================================================
   Favorites — favorites cache and heart-icon wiring shared across cards.
   ============================================================ */

// ── Favorites cache (traveler_id → set of "type:id") ───────────────────────────
let favoritesCache = null;
async function ensureFavoritesLoaded() {
  if (!getToken()) { favoritesCache = []; return favoritesCache; }
  if (favoritesCache === null) favoritesCache = await apiGetFavorites();
  return favoritesCache;
}
function findFavorite(type, id) {
  if (!favoritesCache) return null;
  const key = `${type}_id`;
  return favoritesCache.find(f => f[key] === id) || null;
}
async function toggleFavorite(type, id, btnEl) {
  if (!getToken()) {
    openAuthModal('login');
    showToast('Sign in to save favorites', 'error');
    return;
  }
  await ensureFavoritesLoaded();
  const existing = findFavorite(type, id);
  try {
    if (existing) {
      await apiRemoveFavorite(existing.id);
      favoritesCache = favoritesCache.filter(f => f.id !== existing.id);
      if (btnEl) btnEl.classList.remove('active');
      showToast('Removed from favorites');
    } else {
      const payload = {};
      payload[`${type}_id`] = id;
      const fav = await apiAddFavorite(payload);
      favoritesCache.push(fav);
      if (btnEl) btnEl.classList.add('active');
      showToast('Added to favorites ❤️');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}
function favHeartHtml(type, id) {
  const active = findFavorite(type, id) ? ' active' : '';
  return `<button type="button" class="card-fav-btn${active}" data-fav-type="${type}" data-fav-id="${id}" title="Save to favorites"><i class="fa-solid fa-heart"></i></button>`;
}
function wireFavHearts(container) {
  container.querySelectorAll('.card-fav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const type = btn.getAttribute('data-fav-type');
      const id = parseInt(btn.getAttribute('data-fav-id'));
      toggleFavorite(type, id, btn);
    });
  });
}

