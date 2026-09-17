/* ============================================================
   Modals — Destination, Planner, and Package detail modals.
   ============================================================ */

/* ============================================================
   DESTINATION DETAIL MODAL
   ============================================================ */
async function openDestinationModal(id) {
  const modal = document.getElementById('destination-modal');
  const body  = document.getElementById('destination-modal-body');
  if (!modal) return;
  modal.classList.remove('hidden');
  body.innerHTML = '<div class="dest-loading"><i class="fa-solid fa-circle-notch fa-spin"></i></div>';
  try {
    const [d, pkgs, blogs, reviews] = await Promise.all([
        apiGetDestination(id),
        apiGetPackages(id),
        apiGetDestinationBlogs(id),
        apiGetDestinationReviews(id)
    ]);
    const weather = await apiGetDestinationWeather(d.name);
    
    const blogsHtml = blogs.length ? blogs.map(b => `
        <div class="review-item" style="border:1px solid var(--border); padding:16px; border-radius:10px; margin-bottom:10px;">
            <div style="font-weight:700; font-size:1.1rem; margin-bottom:8px;">${escHtml(b.title)}</div>
            ${b.image_url ? `<img src="${escHtml(b.image_url)}" style="width:100%; height:200px; object-fit:cover; border-radius:8px; margin-bottom:12px;">` : ''}
            <div style="font-size:0.95rem; color:var(--text-2); line-height:1.6;">${escHtml(b.content)}</div>
            <div style="font-size:0.8rem; color:var(--text-3); margin-top:12px;">
                <i class="fa-solid fa-user"></i> ${escHtml(b.author?.name || 'User')} · ${new Date(b.created_at).toLocaleDateString()}
            </div>
        </div>
    `).join('') : '<p class="empty-state">No blogs for this destination yet.</p>';

    const listHtml = (items) => Array.isArray(items) && items.length
      ? `<div class="itinerary-day-activities">${items.map(item => `<span>${escHtml(item)}</span>`).join('')}</div>`
      : '<p class="empty-state">No details published yet.</p>';
    const reviewsHtml = reviews.length
      ? reviews.map(r => `
          <div class="review-item">
            <div class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
            ${r.review_text ? `<div class="review-text">${escHtml(r.review_text)}</div>` : ''}
            <div class="review-date">${new Date(r.created_at).toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'})}</div>
          </div>`).join('')
      : '<p class="empty-state">No destination reviews yet.</p>';
    const weatherHtml = weather ? `
      <div class="detail-meta-row">
        <span class="detail-meta-chip"><i class="fa-solid fa-cloud-sun"></i> ${escHtml(weather.overall_condition || 'Current weather loaded')}</span>
        <span class="detail-meta-chip"><i class="fa-solid fa-temperature-half"></i> ${escHtml(weather.temperature_range || 'Forecast available')}</span>
        <span class="detail-meta-chip"><i class="fa-solid fa-shield-halved"></i> Risk: ${escHtml(weather.risk_level || 'normal')}</span>
      </div>` : '<p class="empty-state">Live travel information is temporarily unavailable.</p>';

    body.innerHTML = `
      <div class="detail-hero" style="background-image:url('${d.image || ''}')">
        <div class="detail-hero-overlay"></div>
        <div class="detail-hero-title">${escHtml(d.name)}</div>
      </div>
      <div class="detail-meta-row">
        <span class="detail-meta-chip"><i class="fa-solid fa-location-dot"></i> ${escHtml(d.state || '')}${d.state ? ', ' : ''}${escHtml(d.country || '')}</span>
        ${d.best_time_to_visit ? `<span class="detail-meta-chip"><i class="fa-solid fa-calendar"></i> Best time: ${escHtml(d.best_time_to_visit)}</span>` : ''}
        ${d.average_budget ? `<span class="detail-meta-chip"><i class="fa-solid fa-indian-rupee-sign"></i> Avg. budget ₹${Number(d.average_budget).toLocaleString('en-IN')}</span>` : ''}
      </div>
      <p class="detail-desc">${escHtml(d.description || 'A wonderful destination waiting to be explored.')}</p>
      <div class="detail-actions">
        <button class="detail-btn-outline" id="destination-review-btn"><i class="fa-solid fa-star"></i> Leave a Review</button>
        ${favHeartHtml('destination', d.id)}
      </div>
      <div class="detail-section-heading"><i class="fa-solid fa-cloud-sun"></i> Live Travel Information</div>
      ${weatherHtml}
      <div class="detail-section-heading"><i class="fa-solid fa-landmark"></i> Attractions</div>
      ${listHtml(d.attractions)}
      <div class="detail-section-heading"><i class="fa-solid fa-person-hiking"></i> Activities</div>
      ${listHtml(d.activities)}
      <div class="detail-section-heading"><i class="fa-solid fa-lightbulb"></i> Travel Tips</div>
      ${listHtml(d.travel_tips)}
      <div class="detail-section-heading"><i class="fa-solid fa-suitcase-rolling"></i> Packages for ${escHtml(d.name)}</div>
      <div class="cards-grid" id="dest-modal-packages" style="margin-bottom:24px">
        ${pkgs.length ? pkgs.map(packageCardHtml).join('') : '<p class="empty-state">No packages published for this destination yet.</p>'}
      </div>
      <div class="detail-section-heading"><i class="fa-solid fa-book-open"></i> Travel Blogs & Tips</div>
      <div id="dest-modal-blogs">
        ${blogsHtml}
      </div>
      <div class="detail-section-heading"><i class="fa-solid fa-comments"></i> Customer Feedback & Reviews</div>
      <div id="dest-modal-reviews">${reviewsHtml}</div>
    `;
    wireFavHearts(body);
    document.getElementById('destination-review-btn')?.addEventListener('click', () => openReviewModal(null, d.id));
    body.querySelectorAll('.package-card').forEach(card => {
      card.addEventListener('click', () => { closeDestinationModal(); openPackageModal(parseInt(card.getAttribute('data-package-id'))); });
    });
  } catch (err) {
    body.innerHTML = `<p class="empty-state">${escHtml(err.message)}</p>`;
  }
}
function closeDestinationModal() { document.getElementById('destination-modal')?.classList.add('hidden'); }

