/* ============================================================
   Landing — homepage preview sections: Destinations, Planners, Packages, and shared card renderers.
   ============================================================ */

// ── Card renderers (reused by landing preview + browse modal) ──────────────────
function destCardHtml(d) {
  return `
    <div class="dest-card" data-dest-id="${d.id}">
      ${favHeartHtml('destination', d.id)}
      <div class="dest-card-img" style="background-image:url('${d.image || ''}')">
        <span class="dest-badge">${d.best_time_to_visit || 'Year-round'}</span>
      </div>
      <div class="dest-card-body">
        <h3 class="dest-card-name">${escHtml(d.name)}</h3>
        <p class="dest-card-state"><i class="fa-solid fa-location-dot"></i> ${escHtml(d.state || d.country)}</p>
        ${d.average_budget ? `<div class="dest-card-budget"><i class="fa-solid fa-indian-rupee-sign"></i> Avg. \u20B9${Number(d.average_budget).toLocaleString('en-IN')}</div>` : ''}
      </div>
    </div>`;
}
function plannerCardHtml(p) {
  return `
    <div class="planner-card" data-planner-id="${p.id}">
      ${favHeartHtml('planner', p.user_id)}
      <div class="planner-card-avatar">${(p.name || 'P').charAt(0).toUpperCase()}</div>
      <div class="planner-card-body">
        <h3 class="planner-card-name">${escHtml(p.name || 'Planner')}</h3>
        <p class="planner-location"><i class="fa-solid fa-location-dot"></i> ${escHtml(p.location || 'India')}</p>
        <div class="planner-meta">
          <span class="pm-rating"><i class="fa-solid fa-star"></i> ${Number(p.rating || 0).toFixed(1)}</span>
          <span><i class="fa-solid fa-briefcase"></i> ${p.years_experience} yrs exp</span>
          <span><i class="fa-solid fa-indian-rupee-sign"></i> from \u20B9${Number(p.starting_price).toLocaleString('en-IN')}</span>
        </div>
        ${p.bio ? `<p class="planner-bio">${escHtml(p.bio.substring(0, 110))}…</p>` : ''}
      </div>
    </div>`;
}
function packageCardHtml(pkg) {
  return `
    <div class="package-card" data-package-id="${pkg.id}">
      ${favHeartHtml('package', pkg.id)}
      <div class="package-card-top">
        <div class="package-card-title">${escHtml(pkg.title)}</div>
        <div class="package-card-desc">${escHtml((pkg.description || 'A curated travel experience.').substring(0, 100))}</div>
        <div class="package-card-meta">
          <span><i class="fa-solid fa-calendar-days"></i> ${pkg.duration_days} days</span>
          <span><i class="fa-solid fa-users"></i> up to ${pkg.max_travelers}</span>
          ${pkg.travel_style ? `<span><i class="fa-solid fa-tag"></i> ${escHtml(pkg.travel_style)}</span>` : ''}
        </div>
      </div>
      <div class="package-card-bottom">
        <div class="package-card-price">₹${Number(pkg.price).toLocaleString('en-IN')} <small>total</small></div>
        <span class="detail-btn-outline" style="padding:7px 14px;font-size:.8rem">View <i class="fa-solid fa-arrow-right"></i></span>
      </div>
    </div>`;
}

// ── Destinations Section (landing preview) ─────────────────────────────────────
async function loadDestinationsSection() {
  const wrap = document.getElementById('destinations-section-cards');
  if (!wrap) return;
  wrap.innerHTML = '<div class="dest-loading"><i class="fa-solid fa-circle-notch fa-spin"></i></div>';
  await ensureFavoritesLoaded();
  const dests = await apiGetDestinations();
  window._allDestinations = dests;
  if (!dests.length) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = dests.slice(0, 6).map(destCardHtml).join('');
  wireFavHearts(wrap);
  wrap.querySelectorAll('.dest-card').forEach(card => {
    card.addEventListener('click', () => openDestinationModal(parseInt(card.getAttribute('data-dest-id'))));
  });
}

// ── Planners Section (landing preview) ──────────────────────────────────────────
async function loadPlannersSection() {
  const wrap = document.getElementById('planners-section-cards');
  if (!wrap) return;
  wrap.innerHTML = '<div class="dest-loading"><i class="fa-solid fa-circle-notch fa-spin"></i></div>';
  await ensureFavoritesLoaded();
  const planners = await apiGetPlanners();
  window._allPlanners = planners;
  if (!planners.length) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = planners.slice(0, 6).map(plannerCardHtml).join('');
  wireFavHearts(wrap);
  wrap.querySelectorAll('.planner-card').forEach(card => {
    card.addEventListener('click', () => openPlannerModal(parseInt(card.getAttribute('data-planner-id'))));
  });
}

// ── Packages Section (landing preview) ──────────────────────────────────────────
async function loadPackagesSection() {
  const wrap = document.getElementById('packages-section-cards');
  if (!wrap) return;
  wrap.innerHTML = '<div class="dest-loading"><i class="fa-solid fa-circle-notch fa-spin"></i></div>';
  await ensureFavoritesLoaded();
  const pkgs = await apiGetPackages();
  window._allPackages = pkgs;
  if (!pkgs.length) { wrap.innerHTML = '<p class="empty-state">No packages published yet. Check back soon!</p>'; return; }
  wrap.innerHTML = pkgs.slice(0, 6).map(packageCardHtml).join('');
  wireFavHearts(wrap);
  wrap.querySelectorAll('.package-card').forEach(card => {
    card.addEventListener('click', () => openPackageModal(parseInt(card.getAttribute('data-package-id'))));
  });
}