/* ============================================================
   PLANNER DETAIL MODAL
   ============================================================ */
async function openPlannerModal(id) {
  const modal = document.getElementById('planner-modal');
  const body  = document.getElementById('planner-modal-body');
  if (!modal) return;
  modal.classList.remove('hidden');
  body.innerHTML = '<div class="dest-loading"><i class="fa-solid fa-circle-notch fa-spin"></i></div>';
  try {
    const p = await apiGetPlanner(id);
    const [pkgs, reviews] = await Promise.all([
      apiGetPackages(),
      apiGetPlannerReviews(p.user_id),
    ]);
    const plannerPkgs = pkgs.filter(pk => pk.planner_id === p.id);

    const reviewsHtml = reviews.length
      ? reviews.map(r => `
          <div class="review-item">
            <div class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
            ${r.review_text ? `<div class="review-text">${escHtml(r.review_text)}</div>` : ''}
            <div class="review-date">${new Date(r.created_at).toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'})}</div>
          </div>`).join('')
      : '<p class="empty-state">No reviews yet. Be the first to review this planner.</p>';

    body.innerHTML = `
      <div class="planner-detail-header">
        <div class="planner-avatar-lg">${(p.name || 'P').charAt(0).toUpperCase()}</div>
        <div>
          <div class="planner-detail-name">${escHtml(p.name || 'Planner')}</div>
          <div class="planner-detail-rating"><i class="fa-solid fa-star"></i> ${Number(p.rating || 0).toFixed(1)} · ${p.total_reviews} review${p.total_reviews !== 1 ? 's' : ''}</div>
        </div>
      </div>
      <div class="detail-meta-row">
        <span class="detail-meta-chip"><i class="fa-solid fa-location-dot"></i> ${escHtml(p.location || 'India')}</span>
        <span class="detail-meta-chip"><i class="fa-solid fa-briefcase"></i> ${p.years_experience} yrs experience</span>
        <span class="detail-meta-chip"><i class="fa-solid fa-indian-rupee-sign"></i> from ₹${Number(p.starting_price).toLocaleString('en-IN')}</span>
        <span class="detail-meta-chip"><i class="fa-solid fa-circle-check"></i> ${escHtml(p.verification_status)}</span>
      </div>
      <p class="detail-desc">${escHtml(p.bio || 'This planner has not added a bio yet.')}</p>
      <div class="detail-actions">
        <button class="detail-btn-primary" id="planner-request-btn"><i class="fa-solid fa-paper-plane"></i> Request a Trip</button>
        <button class="detail-btn-outline" id="planner-chat-btn"><i class="fa-solid fa-comment-dots"></i> Chat with Planner</button>
        <button class="detail-btn-outline" id="planner-review-btn"><i class="fa-solid fa-star"></i> Leave a Review</button>
        ${favHeartHtml('planner', p.user_id)}
      </div>
      <div class="detail-section-heading"><i class="fa-solid fa-suitcase-rolling"></i> Packages by ${escHtml(p.name || 'this planner')}</div>
      <div class="cards-grid" id="planner-modal-packages" style="margin-bottom:24px">
        ${plannerPkgs.length ? plannerPkgs.map(packageCardHtml).join('') : '<p class="empty-state">No packages published yet.</p>'}
      </div>
      <div class="detail-section-heading"><i class="fa-solid fa-comments"></i> Traveler Reviews</div>
      <div id="planner-modal-reviews">${reviewsHtml}</div>
    `;
    wireFavHearts(body);
    body.querySelectorAll('.package-card').forEach(card => {
      card.addEventListener('click', () => { closePlannerModal(); openPackageModal(parseInt(card.getAttribute('data-package-id'))); });
    });
    document.getElementById('planner-request-btn').addEventListener('click', () => openRequestModal({ plannerId: p.user_id }));
    document.getElementById('planner-review-btn').addEventListener('click', () => openReviewModal(p.user_id));
    document.getElementById('planner-chat-btn').addEventListener('click', () => openUserChat(p.user_id));
  } catch (err) {
    body.innerHTML = `<p class="empty-state">${escHtml(err.message)}</p>`;
  }
}
function closePlannerModal() { document.getElementById('planner-modal')?.classList.add('hidden'); }

/* ============================================================
   PACKAGE DETAIL MODAL
   ============================================================ */
async function openPackageModal(id) {
  const modal = document.getElementById('package-modal');
  const body  = document.getElementById('package-modal-body');
  if (!modal) return;
  modal.classList.remove('hidden');
  body.innerHTML = '<div class="dest-loading"><i class="fa-solid fa-circle-notch fa-spin"></i></div>';
  try {
    const pkg = await apiGetPackage(id);
    // TravelPackage.planner_id is the PlannerProfile.id — resolve the
    // planner's User.id too, since trip requests/reviews key off User.id.
    const plannerProfile = await apiGetPlanner(pkg.planner_id).catch(() => null);
    const plannerUserId = plannerProfile ? plannerProfile.user_id : null;
    const days = (pkg.itinerary_days || []).slice().sort((a, b) => a.day_number - b.day_number);
    const daysHtml = days.length
      ? days.map(day => `
          <div class="itinerary-day-item">
            <div class="itinerary-day-num">${day.day_number}</div>
            <div>
              <div class="itinerary-day-title">${escHtml(day.title)}</div>
              ${day.description ? `<div class="itinerary-day-desc">${escHtml(day.description)}</div>` : ''}
              ${(day.activities && day.activities.length) ? `<div class="itinerary-day-activities">${day.activities.map(a => `<span>${escHtml(a)}</span>`).join('')}</div>` : ''}
            </div>
          </div>`).join('')
      : '<p class="empty-state">Detailed day-by-day itinerary coming soon.</p>';
    const chipList = (items) => Array.isArray(items) && items.length
      ? `<div class="itinerary-day-activities">${items.map(item => `<span>${escHtml(item)}</span>`).join('')}</div>`
      : '<p class="empty-state">Not specified.</p>';
    const packageImage = Array.isArray(pkg.images) && pkg.images.length ? pkg.images[0] : null;

    body.innerHTML = `
      ${packageImage ? `<div class="detail-hero" style="background-image:url('${escHtml(packageImage)}')"><div class="detail-hero-overlay"></div><div class="detail-hero-title">${escHtml(pkg.title)}</div></div>` : ''}
      <div class="detail-hero-title" style="color:var(--text-1);font-size:1.5rem;margin-bottom:8px">${escHtml(pkg.title)}</div>
      <div class="detail-meta-row">
        <span class="detail-meta-chip"><i class="fa-solid fa-calendar-days"></i> ${pkg.duration_days} days</span>
        <span class="detail-meta-chip"><i class="fa-solid fa-users"></i> up to ${pkg.max_travelers} travelers</span>
        ${pkg.travel_style ? `<span class="detail-meta-chip"><i class="fa-solid fa-tag"></i> ${escHtml(pkg.travel_style)}</span>` : ''}
        <span class="detail-meta-chip"><i class="fa-solid fa-indian-rupee-sign"></i> ₹${Number(pkg.price).toLocaleString('en-IN')} total</span>
      </div>
      <p class="detail-desc">${escHtml(pkg.description || 'A curated travel experience.')}</p>
      ${plannerProfile ? `<p style="font-size:.85rem;color:var(--text-3);margin-top:-14px;margin-bottom:18px">Offered by <strong style="color:var(--text-2)">${escHtml(plannerProfile.name || 'a verified planner')}</strong></p>` : ''}
      <div class="detail-actions">
        <button class="detail-btn-primary" id="package-request-btn"><i class="fa-solid fa-paper-plane"></i> Request This Package</button>
        <button class="detail-btn-outline" id="package-view-planner-btn"><i class="fa-solid fa-user-tie"></i> View Planner</button>
        ${favHeartHtml('package', pkg.id)}
      </div>
      <div class="detail-section-heading"><i class="fa-solid fa-hotel"></i> Hotels</div>
      ${chipList(pkg.hotels)}
      <div class="detail-section-heading"><i class="fa-solid fa-person-hiking"></i> Activities</div>
      ${chipList(pkg.activities)}
      <div class="detail-section-heading"><i class="fa-solid fa-circle-check"></i> Inclusions</div>
      ${chipList(pkg.inclusions)}
      <div class="detail-section-heading"><i class="fa-solid fa-circle-xmark"></i> Exclusions</div>
      ${chipList(pkg.exclusions)}
      <div class="detail-section-heading"><i class="fa-solid fa-calendar-check"></i> Availability</div>
      <p class="detail-desc">${escHtml(pkg.availability?.note || 'Available on request.')}</p>
      <div class="detail-section-heading"><i class="fa-solid fa-route"></i> Day-by-Day Itinerary</div>
      <div>${daysHtml}</div>
    `;
    wireFavHearts(body);
    document.getElementById('package-request-btn').addEventListener('click', () =>
      openRequestModal({ plannerId: plannerUserId, destinationId: pkg.destination_id, packageId: pkg.id })
    );
    document.getElementById('package-view-planner-btn').addEventListener('click', () => {
      closePackageModal(); openPlannerModal(pkg.planner_id);
    });
  } catch (err) {
    body.innerHTML = `<p class="empty-state">${escHtml(err.message)}</p>`;
  }
}
function closePackageModal() { document.getElementById('package-modal')?.classList.add('hidden'); }

