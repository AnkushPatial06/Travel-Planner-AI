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

// ── Swap Airports ──────────────────────────────────────────
document.getElementById('swap-airports')?.addEventListener('click', () => {
    const origin = document.getElementById('origin');
    const dest   = document.getElementById('destination');

    if (origin && dest) {
        [origin.value, dest.value] = [dest.value, origin.value];
    }
});

// ── New Search Button ──────────────────────────────────────
document.getElementById('new-search-btn')?.addEventListener('click', () => {
    resultsEl?.classList.add('hidden');
    welcomeEl?.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ── Tab Navigation ─────────────────────────────────────────
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-tab');
        tabBtns.forEach(b => b.classList.remove('active'));
        tabPanels.forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(target).classList.add('active');
    });
});

// ── Sort Buttons ───────────────────────────────────────────
document.addEventListener('click', e => {
    if (!e.target.classList.contains('sort-btn')) return;
    const bar  = e.target.closest('.panel-sort-bar');
    const panel = e.target.closest('.tab-panel');
    if (!bar || !panel) return;

    bar.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');

    const sort = e.target.getAttribute('data-sort');

    if (panel.id === 'tab-stays') {
        renderStays(sortHotels([...hotelsData], sort));
    } else if (panel.id === 'tab-flights') {
        renderFlights(sortFlights([...flightsData], sort));
    }
});

function sortHotels(arr, sort) {
    if (sort === 'rating')     return arr.sort((a, b) => b.rating - a.rating);
    if (sort === 'price-asc')  return arr.sort((a, b) => parsePrice(a.price) - parsePrice(b.price));
    if (sort === 'price-desc') return arr.sort((a, b) => parsePrice(b.price) - parsePrice(a.price));
    return arr;
}
function sortFlights(arr, sort) {
    if (sort === 'price-asc') return arr.sort((a, b) => parsePrice(a.price) - parsePrice(b.price));
    if (sort === 'duration')  return arr.sort((a, b) => parseDuration(a.duration) - parseDuration(b.duration));
    return arr;
}
function parseDuration(str) {
    if (!str) return 9999;
    const h = (str.match(/(\d+)\s*h/) || [0,0])[1];
    const m = (str.match(/(\d+)\s*m/) || [0,0])[1];
    return parseInt(h)*60 + parseInt(m);
}

// ── Form Submit / Search ───────────────────────────────────
searchForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!getToken()) {
        window._pendingAfterLogin = () => { searchForm.dispatchEvent(new Event('submit')); };
        openAuthModal('login');
        showToast('You need an account to use the AI travel search. Sign in or sign up to continue.', 'error');
        return;
    }

    const origin      = document.getElementById('origin').value.trim().toUpperCase();
    const destination = document.getElementById('destination').value.trim().toUpperCase();
    const outbound    = outboundInput.value;
    const ret         = returnInput.value;
    const budget      = parseFloat(budgetInput.value) || 50000;

    if (!origin || !destination) {
        showToast('Please enter both airport codes.', 'error'); return;
    }
    if (new Date(outbound) >= new Date(ret)) {
        showToast('Return date must be after departure date.', 'error'); return;
    }

    const diffMs = new Date(ret) - new Date(outbound);
    tripNights   = Math.max(Math.ceil(diffMs / 86400000), 1);

    selectedFlight = null;
    selectedHotel  = null;
    updateBudgetTracker(budget);

    // Show loading
    welcomeEl.classList.add('hidden');
    resultsEl.classList.add('hidden');
    loadingEl.classList.remove('hidden');
    animateLoadingSteps();

    try {
        const res = await fetch(BACKEND_URL + '/complete_search/', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body:    JSON.stringify({
                flight_request: {
                    origin,
                    destination,
                    outbound_date: outbound,
                    return_date:   ret,
                    budget:        budget,
                }
            })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
            throw new Error(err.detail || 'Search failed');
        }

        currentTripData = await res.json();

        // ── Debug: log the response shape so we can verify keys ────
        console.log('[Travel Planner] /complete_search/ response received:');
        console.log('  flights:', Array.isArray(currentTripData.flights) ? currentTripData.flights.length + ' items' : currentTripData.flights);
        console.log('  hotels:', Array.isArray(currentTripData.hotels) ? currentTripData.hotels.length + ' items' : currentTripData.hotels);
        console.log('  weather_analysis:', currentTripData.weather_analysis ? 'present (risk_level=' + currentTripData.weather_analysis.risk_level + ')' : 'null/missing');
        console.log('  budget_analysis:', currentTripData.budget_analysis ? 'present (status=' + currentTripData.budget_analysis.budget_status + ')' : 'null/missing');
        console.log('  travel_score:', currentTripData.travel_score ? 'present (score=' + currentTripData.travel_score.total_score + ')' : 'null/missing');

        renderResults(origin, destination, outbound, ret, budget);

        // ── AI Search → DB Destination Matching ────────────────────────────────
        // Async: try to match the destination against our DB after results appear
        matchAndShowDestination(destination).catch(e => console.warn('[DestMatch]', e));

    } catch (err) {
        console.error('[Travel Planner] Search error:', err);
        showToast(`Search error: ${err.message}`, 'error');
        welcomeEl.classList.remove('hidden');
    } finally {
        loadingEl.classList.add('hidden');
    }
});

// ── Render All Results ─────────────────────────────────────
function renderResults(origin, dest, outbound, ret, budget) {

    // ▶ STEP 0: Immediately clear the static loading spinners so they
    //   can never get stuck, regardless of what the render calls do.
    const _wWrap = document.getElementById('weather-wrap');
    const _bWrap = document.getElementById('budget-analysis-wrap');
    const _sWrap = document.getElementById('score-wrap');
    if (_wWrap) _wWrap.innerHTML = '';
    if (_bWrap) _bWrap.innerHTML = '';
    if (_sWrap) _sWrap.innerHTML = '';

    // ▶ STEP 1: Trip header
    try {
        document.getElementById('trip-header-origin').textContent = origin;
        document.getElementById('trip-header-dest').textContent   = dest;
        document.getElementById('trip-header-dates').textContent  =
            `${formatDisplayDate(outbound)} → ${formatDisplayDate(ret)} · ${tripNights} night${tripNights!==1?'s':''}`;
    } catch(e) { console.error('[renderResults] header error:', e); }

    hotelsData  = currentTripData.hotels  || [];
    flightsData = currentTripData.flights || [];

    // Count badges
    try {
        document.getElementById('stays-count').textContent   = hotelsData.length;
        document.getElementById('flights-count').textContent = flightsData.length;
    } catch(e) { /* non-critical */ }

    // ▶ STEP 2: Hotels + Flights
    try { renderStays(sortHotels([...hotelsData], 'rating')); }
    catch(e) { console.error('[renderResults] renderStays error:', e); }

    try { renderFlights(sortFlights([...flightsData], 'price-asc')); }
    catch(e) { console.error('[renderResults] renderFlights error:', e); }

    // ▶ STEP 3: AI Recommendations
    try {
        const flightAI = document.getElementById('flight-ai-content');
        const hotelAI  = document.getElementById('hotel-ai-content');
        if (flightAI) flightAI.innerHTML = currentTripData.ai_flight_recommendation
            ? marked.parse(currentTripData.ai_flight_recommendation)
            : '<p class="ai-placeholder">No flight analysis available.</p>';
        if (hotelAI) hotelAI.innerHTML = currentTripData.ai_hotel_recommendation
            ? marked.parse(currentTripData.ai_hotel_recommendation)
            : '<p class="ai-placeholder">No hotel analysis available.</p>';
    } catch(e) { console.error('[renderResults] AI recs error:', e); }

    // ▶ STEP 4: Itinerary
    try {
        const itinEl = document.getElementById('itinerary-content');
        if (itinEl) {
            if (currentTripData.itinerary) {
                itinEl.innerHTML = marked.parse(currentTripData.itinerary);
                window._lastItinerary = currentTripData.itinerary || '';
                window._lastDestination = (currentTripData.destination_city || currentTripData.destination || dest || '');
                const dlBtn = document.getElementById('btn-download-itinerary');
                if (dlBtn) dlBtn.onclick = () => downloadMarkdown(currentTripData.itinerary, dest, outbound);
            } else {
                itinEl.innerHTML = '<p>Itinerary requires both flights and hotels to be found.</p>';
            }
        }
    } catch(e) { console.error('[renderResults] itinerary error:', e); }

    // ▶ STEP 5: Weather Intelligence
    try {
        renderWeather(currentTripData.weather_analysis, dest);
        console.log('[Travel Planner] renderWeather OK');
    } catch(e) {
        console.error('[Travel Planner] renderWeather failed:', e);
        if (_wWrap) _wWrap.innerHTML = emptyState('triangle-exclamation',
            'Weather display error', e.message);
    }

    // ▶ STEP 6: Budget Analysis
    try {
        renderBudget(currentTripData.budget_analysis, budget);
        console.log('[Travel Planner] renderBudget OK');
    } catch(e) {
        console.error('[Travel Planner] renderBudget failed:', e);
        if (_bWrap) _bWrap.innerHTML = emptyState('triangle-exclamation',
            'Budget display error', e.message);
    }

    // ▶ STEP 7: Travel Score
    try {
        renderTravelScore(currentTripData.travel_score);
        console.log('[Travel Planner] renderTravelScore OK');
    } catch(e) {
        console.error('[Travel Planner] renderTravelScore failed:', e);
        if (_sWrap) _sWrap.innerHTML = emptyState('triangle-exclamation',
            'Score display error', e.message);
    }

    // ▶ STEP 8: Show results — default to Stays tab
    tabBtns[0].click();
    resultsEl.classList.remove('hidden');
    document.getElementById('budget-sidebar').classList.remove('hidden');
    updateBudgetTracker(budget);

    setTimeout(() => {
        resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}

// ── AI Search → DB Destination Matching ─────────────────────────────────────
// After a search, try to find the DB destination matching the searched destination.
// Uses multi-strategy fuzzy matching: IATA code → city name → partial match.
async function matchAndShowDestination(destCode) {
    const wrap = document.getElementById('matched-destination-wrap');
    if (!wrap) return; // section not present in HTML — safe no-op

    // Normalize the destination input (may be "GOA", "Goa", "Bombay" etc.)
    const normalised = destCode.trim().toUpperCase();
    // IATA → common city name mapping (extend as needed)
    const iataToCity = {
        GOI: 'Goa', GOA: 'Goa', BOM: 'Mumbai', DEL: 'Delhi', BLR: 'Bangalore',
        BBI: 'Bhubaneswar', MAA: 'Chennai', CCU: 'Kolkata', HYD: 'Hyderabad',
        AMD: 'Ahmedabad', JAI: 'Jaipur', COK: 'Kochi', SXR: 'Kashmir',
        LUH: 'Ludhiana', IXC: 'Chandigarh', IXL: 'Ladakh', IXM: 'Madurai',
        IXJ: 'Jammu', ATQ: 'Amritsar', KUU: 'Kullu', BHO: 'Bhopal',
        VNS: 'Varanasi', GAU: 'Guwahati', IXB: 'Bagdogra',
    };
    const cityHint = iataToCity[normalised] || destCode;

    // Fetch all destinations (use cache if available)
    const dests = window._allDestinations && window._allDestinations.length
        ? window._allDestinations
        : await apiGetDestinations();
    if (!dests.length) { wrap.innerHTML = ''; return; }

    // Multi-strategy match:
    // 1. Exact name match (case-insensitive)
    // 2. Destination name contains the city hint
    // 3. City hint contains the destination name
    const lc = (s) => (s || '').toLowerCase();
    const hint = lc(cityHint);
    let match = dests.find(d => lc(d.name) === hint) ||
                dests.find(d => lc(d.name).includes(hint)) ||
                dests.find(d => hint.includes(lc(d.name)));

    await ensureFavoritesLoaded();

    // ── No destination match in our DB — fall back to a general preview ──
    // instead of leaving the section blank, so Planners/Packages always show.
    if (!match) {
        const [pkgs, planners] = await Promise.all([
            apiGetPackages(),
            apiGetPlanners(),
        ]);
        const topPlanners = planners.slice(0, 3);
        const topPkgs = pkgs.slice(0, 3);

        if (!topPkgs.length && !topPlanners.length) { wrap.innerHTML = ''; return; }

        wrap.innerHTML = `
          <div class="matched-dest-banner">
            <div class="matched-dest-section" style="border-top:none;">
              <div class="matched-dest-section-title">
                <i class="fa-solid fa-circle-info"></i>
                No dedicated planners or packages for ${escHtml(cityHint)} yet — here are some of our top picks
              </div>
            </div>
            ${topPkgs.length ? `
            <div class="matched-dest-section">
              <div class="matched-dest-section-title"><i class="fa-solid fa-suitcase-rolling"></i> Ready-Made Packages</div>
              <div class="cards-grid matched-packages-grid" id="matched-packages-grid">
                ${topPkgs.map(packageCardHtml).join('')}
              </div>
            </div>` : ''}
            ${topPlanners.length ? `
            <div class="matched-dest-section">
              <div class="matched-dest-section-title"><i class="fa-solid fa-user-tie"></i> Connect with Expert Planners</div>
              <div class="cards-grid matched-planners-grid" id="matched-planners-grid">
                ${topPlanners.map(plannerCardHtml).join('')}
              </div>
            </div>` : ''}
          </div>
        `;
        wireFavHearts(wrap);
        wrap.querySelectorAll('.package-card').forEach(card => {
            card.addEventListener('click', () => openPackageModal(parseInt(card.getAttribute('data-package-id'))));
        });
        wrap.querySelectorAll('.planner-card').forEach(card => {
            card.addEventListener('click', () => openPlannerModal(parseInt(card.getAttribute('data-planner-id'))));
        });
        return;
    }

    // Fetch packages for matched destination and planners
    const [pkgs, planners] = await Promise.all([
        apiGetPackages(match.id),
        apiGetPlanners(),
    ]);

    // Filter planners who specialise in this destination
    // (API doesn't filter by destination, so show all planners — top 3)
    const topPlanners = planners.filter(p =>
        (Array.isArray(p.destination_ids) && p.destination_ids.includes(match.id)) ||
        (p.location && lc(p.location).includes(lc(match.name))) ||
        (p.bio && lc(p.bio).includes(lc(match.name))) ||
        pkgs.some(pkg => pkg.planner_id === p.id)
    ).slice(0, 3);

    wrap.innerHTML = `
      <div class="matched-dest-banner">
        <div class="matched-dest-hero" style="background-image:url('${match.image || ''}')">
          <div class="matched-dest-overlay"></div>
          <div class="matched-dest-content">
            <div class="matched-dest-label"><i class="fa-solid fa-circle-check"></i> Destination Match</div>
            <div class="matched-dest-name">${escHtml(match.name)}</div>
            <div class="matched-dest-meta">
              <span><i class="fa-solid fa-location-dot"></i> ${escHtml(match.state || '')}${match.state ? ', ' : ''}${escHtml(match.country || 'India')}</span>
              ${match.best_time_to_visit ? `<span><i class="fa-solid fa-calendar"></i> Best time: ${escHtml(match.best_time_to_visit)}</span>` : ''}
              ${match.average_budget ? `<span><i class="fa-solid fa-indian-rupee-sign"></i> Avg. ₹${Number(match.average_budget).toLocaleString('en-IN')}</span>` : ''}
            </div>
            <p class="matched-dest-desc">${escHtml((match.description || '').substring(0, 180))}…</p>
            <div class="matched-dest-actions">
              <button class="matched-dest-btn" onclick="openDestinationModal(${match.id})"><i class="fa-solid fa-map-location-dot"></i> Explore Destination</button>
              <button class="matched-dest-btn outline" onclick="openBrowseModal('packages')"><i class="fa-solid fa-suitcase-rolling"></i> View All Packages</button>
            </div>
          </div>
        </div>
        ${pkgs.length ? `
        <div class="matched-dest-section">
          <div class="matched-dest-section-title"><i class="fa-solid fa-suitcase-rolling"></i> Ready-Made Packages for ${escHtml(match.name)}</div>
          <div class="cards-grid matched-packages-grid" id="matched-packages-grid">
            ${pkgs.slice(0, 3).map(packageCardHtml).join('')}
          </div>
        </div>` : `
        <div class="matched-dest-section">
          <div class="matched-dest-section-title"><i class="fa-solid fa-suitcase-rolling"></i> Ready-Made Packages</div>
          <p class="empty-state">No packages published for ${escHtml(match.name)} yet. Check back soon!</p>
        </div>`}
        ${topPlanners.length ? `
        <div class="matched-dest-section">
          <div class="matched-dest-section-title"><i class="fa-solid fa-user-tie"></i> Connect with Expert Planners</div>
          <div class="cards-grid matched-planners-grid" id="matched-planners-grid">
            ${topPlanners.map(plannerCardHtml).join('')}
          </div>
        </div>` : `
        <div class="matched-dest-section">
          <div class="matched-dest-section-title"><i class="fa-solid fa-user-tie"></i> Connect with Expert Planners</div>
          <p class="empty-state">No planners specialising in ${escHtml(match.name)} yet.</p>
        </div>`}
      </div>
    `;

    // Wire up cards
    wireFavHearts(wrap);
    wrap.querySelectorAll('.package-card').forEach(card => {
        card.addEventListener('click', () => openPackageModal(parseInt(card.getAttribute('data-package-id'))));
    });
    wrap.querySelectorAll('.planner-card').forEach(card => {
        card.addEventListener('click', () => openPlannerModal(parseInt(card.getAttribute('data-planner-id'))));
    });
}

// ── Render Hotel Cards ─────────────────────────────────────
function renderStays(hotels) {
    const list = document.getElementById('stays-list');
    list.innerHTML = '';

    if (!hotels || hotels.length === 0) {
        list.innerHTML = emptyState('hotel', 'No hotels found', 'Try a different destination or check your API key.');
        return;
    }

    hotels.forEach((hotel, idx) => {
        const priceNum   = parsePrice(hotel.price);
        const totalPrice = priceNum * tripNights;
        const ratingWord = getRatingWord(hotel.rating);
        const isSelected = selectedHotel && selectedHotel.name === hotel.name;

        const card = document.createElement('div');
        card.className = 'hotel-card' + (isSelected ? ' selected-card' : '');
        card.innerHTML = `
            <div class="hotel-img-wrap">
                ${hotel.image
                    ? `<img src="${escHtml(hotel.image)}" alt="${escHtml(hotel.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                       <div class="hotel-img-fallback" style="display:none"><i class="fa-solid fa-hotel"></i></div>`
                    : `<div class="hotel-img-fallback"><i class="fa-solid fa-hotel"></i></div>`
                }
                ${hotel.rating >= 4.5 ? '<div class="hotel-badge-top">Top Rated</div>' : ''}
                ${idx === 0 ? '<div class="hotel-badge-top" style="top:34px;background:#005cbf;color:#fff">Best Value</div>' : ''}
            </div>
            <div class="hotel-body">
                <div class="hotel-top">
                    <div>
                        <div class="hotel-name">${escHtml(hotel.name)}</div>
                        <div class="hotel-location">
                            <i class="fa-solid fa-location-dot"></i>
                            ${escHtml(hotel.location || 'Location not specified')}
                        </div>
                    </div>
                    <div class="hotel-rating-block">
                        <div class="rating-pill">
                            <i class="fa-solid fa-star" style="font-size:.7rem;color:#ffdb70"></i>
                            ${hotel.rating.toFixed(1)}
                        </div>
                        <div class="rating-word">${ratingWord}</div>
                    </div>
                </div>
                <div class="hotel-perks">
                    <span class="perk-tag"><i class="fa-solid fa-wifi"></i> Free Wi-Fi</span>
                    <span class="perk-tag"><i class="fa-solid fa-snowflake"></i> AC</span>
                    <span class="perk-tag"><i class="fa-solid fa-shield-halved"></i> Free Cancellation</span>
                </div>
                <div class="hotel-bottom">
                    <div class="hotel-price-block">
                        <div class="hotel-price-per">Per night from</div>
                        <div class="hotel-price-total">₹${formatCurrency(priceNum)}</div>
                        <div class="hotel-price-nights">₹${formatCurrency(totalPrice)} for ${tripNights} night${tripNights!==1?'s':''}</div>
                    </div>
                    <div class="hotel-actions">
                        ${hotel.link && hotel.link !== 'N/A'
                            ? `<a href="${escHtml(hotel.link)}" target="_blank" class="btn-outline">Details</a>`
                            : ''}
                        <button class="btn-select-hotel ${isSelected ? 'btn-selected' : 'btn-primary'}" data-idx="${idx}">
                            ${isSelected
                                ? '<i class="fa-solid fa-check"></i> Selected'
                                : 'Select Stay'}
                        </button>
                    </div>
                </div>
            </div>
        `;
        list.appendChild(card);
    });

    // Select listeners
    list.querySelectorAll('.btn-select-hotel').forEach(btn => {
        btn.addEventListener('click', e => {
            const idx  = parseInt(e.currentTarget.getAttribute('data-idx'));
            const h    = hotels[idx];
            const pn   = parsePrice(h.price);
            selectedHotel = { name: h.name, pricePerNight: pn, totalPrice: pn * tripNights };

            list.querySelectorAll('.hotel-card').forEach((card, i) => {
                card.classList.toggle('selected-card', i === idx);
            });
            list.querySelectorAll('.btn-select-hotel').forEach((b, i) => {
                if (i === idx) {
                    b.className = 'btn-select-hotel btn-selected';
                    b.innerHTML = '<i class="fa-solid fa-check"></i> Selected';
                } else {
                    b.className = 'btn-select-hotel btn-primary';
                    b.textContent = 'Select Stay';
                }
            });

            updateBudgetTracker(parseFloat(budgetInput.value) || 50000);
            showToast(`✓ ${h.name} selected`, 'success');
        });
    });
}

// ── Render Flight Cards ────────────────────────────────────
function renderFlights(flights) {
    const list = document.getElementById('flights-list');
    list.innerHTML = '';

    if (!flights || flights.length === 0) {
        list.innerHTML = emptyState('plane', 'No flights found', 'Try different dates or check your API key.');
        return;
    }

    flights.forEach((flight, idx) => {
        const priceNum   = parsePrice(flight.price);
        const isSelected = selectedFlight && selectedFlight.airline === flight.airline && selectedFlight.price === priceNum;

        // Use dedicated time fields first; fall back to parsing the full string
        const depTime = flight.departure_time || parseFlightTime(flight.departure);
        const arrTime = flight.arrival_time   || parseFlightTime(flight.arrival);
        const depCity = parseCityCode(flight.departure);
        const arrCity = parseCityCode(flight.arrival);

        const card = document.createElement('div');
        card.className = 'flight-card' + (isSelected ? ' selected-card' : '');
        card.innerHTML = `
            ${flight.airline_logo
                ? `<img src="${escHtml(flight.airline_logo)}" alt="${escHtml(flight.airline)}" class="flight-airline-logo"
                      onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                   <div class="flight-airline-placeholder" style="display:none"><i class="fa-solid fa-plane"></i></div>`
                : `<div class="flight-airline-placeholder"><i class="fa-solid fa-plane"></i></div>`
            }
            <div class="flight-info">
                <div class="flight-airline-name">
                    ${escHtml(flight.airline)}
                    <span class="flight-class-badge">${escHtml(flight.travel_class || 'Economy')}</span>
                </div>
                <div class="flight-route">
                    <div class="flight-endpoint">
                        <div class="flight-time">${escHtml(depTime || '—')}</div>
                        <div class="flight-iata">${escHtml(depCity)}</div>
                    </div>
                    <div class="flight-path">
                        <div class="flight-duration">${escHtml(flight.duration || '')}</div>
                        <div class="flight-line">
                            <div class="flight-line-bar"></div>
                            <i class="fa-solid fa-plane flight-plane-icon"></i>
                            <div class="flight-line-bar"></div>
                        </div>
                        <div class="flight-stops">${formatStops(flight.stops)}</div>
                    </div>
                    <div class="flight-endpoint">
                        <div class="flight-time">${escHtml(arrTime || '—')}</div>
                        <div class="flight-iata">${escHtml(arrCity)}</div>
                    </div>
                </div>
            </div>
            <div class="flight-price-col">
                <div class="flight-price-label">Per passenger</div>
                <span class="flight-price-val">₹${formatCurrency(priceNum)}</span>
            </div>
            <div class="flight-actions">
                <button class="btn-select-flight ${isSelected ? 'btn-selected' : 'btn-primary'}" data-idx="${idx}">
                    ${isSelected ? '<i class="fa-solid fa-check"></i> Selected' : 'Select'}
                </button>
            </div>
        `;
        list.appendChild(card);
    });

    // Select listeners
    list.querySelectorAll('.btn-select-flight').forEach(btn => {
        btn.addEventListener('click', e => {
            const idx = parseInt(e.currentTarget.getAttribute('data-idx'));
            const f   = flights[idx];
            selectedFlight = { airline: f.airline, price: parsePrice(f.price) };

            list.querySelectorAll('.flight-card').forEach((card, i) => {
                card.classList.toggle('selected-card', i === idx);
            });
            list.querySelectorAll('.btn-select-flight').forEach((b, i) => {
                if (i === idx) {
                    b.className = 'btn-select-flight btn-selected';
                    b.innerHTML = '<i class="fa-solid fa-check"></i> Selected';
                } else {
                    b.className = 'btn-select-flight btn-primary';
                    b.textContent = 'Select';
                }
            });

            updateBudgetTracker(parseFloat(budgetInput.value) || 50000);
            showToast(`✓ ${f.airline} selected`, 'success');
        });
    });
}

// ── Render Weather Intelligence ────────────────────────────
function renderWeather(weather, destCode) {
    const wrap = document.getElementById('weather-wrap');
    if (!wrap) { console.warn('[renderWeather] #weather-wrap not found'); return; }
    if (!weather) {
        wrap.innerHTML = emptyState('cloud-sun', 'Weather data unavailable',
            'Weather could not be fetched for this destination. Please try again.');
        return;
    }
    // Defensive: ensure arrays are arrays to prevent .map() TypeError
    if (!Array.isArray(weather.alerts))              weather.alerts = [];
    if (!Array.isArray(weather.daily_forecast))      weather.daily_forecast = [];
    if (!Array.isArray(weather.safe_activities))     weather.safe_activities = [];
    if (!Array.isArray(weather.activities_to_avoid)) weather.activities_to_avoid = [];
    if (!Array.isArray(weather.packing_recommendations)) weather.packing_recommendations = [];
    if (!Array.isArray(weather.transport_warnings))  weather.transport_warnings = [];
    console.log('[renderWeather] Rendering weather for:', weather.destination, '| risk:', weather.risk_level);

    const destName = weather.destination || destCode || 'Your Destination';

    // Build alert banners HTML
    let alertsHtml = '';
    if (weather.alerts && weather.alerts.length > 0) {
        alertsHtml = `<div class="weather-alerts">` +
            weather.alerts.map(a => `
                <div class="weather-alert-banner ${escHtml(a.severity)}">
                    <div class="alert-icon">${a.type === 'STORM' ? '⛈️' :
                        a.type === 'EXTREME_HEAT' ? '🌡️' :
                        a.type === 'EXTREME_COLD' ? '❄️' :
                        a.type === 'HEAVY_RAIN' ? '🌧️' : '💨'}</div>
                    <div class="alert-body">
                        <strong>${escHtml(a.type.replace(/_/g,' '))} — ${escHtml(a.severity)}</strong>
                        <p>${escHtml(a.message)}</p>
                        ${a.dates && a.dates.length ? `<div class="alert-dates">📅 ${a.dates.map(d => formatDisplayDate(d)).join(', ')}</div>` : ''}
                    </div>
                </div>`
            ).join('') +
        `</div>`;
    }

    // Daily forecast cards
    let forecastHtml = '';
    if (weather.daily_forecast && weather.daily_forecast.length > 0) {
        forecastHtml = `
        <div class="forecast-section">
            <div class="section-heading"><i class="fa-solid fa-calendar-days"></i> Day-by-Day Forecast</div>
            <div class="forecast-grid">
                ${weather.daily_forecast.map(day => `
                    <div class="forecast-day">
                        <div class="forecast-date">${formatShortDate(day.date)}</div>
                        <div class="forecast-icon">${escHtml(day.icon)}</div>
                        <div class="forecast-condition">${escHtml(day.condition)}</div>
                        <div class="forecast-temps">
                            <span class="temp-max">${day.temp_max}°</span>
                            <span class="temp-min">${day.temp_min}°</span>
                        </div>
                        <div class="forecast-rain">
                            <i class="fa-solid fa-droplet"></i> ${day.rain_probability}%
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>`;
    }

    // Activity grid
    const safeHtml = (weather.safe_activities || []).slice(0, 6).map(a =>
        `<div class="activity-pill safe"><i class="fa-solid fa-check"></i> ${escHtml(a)}</div>`
    ).join('');
    const avoidHtml = (weather.activities_to_avoid || []).slice(0, 6).map(a =>
        `<div class="activity-pill avoid"><i class="fa-solid fa-xmark"></i> ${escHtml(a)}</div>`
    ).join('');
    const activityGrid = (safeHtml || avoidHtml) ? `
        <div class="section-heading"><i class="fa-solid fa-person-hiking"></i> Activity Guide</div>
        <div class="activity-grid">
            <div class="activity-col safe">
                <h4><i class="fa-solid fa-circle-check"></i> Recommended</h4>
                ${safeHtml || '<div class="activity-pill safe">General sightseeing</div>'}
            </div>
            <div class="activity-col avoid">
                <h4><i class="fa-solid fa-circle-xmark"></i> Use Caution</h4>
                ${avoidHtml || '<div style="font-size:.82rem;color:var(--text-3)">No specific restrictions</div>'}
            </div>
        </div>` : '';

    // Packing chips
    const packingHtml = (weather.packing_recommendations || []).length ? `
        <div class="packing-section">
            <div class="section-heading"><i class="fa-solid fa-bag-shopping"></i> What to Pack</div>
            <div class="packing-chips">
                ${weather.packing_recommendations.map(p =>
                    `<div class="packing-chip"><i class="fa-solid fa-check"></i> ${escHtml(p)}</div>`
                ).join('')}
            </div>
        </div>` : '';

    // Transport warnings
    const transportHtml = (weather.transport_warnings || []).length ? `
        <div class="weather-alerts" style="margin-bottom:20px">
            ${weather.transport_warnings.map(w => `
                <div class="weather-alert-banner ADVISORY">
                    <div class="alert-icon">🚌</div>
                    <div class="alert-body"><p>${escHtml(w)}</p></div>
                </div>`).join('')}
        </div>` : '';

    // AI narrative
    const aiHtml = weather.ai_weather_summary ? `
        <div class="weather-ai-section">
            <div class="weather-ai-header">
                <div class="weather-ai-icon"><i class="fa-solid fa-robot"></i></div>
                <div>
                    <h3>AI Weather Intelligence</h3>
                    <p>Personalized travel recommendations based on real weather data</p>
                </div>
            </div>
            <div class="weather-ai-body markdown-content">
                ${marked.parse(weather.ai_weather_summary)}
            </div>
        </div>` : '';

    wrap.innerHTML = `
        <div class="weather-summary-card">
            <div class="weather-summary-left">
                <div class="weather-dest"><i class="fa-solid fa-location-dot"></i> ${escHtml(destName)}</div>
                <div class="weather-condition-main">${escHtml(weather.overall_condition)} ${weather.daily_forecast?.[0]?.icon || ''}</div>
                <div class="weather-meta-row">
                    <div class="weather-meta-item"><i class="fa-solid fa-droplet"></i> ${weather.humidity}% humidity</div>
                    <div class="weather-meta-item"><i class="fa-solid fa-wind"></i> ${weather.wind_speed_kmh} km/h</div>
                    <div class="weather-meta-item"><i class="fa-solid fa-umbrella"></i> ${weather.avg_rain_probability}% rain chance</div>
                    <div class="weather-meta-item"><i class="fa-solid fa-temperature-half"></i> Feels ${weather.feels_like}°C</div>
                </div>
                <div class="risk-badge ${escHtml(weather.risk_level)}">
                    ${weather.risk_emoji} Risk: ${escHtml(weather.risk_level)}
                </div>
            </div>
            <div style="text-align:right">
                <div class="weather-temp-big">${weather.current_temp}°C</div>
                <div class="weather-temp-range">${escHtml(weather.temperature_range)}</div>
            </div>
        </div>

        ${alertsHtml}
        ${forecastHtml}
        ${aiHtml}
        ${activityGrid}
        ${packingHtml}
        ${transportHtml}
    `;
}

// ── Render Budget Analysis ─────────────────────────────────
function renderBudget(budget, userBudget) {
    const wrap = document.getElementById('budget-analysis-wrap');
    if (!wrap) { console.warn('[renderBudget] #budget-analysis-wrap not found'); return; }
    if (!budget) {
        // Build a simple no-data message but still show the sidebar tracker note
        wrap.innerHTML = `
            <div style="text-align:center;padding:48px 24px;color:var(--text-3)">
                <i class="fa-solid fa-chart-pie" style="font-size:2.5rem;margin-bottom:14px;opacity:.4"></i>
                <h3 style="font-size:1rem;color:var(--text-2);margin-bottom:6px">Budget analysis unavailable</h3>
                <p style="font-size:.85rem">Enter a budget in the search form to see AI-powered cost breakdown and optimization suggestions.</p>
            </div>`;
        return;
    }
    console.log('[renderBudget] Rendering budget | status:', budget.budget_status, '| total_cost:', budget.estimated_total_cost);
    // Defensive: ensure arrays are arrays
    if (!Array.isArray(budget.optimization_suggestions)) budget.optimization_suggestions = [];
    // Ensure cost_breakdown exists
    if (!budget.cost_breakdown) budget.cost_breakdown = { flights:0, hotels:0, food:0, transportation:0, activities:0, emergency_reserve:0 };

    const cb = budget.cost_breakdown;
    const statusLabel = budget.budget_status.replace(/_/g, ' ');
    const remaining = budget.remaining_budget;
    const remainingAbs = Math.abs(remaining);

    const costRows = [
        { icon: 'flight',     fa: 'fa-plane',        label: 'Flights (cheapest)',      val: cb.flights },
        { icon: 'hotel',      fa: 'fa-hotel',         label: 'Hotels (cheapest × nights)', val: cb.hotels },
        { icon: 'food',       fa: 'fa-utensils',      label: 'Food & Dining',           val: cb.food },
        { icon: 'transport',  fa: 'fa-bus',           label: 'Local Transport',          val: cb.transportation },
        { icon: 'activities', fa: 'fa-ticket',        label: 'Activities',               val: cb.activities },
        { icon: 'emergency',  fa: 'fa-shield-halved', label: 'Emergency Reserve',        val: cb.emergency_reserve },
    ];

    const tipsHtml = (budget.optimization_suggestions || []).length
        ? budget.optimization_suggestions.map(tip =>
            `<div class="optimization-tip">
                <i class="fa-solid fa-lightbulb tip-icon"></i>
                <span>${escHtml(tip)}</span>
            </div>`
        ).join('')
        : '<p style="color:var(--text-3);font-size:.85rem">No specific optimizations needed.</p>';

    const aiHtml = budget.ai_budget_analysis ? `
        <div class="budget-ai-section">
            <div class="budget-ai-header">
                <div class="budget-ai-icon"><i class="fa-solid fa-robot"></i></div>
                <div>
                    <h3>AI Budget Analysis</h3>
                    <p>Personalized financial recommendations for your trip</p>
                </div>
            </div>
            <div class="budget-ai-body markdown-content">
                ${marked.parse(budget.ai_budget_analysis)}
            </div>
        </div>` : '';

    wrap.innerHTML = `
        <div class="budget-status-card ${escHtml(budget.budget_status)}">
            <div class="budget-status-emoji">${escHtml(budget.budget_status_emoji)}</div>
            <div class="budget-status-text">
                <strong>${escHtml(statusLabel)}</strong>
                <span>${remaining >= 0
                    ? `₹${formatCurrency(remainingAbs)} under budget`
                    : `₹${formatCurrency(remainingAbs)} over budget`}</span>
            </div>
            <div class="budget-amounts">
                <div class="amount-label">Est. Total</div>
                <div class="amount-val">₹${formatCurrency(budget.estimated_total_cost)}</div>
            </div>
        </div>

        <div class="cost-breakdown-card">
            <div class="cost-breakdown-header">
                <i class="fa-solid fa-list-ul"></i> Cost Breakdown
            </div>
            <table class="cost-table">
                ${costRows.map(r => `
                    <tr>
                        <td>
                            <div class="cost-icon ${r.icon}"><i class="fa-solid ${r.fa}"></i></div>
                            ${escHtml(r.label)}
                        </td>
                        <td>₹${formatCurrency(r.val)}</td>
                    </tr>`).join('')}
                <tr class="total-row">
                    <td><div class="cost-icon" style="background:#e8effd;color:var(--brand)"><i class="fa-solid fa-sigma"></i></div> <strong>Estimated Total</strong></td>
                    <td><strong>₹${formatCurrency(budget.estimated_total_cost)}</strong></td>
                </tr>
                <tr>
                    <td><div class="cost-icon" style="background:#f0f5ff;color:var(--brand-light)"><i class="fa-solid fa-wallet"></i></div> Your Budget</td>
                    <td style="color:var(--brand-light);font-weight:700">₹${formatCurrency(budget.user_budget)}</td>
                </tr>
            </table>
        </div>

        ${aiHtml}

        <div class="cost-breakdown-card" style="margin-bottom:0">
            <div class="cost-breakdown-header">
                <i class="fa-solid fa-lightbulb"></i> Optimization Strategies
            </div>
            <div style="padding:18px 22px">
                <div class="optimization-list">${tipsHtml}</div>
            </div>
        </div>
    `;
}

// ── Render Travel Score ────────────────────────────────────
function renderTravelScore(score) {
    const wrap = document.getElementById('score-wrap');
    const badgeWrap = document.getElementById('score-badge-wrap');
    const badgeVal  = document.getElementById('score-badge-val');

    if (!wrap) { console.warn('[renderTravelScore] #score-wrap not found'); return; }
    if (!score) {
        wrap.innerHTML = emptyState('star', 'Travel Score unavailable',
            'Search with a valid destination to compute your travel score.');
        return;
    }
    console.log('[renderTravelScore] Rendering score:', score.total_score, '| grade:', score.grade);
    // Defensive: ensure arrays are arrays
    if (!Array.isArray(score.factors)) score.factors = [];

    // Update mini badge in trip header
    badgeWrap.style.display = 'flex';
    badgeVal.textContent = score.total_score;

    // Determine gauge color based on score
    const gaugeColor = score.total_score >= 75 ? '#4ade80'
        : score.total_score >= 55 ? '#60a5fa'
        : score.total_score >= 40 ? '#fbbf24' : '#f87171';

    // SVG gauge: circumference for r=55 ≈ 345.4
    const circ = 345.4;
    const fill = (score.total_score / 100) * circ;

    // Factor bar colors
    const factorColors = ['#60a5fa', '#4ade80', '#fbbf24', '#c084fc', '#f97316'];

    const factorsHtml = (score.factors || []).map((f, i) => {
        const pct = Math.round((f.score / f.max_score) * 100);
        const color = factorColors[i % factorColors.length];
        return `
            <div class="score-factor-row">
                <div class="score-factor-top">
                    <span class="score-factor-name">${escHtml(f.name)}</span>
                    <span class="score-factor-val">${f.score}/${f.max_score}</span>
                </div>
                <div class="score-factor-bar-track">
                    <div class="score-factor-bar-fill" style="width:${pct}%;background:${color}"></div>
                </div>
                <div class="score-factor-desc">${escHtml(f.description)}</div>
            </div>`;
    }).join('');

    const aiHtml = score.ai_explanation ? `
        <div class="score-ai-card">
            <div class="score-ai-header">
                <div class="score-ai-icon"><i class="fa-solid fa-robot"></i></div>
                <div>
                    <h3>Score Breakdown</h3>
                    <p>How your travel score was calculated</p>
                </div>
            </div>
            <div class="score-ai-body markdown-content">
                ${marked.parse(score.ai_explanation)}
            </div>
        </div>` : '';

    wrap.innerHTML = `
        <div class="score-hero">
            <div class="score-gauge-wrap">
                <svg class="score-gauge" viewBox="0 0 130 130">
                    <circle class="gauge-bg" cx="65" cy="65" r="55"/>
                    <circle class="gauge-fill" cx="65" cy="65" r="55"
                        stroke="${gaugeColor}"
                        stroke-dasharray="${fill} ${circ - fill}"
                        stroke-dashoffset="${circ * 0.25}"/>
                </svg>
                <div class="score-gauge-center">
                    <span class="score-gauge-val">${score.total_score}</span>
                    <span class="score-gauge-max">/100</span>
                </div>
            </div>
            <div class="score-info">
                <div class="score-grade-row">
                    <div class="score-grade-badge grade-${escHtml(score.grade)}">${escHtml(score.grade)}</div>
                    <div class="score-grade-label">${escHtml(score.grade_label)}</div>
                </div>
                <div class="score-verdict">${escHtml(score.overall_verdict)}</div>
                <div class="score-verdict-badge">
                    <i class="fa-solid fa-compass"></i> ${escHtml(score.overall_verdict)}
                </div>
            </div>
        </div>

        <div class="score-factors-card">
            <div class="score-factors-header">
                <i class="fa-solid fa-sliders"></i> Score Factors
            </div>
            <div class="score-factors-list">
                ${factorsHtml}
            </div>
        </div>

        ${aiHtml}
    `;
}

// ── Budget Tracker ─────────────────────────────────────────
function updateBudgetTracker(totalBudget) {
    const flightCost = selectedFlight ? selectedFlight.price : 0;
    const stayCost   = selectedHotel  ? selectedHotel.totalPrice : 0;
    const spent      = flightCost + stayCost;
    const remaining  = totalBudget - spent;
    const pct        = totalBudget > 0 ? Math.min(spent / totalBudget * 100, 100) : 0;

    // Text
    elTotalBudget.textContent = `₹${formatCurrency(totalBudget)}`;
    elTotalSpent.textContent  = `₹${formatCurrency(spent)}`;
    elRemaining.textContent   = `₹${formatCurrency(Math.abs(remaining))}`;
    elFlight.textContent      = `₹${formatCurrency(flightCost)}`;
    elStay.textContent        = `₹${formatCurrency(stayCost)}`;

    // Donut SVG  (circumference ≈ 314.16 for r=50)
    const circ = 314.16;
    const fill = (pct / 100) * circ;
    elDonutFill.setAttribute('stroke-dasharray', `${fill} ${circ - fill}`);
    elDonutPct.textContent = `${Math.round(pct)}%`;

    // Progress bar
    elProgress.style.width = `${pct}%`;

    // Color / status
    if (spent === 0) {
        elProgress.style.background = 'linear-gradient(90deg, #006ce4, #003580)';
        elDonutFill.style.stroke    = '#006ce4';
        elStatus.className = 'bc-status';
        elStatus.innerHTML = '<i class="fa-solid fa-circle-info"></i> Select a flight & hotel to track spend';
        elRemaining.style.color = '';
    } else if (remaining >= 0) {
        elProgress.style.background = 'linear-gradient(90deg, #00875a, #00a86b)';
        elDonutFill.style.stroke    = '#00875a';
        elStatus.className = 'bc-status green';
        elStatus.innerHTML = '<i class="fa-solid fa-circle-check"></i> Within budget';
        elRemaining.style.color = '#00875a';
    } else {
        elProgress.style.background = 'linear-gradient(90deg, #d32f2f, #f44336)';
        elDonutFill.style.stroke    = '#d32f2f';
        elStatus.className = 'bc-status red';
        elStatus.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Exceeded by ₹${formatCurrency(Math.abs(remaining))}`;
        elRemaining.style.color = '#d32f2f';
    }

    // Selection display
    if (selectedFlight) {
        elSelFlight.className = 'bc-sel-item has-selection';
        elSelFlight.innerHTML = `<i class="fa-solid fa-check-circle"></i> ${escHtml(selectedFlight.airline)} · ₹${formatCurrency(selectedFlight.price)}`;
    } else {
        elSelFlight.className = 'bc-sel-item';
        elSelFlight.innerHTML = '<i class="fa-regular fa-circle"></i> No flight selected';
    }
    if (selectedHotel) {
        elSelHotel.className = 'bc-sel-item has-selection';
        elSelHotel.innerHTML = `<i class="fa-solid fa-check-circle"></i> ${escHtml(selectedHotel.name)} · ₹${formatCurrency(selectedHotel.totalPrice)}`;
    } else {
        elSelHotel.className = 'bc-sel-item';
        elSelHotel.innerHTML = '<i class="fa-regular fa-circle"></i> No hotel selected';
    }
}

// ── Loading Steps Animation ────────────────────────────────
function animateLoadingSteps() {
    const steps = ['lstep-flights', 'lstep-hotels', 'lstep-weather', 'lstep-budget', 'lstep-ai'];
    let i = 0;
    document.querySelectorAll('.lstep').forEach(s => s.classList.remove('active'));
    const iv = setInterval(() => {
        if (i > 0) document.getElementById(steps[i-1])?.classList.remove('active');
        if (i < steps.length) {
            document.getElementById(steps[i])?.classList.add('active');
            i++;
        } else {
            clearInterval(iv);
        }
    }, 3000);
}

// ── Toast Notification ─────────────────────────────────────
// NOTE: showToast is defined once below in the AUTH block — this is a deliberate
// single-definition to avoid duplicate function conflicts.
// (Former duplicate removed — the authoritative showToast is at the auth section)

// ── Empty State HTML ───────────────────────────────────────
function emptyState(icon, title, sub) {
    return `<div style="text-align:center;padding:48px 24px;color:var(--text-3)">
        <i class="fa-solid fa-${icon}" style="font-size:2.5rem;margin-bottom:14px;opacity:.4"></i>
        <h3 style="font-size:1rem;color:var(--text-2);margin-bottom:6px">${title}</h3>
        <p style="font-size:.85rem">${sub}</p>
    </div>`;
}

// ── Utility Helpers ────────────────────────────────────────
function formatDate(date) {
    const d = new Date(date);
    return [
        d.getFullYear(),
        String(d.getMonth()+1).padStart(2,'0'),
        String(d.getDate()).padStart(2,'0')
    ].join('-');
}

function formatDisplayDate(str) {
    const opts = { day:'numeric', month:'short', year:'numeric' };
    return new Date(str).toLocaleDateString('en-IN', opts);
}

function formatShortDate(str) {
    // "2026-09-01" → "Tue, Sep 1"
    try {
        const d = new Date(str + 'T00:00:00');
        return d.toLocaleDateString('en-IN', { weekday:'short', month:'short', day:'numeric' });
    } catch {
        return str;
    }
}

function parsePrice(str) {
    if (!str || str === 'N/A') return 0;
    return parseFloat(String(str).replace(/[^0-9.]/g,'')) || 0;
}

function formatCurrency(n) {
    return Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function getRatingWord(r) {
    if (r >= 4.7) return 'Exceptional';
    if (r >= 4.3) return 'Excellent';
    if (r >= 4.0) return 'Very Good';
    if (r >= 3.5) return 'Good';
    return 'Pleasant';
}

function formatStops(stops) {
    if (!stops) return 'Non-stop';
    const s = String(stops).toLowerCase();
    if (s === '0' || s === 'nonstop' || s === 'non-stop') return 'Non-stop';
    if (s === '1') return '1 stop';
    return stops;
}

function parseFlightTime(str) {
    if (!str) return '—';
    // Match "at HH:MM AM/PM" or similar
    const match = str.match(/at\s+([\d:]+\s*(?:AM|PM)?)/i);
    if (match) return match[1].trim();
    // Fallback: last "time-like" segment
    const parts = str.split(' at ');
    return parts.length > 1 ? parts[1].split(' ')[0] : str.substring(0, 8);
}

function parseCityCode(str) {
    if (!str) return '—';
    const match = str.match(/\(([A-Z]{3})\)/);
    return match ? match[1] : str.substring(0, 3).toUpperCase();
}

function escHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;');
}

function downloadMarkdown(text, dest, date) {
    const blob = new Blob([text], { type: 'text/markdown' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `itinerary_${dest}_${date}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}


/* ============================================================
   CONTEXT-AWARE AI TRAVEL ASSISTANT CHAT
   ============================================================ */

// Chat State
let chatHistory = [];   // Array of {role, content}
let chatOpen    = false;
let chatBusy    = false;

// Chat DOM
const chatFab     = document.getElementById('chat-fab');
const chatFabIcon = document.getElementById('chat-fab-icon');
const chatPanel   = document.getElementById('chat-panel');
const chatMsgs    = document.getElementById('chat-messages');
const chatForm    = document.getElementById('chat-input-form');
const chatInput   = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send-btn');
const chatStatus  = document.getElementById('chat-status');

// ── Toggle Chat ────────────────────────────────────────────
if (chatFab) {
    chatFab.addEventListener('click', () => {
        chatOpen = !chatOpen;

        if (chatPanel) {
            chatPanel.classList.toggle('hidden', !chatOpen);
        }

        chatFab.classList.toggle('active', chatOpen);

        if (chatFabIcon) {
            chatFabIcon.className = chatOpen
                ? 'fa-solid fa-xmark'
                : 'fa-solid fa-comments';
        }

        if (chatOpen) {
            if (chatInput) {
                chatInput.focus();
            }

            scrollChatBottom();
        }
    });
}

document.getElementById('chat-close')?.addEventListener('click', () => {
    chatOpen = false;

    if (chatPanel) {
        chatPanel.classList.add('hidden');
    }

    if (chatFab) {
        chatFab.classList.remove('active');
    }

    if (chatFabIcon) {
        chatFabIcon.className = 'fa-solid fa-comments';
    }
});

document.getElementById('chat-clear')?.addEventListener('click', () => {
    chatHistory = [];

    if (chatMsgs) {
        chatMsgs.innerHTML = '';
    }

    addChatMsg(
        'assistant',
        "Chat cleared! I'm ready to help with your travel plans. 🌍\n\nAsk me about your flights, hotels, budget, weather, packing, or anything travel-related."
    );
});

// ── Quick Suggestion Chips ─────────────────────────────────
document.querySelectorAll('.chat-chip').forEach(chip => {
    chip.addEventListener('click', () => {
        const msg = chip.getAttribute('data-msg');
        if (msg && !chatBusy) sendChatMessage(msg);
    });
});

// ── Form Submit ────────────────────────────────────────────
if (chatForm && chatInput) {
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const msg = chatInput.value.trim();

        if (!msg || chatBusy) {
            return;
        }

        sendChatMessage(msg);
    });
}

// ── Build Trip Context Snapshot ─────────────────────────────
function buildTripContext() {
    const origin      = document.getElementById('origin').value.trim().toUpperCase();
    const destination = document.getElementById('destination').value.trim().toUpperCase();
    const outbound    = document.getElementById('outbound-date').value;
    const ret         = document.getElementById('return-date').value;
    const budget      = parseFloat(document.getElementById('budget').value) || 0;

    const flightCost = selectedFlight ? selectedFlight.price : 0;
    const hotelCost  = selectedHotel  ? selectedHotel.totalPrice : 0;
    const totalSpent = flightCost + hotelCost;

    // Summarize available flights
    const availFlights = (flightsData || []).map(f => ({
        airline:        f.airline,
        price:          f.price,
        duration:       f.duration,
        stops:          f.stops,
        departure:      f.departure,
        arrival:        f.arrival,
        departure_time: f.departure_time,
        arrival_time:   f.arrival_time,
        travel_class:   f.travel_class,
    }));

    // Summarize available hotels
    const availHotels = (hotelsData || []).map(h => ({
        name:     h.name,
        price:    h.price,
        rating:   h.rating,
        location: h.location,
    }));

    // Weather + budget context for chat
    const weather = currentTripData?.weather_analysis;
    const budgetAn = currentTripData?.budget_analysis;
    const tScore  = currentTripData?.travel_score;

    return {
        origin,
        destination,
        outbound_date:            outbound,
        return_date:              ret,
        budget,
        trip_nights:              tripNights,
        selected_flight:          selectedFlight,
        selected_hotel:           selectedHotel,
        available_flights:        availFlights,
        available_hotels:         availHotels,
        itinerary:                currentTripData ? currentTripData.itinerary : null,
        ai_flight_recommendation: currentTripData ? currentTripData.ai_flight_recommendation : null,
        ai_hotel_recommendation:  currentTripData ? currentTripData.ai_hotel_recommendation : null,
        total_flight_cost:        flightCost,
        total_hotel_cost:         hotelCost,
        total_spent:              totalSpent,
        remaining_budget:         budget - totalSpent,
        // New weather + budget + score context
        weather_risk_level: weather?.risk_level || null,
        weather_summary:    weather?.ai_weather_summary?.slice(0, 300) || weather?.overall_condition || null,
        budget_status:      budgetAn?.budget_status || null,
        travel_score:       tScore?.total_score ?? null,
    };
}

// ── Send Message ───────────────────────────────────────────
async function sendChatMessage(msg) {
    if (chatBusy) return;
    chatBusy = true;
    chatInput.value = '';
    chatSendBtn.disabled = true;
    chatStatus.textContent = 'Thinking…';

    // Add user message
    addChatMsg('user', msg);
    chatHistory.push({ role: 'user', content: msg });

    // Show typing indicator
    const typingEl = showTypingIndicator();

    try {
        const res = await fetch(BACKEND_URL + '/chat/', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                message: msg,
                context: buildTripContext(),
                history: chatHistory.slice(-12),
            }),
        });

        // Remove typing indicator
        typingEl.remove();

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || 'Chat request failed');
        }

        const data = await res.json();
        const reply = data.reply || 'Sorry, I could not generate a response.';

        addChatMsg('assistant', reply);
        chatHistory.push({ role: 'assistant', content: reply });

    } catch (err) {
        typingEl.remove();
        addChatMsg('assistant', `⚠️ Error: ${err.message}. Please try again.`);
    } finally {
        chatBusy = false;
        chatSendBtn.disabled = false;
        chatStatus.textContent = 'Online · Context-Aware';
        chatInput.focus();
    }
}

// ── Add Message to DOM ─────────────────────────────────────
function addChatMsg(role, text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-msg ${role}`;

    const avatarIcon = role === 'assistant'
        ? 'fa-solid fa-plane-circle-check'
        : 'fa-solid fa-user';

    // Render markdown for assistant, plain text for user
    const content = role === 'assistant'
        ? marked.parse(text)
        : `<p>${escHtml(text)}</p>`;

    msgDiv.innerHTML = `
        <div class="chat-msg-avatar"><i class="${avatarIcon}"></i></div>
        <div class="chat-msg-bubble">${content}</div>
    `;
    chatMsgs.appendChild(msgDiv);
    scrollChatBottom();
}

// ── Typing Indicator ───────────────────────────────────────
function showTypingIndicator() {
    const el = document.createElement('div');
    el.className = 'chat-msg assistant';
    el.innerHTML = `
        <div class="chat-msg-avatar"><i class="fa-solid fa-plane-circle-check"></i></div>
        <div class="chat-msg-bubble">
            <div class="chat-typing">
                <div class="chat-typing-dot"></div>
                <div class="chat-typing-dot"></div>
                <div class="chat-typing-dot"></div>
            </div>
        </div>
    `;
    chatMsgs.appendChild(el);
    scrollChatBottom();
    return el;
}

// ── Scroll to Bottom ───────────────────────────────────────
function scrollChatBottom() {
    requestAnimationFrame(() => {
        chatMsgs.scrollTop = chatMsgs.scrollHeight;
    });
}

// ══════════════════════════════════════════════════════════════════════════════
// AUTH + DESTINATIONS + PLANNERS + SAVED TRIPS — NEW FEATURE BLOCK
// ══════════════════════════════════════════════════════════════════════════════

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

// ── API helpers ───────────────────────────────────────────────────────────────
async function apiSignup(name, email, password, role = 'traveler') {
  const res = await fetch(BACKEND_URL + '/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, role }),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Signup failed'); }
  return res.json();
}
async function apiLogin(email, password) {
  const res = await fetch(BACKEND_URL + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Login failed'); }
  return res.json();
}
async function apiGetMyTrips() {
  const token = getToken();
  if (!token) return [];
  const res = await fetch(BACKEND_URL + '/api/ai-trips/my', { headers: { 'Authorization': `Bearer ${token}` } });
  return res.ok ? res.json() : [];
}
async function apiSaveAITrip(data) {
  const token = getToken();
  if (!token) throw new Error('Login required');
  const res = await fetch(BACKEND_URL + '/api/ai-trips/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Save failed'); }
  return res.json();
}
async function apiGetDestinations() {
  try { const r = await fetch(BACKEND_URL + '/api/destinations/?limit=100'); return r.ok ? r.json() : []; } catch { return []; }
}
async function apiGetDestination(id) {
  const r = await fetch(BACKEND_URL + `/api/destinations/${id}`);
  if (!r.ok) throw new Error('Destination not found');
  return r.json();
}
async function apiGetPlanners() {
  try { const r = await fetch(BACKEND_URL + '/api/planners/?limit=100'); return r.ok ? r.json() : []; } catch { return []; }
}
async function apiGetPlanner(id) {
  const r = await fetch(BACKEND_URL + `/api/planners/${id}`);
  if (!r.ok) throw new Error('Planner not found');
  return r.json();
}
async function apiSavePlannerProfile(payload) {
  const token = getToken();
  if (!token) throw new Error('Login required');
  const res = await fetch(BACKEND_URL + '/api/planners/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.detail || 'Could not save profile'); }
  return res.json();
}
async function apiGetPackages(destinationId) {
  try {
    const url = BACKEND_URL + (destinationId ? `/api/packages/?destination_id=${destinationId}&limit=100` : '/api/packages/?limit=100');
    const r = await fetch(url);
    return r.ok ? r.json() : [];
  } catch { return []; }
}
async function apiGetPackage(id) {
  const r = await fetch(BACKEND_URL + `/api/packages/${id}`);
  if (!r.ok) throw new Error('Package not found');
  return r.json();
}
async function apiGetDestinationBlogs(destinationId) {
  try {
    const r = await fetch(BACKEND_URL + `/api/blogs/destination/${destinationId}`);
    return r.ok ? r.json() : [];
  } catch { return []; }
}
async function apiGetDestinationReviews(destinationId) {
  try {
    const r = await fetch(BACKEND_URL + `/api/reviews/destination/${destinationId}`);
    return r.ok ? r.json() : [];
  } catch { return []; }
}
async function apiGetDestinationWeather(destinationName) {
  const today = new Date();
  const end = new Date(today);
  end.setDate(today.getDate() + 5);
  try {
    const r = await fetch(BACKEND_URL + '/search_weather/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        destination: destinationName,
        start_date: formatDate(today),
        end_date: formatDate(end),
      }),
    });
    return r.ok ? r.json() : null;
  } catch {
    return null;
  }
}
async function apiCreatePackage(payload) {
  const token = getToken();
  if (!token) throw new Error('Login required');
  const res = await fetch(BACKEND_URL + '/api/packages/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.detail || 'Could not create package'); }
  return res.json();
}
async function apiGetMyPackages() {
  const token = getToken();
  if (!token) return [];
  try {
    const r = await fetch(BACKEND_URL + '/api/packages/mine', { headers: { 'Authorization': `Bearer ${token}` } });
    return r.ok ? r.json() : [];
  } catch { return []; }
}
async function apiUpdatePackageStatus(packageId, status) {
  const token = getToken();
  if (!token) throw new Error('Login required');
  const res = await fetch(BACKEND_URL + `/api/packages/${packageId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.detail || 'Could not update package'); }
  return res.json();
}
async function apiDeletePackage(packageId) {
  const token = getToken();
  if (!token) throw new Error('Login required');
  const res = await fetch(BACKEND_URL + `/api/packages/${packageId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 204) { const e = await res.json().catch(()=>({})); throw new Error(e.detail || 'Could not delete package'); }
}
async function apiGetChatRooms() {
  const token = getToken();
  if (!token) return [];
  try {
    const r = await fetch(BACKEND_URL + '/api/chat/rooms', { headers: { 'Authorization': `Bearer ${token}` } });
    return r.ok ? r.json() : [];
  } catch { return []; }
}
async function apiCreateBlog(payload) {
  const token = getToken();
  if (!token) throw new Error('Login required');
  const res = await fetch(BACKEND_URL + '/api/blogs/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.detail || 'Could not publish blog'); }
  return res.json();
}
async function apiGetPlannerReviews(plannerUserId) {
  try { const r = await fetch(BACKEND_URL + `/api/reviews/planner/${plannerUserId}`); return r.ok ? r.json() : []; } catch { return []; }
}
async function apiCreateReview(payload) {
  const token = getToken();
  if (!token) throw new Error('Login required');
  const res = await fetch(BACKEND_URL + '/api/reviews/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.detail || 'Could not submit review'); }
  return res.json();
}
async function apiCreateTripRequest(payload) {
  const token = getToken();
  if (!token) throw new Error('Login required');
  const res = await fetch(BACKEND_URL + '/api/trips/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.detail || 'Could not send request'); }
  return res.json();
}
async function apiGetMyTripRequests() {
  const token = getToken();
  if (!token) return [];
  try {
    const r = await fetch(BACKEND_URL + '/api/trips/my', { headers: { 'Authorization': `Bearer ${token}` } });
    return r.ok ? r.json() : [];
  } catch { return []; }
}
async function apiUpdateTripStatus(tripId, status) {
  const token = getToken();
  if (!token) throw new Error('Login required');
  const res = await fetch(BACKEND_URL + `/api/trips/${tripId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.detail || 'Could not update status'); }
  return res.json();
}
async function apiGetFavorites() {
  const token = getToken();
  if (!token) return [];
  try {
    const r = await fetch(BACKEND_URL + '/api/favorites/my', { headers: { 'Authorization': `Bearer ${token}` } });
    return r.ok ? r.json() : [];
  } catch { return []; }
}
async function apiAddFavorite(payload) {
  const token = getToken();
  if (!token) throw new Error('Login required');
  const res = await fetch(BACKEND_URL + '/api/favorites/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.detail || 'Could not add favorite'); }
  return res.json();
}
async function apiRemoveFavorite(favoriteId) {
  const token = getToken();
  if (!token) throw new Error('Login required');
  const res = await fetch(BACKEND_URL + `/api/favorites/${favoriteId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 204) throw new Error('Could not remove favorite');
}

// ── Navbar auth UI ────────────────────────────────────────────────────────────
function updateNavAuth() {
    const area = document.getElementById('nav-auth-area');

    if (!area) {
        console.error('[AUTH] #nav-auth-area not found');
        return;
    }

    const user = getUser();

    // ========================================================
    // LOGGED IN
    // ========================================================

    if (user) {

        const isPlanner =
            user.role === 'planner' ||
            user.role === 'package_provider' ||
            user.role === 'admin';

        const firstName =
            user.name
                ? user.name.split(' ')[0]
                : 'User';

        area.innerHTML = `
            <div class="nav-user-menu">

                <span class="nav-user-name">
                    <i class="fa-solid fa-circle-user"></i>
                    ${escHtml(firstName)}
                </span>

                <button
                    type="button"
                    class="nav-my-trips-btn"
                    id="nav-my-trips">

                    <i class="fa-solid fa-bookmark"></i>
                    My Trips

                </button>

                ${
                    isPlanner
                        ? `
                        <button
                            type="button"
                            class="nav-dash-btn"
                            id="nav-dashboard">

                            <i class="fa-solid fa-briefcase"></i>
                            Dashboard

                        </button>
                        `
                        : `
                        <button
                            type="button"
                            class="nav-planner-btn"
                            id="nav-become-planner">

                            <i class="fa-solid fa-user-tie"></i>
                            Become a Planner

                        </button>
                        `
                }

                <button
                    type="button"
                    class="nav-logout-btn"
                    id="nav-logout">

                    <i class="fa-solid fa-right-from-bracket"></i>
                    Sign out

                </button>

            </div>
        `;

        document
            .getElementById('nav-logout')
            ?.addEventListener('click', () => {

                clearAuth();

                favoritesCache = null;
                currentTripData = null;
                selectedFlight = null;
                selectedHotel = null;

                updateNavAuth();
                applyRoleView();

                showToast('Signed out successfully.');
            });

        document
            .getElementById('nav-my-trips')
            ?.addEventListener(
                'click',
                openMyTripsModal
            );

        document
            .getElementById('nav-dashboard')
            ?.addEventListener(
                'click',
                () => openDashboardModal()
            );

        document
            .getElementById('nav-become-planner')
            ?.addEventListener(
                'click',
                () => openDashboardModal()
            );

        return;
    }

    // ========================================================
    // LOGGED OUT
    // ========================================================

    area.innerHTML = `
        <button
            type="button"
            class="nav-signin-btn"
            id="nav-signin-btn">

            <i class="fa-solid fa-right-to-bracket"></i>
            Sign in

        </button>
    `;

    const signInBtn =
        document.getElementById('nav-signin-btn');

    if (signInBtn) {

        signInBtn.addEventListener(
            'click',
            function (e) {

                e.preventDefault();
                e.stopPropagation();

                console.log(
                    '[AUTH] Sign in button clicked'
                );

                openAuthModal('login');
            }
        );
    }
}

// ── Auth Modal ────────────────────────────────────────────────────────────────
let _authMode = 'login';

function openAuthModal(mode = 'login') {
    _authMode = mode === 'signup' ? 'signup' : 'login';

    const modal = document.getElementById('auth-modal');
    const title = document.getElementById('auth-modal-title');
    const nameField = document.getElementById('auth-name-field');
    const roleField = document.getElementById('auth-role-field');
    const submitBtn = document.getElementById('auth-submit-btn');
    const switchText = document.getElementById('auth-switch-text');
    const errorEl = document.getElementById('auth-error');

    if (!modal) {
        console.error('Auth modal not found');
        return;
    }

    // Show modal
    modal.classList.remove('hidden');

    // Title
    if (title) {
        title.textContent =
            _authMode === 'login'
                ? 'Welcome back'
                : 'Create account';
    }

    // Show/hide signup-only fields
    if (nameField) {
        nameField.style.display =
            _authMode === 'signup' ? 'flex' : 'none';
    }

    if (roleField) {
        roleField.style.display =
            _authMode === 'signup' ? 'flex' : 'none';
    }

    // Name is required only during signup
    const nameInput = document.getElementById('auth-name');

    if (nameInput) {
        nameInput.required = _authMode === 'signup';
    }

    // Submit button
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML =
            _authMode === 'login'
                ? '<i class="fa-solid fa-right-to-bracket"></i> Sign in'
                : '<i class="fa-solid fa-user-plus"></i> Create account';
    }

    // IMPORTANT:
    // Sign up / Sign in link is dynamically generated.
    if (switchText) {
        if (_authMode === 'login') {
            switchText.innerHTML = `
                Don't have an account?
                <a href="#" id="auth-switch-link" data-mode="signup">
                    Sign up
                </a>
            `;
        } else {
            switchText.innerHTML = `
                Already have an account?
                <a href="#" id="auth-switch-link" data-mode="login">
                    Sign in
                </a>
            `;
        }
    }

    // Clear previous error
    if (errorEl) {
        errorEl.textContent = '';
    }

    // Focus
    setTimeout(() => {
        if (_authMode === 'signup' && nameInput) {
            nameInput.focus();
        } else {
            document.getElementById('auth-email')?.focus();
        }
    }, 100);
}


function closeAuthModal() {

    const modal =
        document.getElementById(
            'auth-modal'
        );

    if (modal) {
        modal.classList.add('hidden');
    }
}


async function handleAuthSubmit(e) {

    e.preventDefault();

    console.log(
        `[AUTH] Form submitted: ${_authMode}`
    );

    const errorEl =
        document.getElementById(
            'auth-error'
        );

    const btnEl =
        document.getElementById(
            'auth-submit-btn'
        );

    const emailInput =
        document.getElementById(
            'auth-email'
        );

    const passwordInput =
        document.getElementById(
            'auth-password'
        );

    if (!emailInput || !passwordInput) {

        console.error(
            '[AUTH] Email/password field missing'
        );

        if (errorEl) {
            errorEl.textContent =
                'Authentication form is not configured correctly.';
        }

        return;
    }

    const email =
        emailInput.value.trim();

    const password =
        passwordInput.value;

    if (!email || !password) {

        if (errorEl) {
            errorEl.textContent =
                'Please enter your email and password.';
        }

        return;
    }

    if (errorEl) {
        errorEl.textContent = '';
    }

    if (btnEl) {

        btnEl.disabled = true;

        btnEl.innerHTML =
            '<i class="fa-solid fa-circle-notch fa-spin"></i> Please wait...';
    }

    try {

        let result;

        if (_authMode === 'login') {

            console.log(
                '[AUTH] Calling POST /api/auth/login'
            );

            result =
                await apiLogin(
                    email,
                    password
                );

        } else {

            const nameInput =
                document.getElementById(
                    'auth-name'
                );

            const roleInput =
                document.getElementById(
                    'auth-role'
                );

            const name =
                nameInput
                    ? nameInput.value.trim()
                    : '';

            const role =
                roleInput
                    ? roleInput.value
                    : 'traveler';

            if (!name) {

                if (errorEl) {
                    errorEl.textContent =
                        'Please enter your name.';
                }

                return;
            }

            console.log(
                '[AUTH] Calling POST /api/auth/signup'
            );

            result =
                await apiSignup(
                    name,
                    email,
                    password,
                    role
                );
        }

        console.log(
            '[AUTH] Authentication successful',
            result
        );

        setAuth(result);

        updateNavAuth();
        applyRoleView();

        closeAuthModal();

        const firstName =
            result?.user?.name
                ? result.user.name.split(' ')[0]
                : 'there';

        showToast(
            `Welcome, ${firstName}! 👋`
        );

        if (window._pendingAfterLogin) {

            const pending =
                window._pendingAfterLogin;

            window._pendingAfterLogin = null;

            setTimeout(() => {

                try {
                    pending();
                } catch (err) {

                    console.error(
                        '[AUTH] Pending action failed:',
                        err
                    );
                }

            }, 100);
        }

    } catch (err) {

        console.error(
            '[AUTH] Authentication error:',
            err
        );

        if (errorEl) {
            errorEl.textContent =
                err.message ||
                'Authentication failed.';
        }

    } finally {

        if (btnEl) {

            btnEl.disabled = false;

            btnEl.textContent =
                _authMode === 'login'
                    ? 'Sign in'
                    : 'Create account';
        }
    }
}

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

/* ============================================================
   BROWSE ("View All") MODAL
   ============================================================ */
async function openBrowseModal(type) {

    console.log('[BROWSE] Opening:', type);

    const modal = document.getElementById('browse-modal');
    const title = document.getElementById('browse-modal-title');
    const grid = document.getElementById('browse-modal-grid');
    const filterBar = document.getElementById('browse-filter-bar');
    const filterSel = document.getElementById('browse-dest-filter');

    if (!modal) {
        console.error('[BROWSE] #browse-modal not found');
        return;
    }

    if (!title) {
        console.error('[BROWSE] #browse-modal-title not found');
        return;
    }

    if (!grid) {
        console.error('[BROWSE] #browse-modal-grid not found');
        return;
    }

    modal.classList.remove('hidden');

    grid.innerHTML = `
        <div class="dest-loading">
            <i class="fa-solid fa-circle-notch fa-spin"></i>
            Loading...
        </div>
    `;

    try {

        await ensureFavoritesLoaded();

        if (type === 'destinations') {

            title.innerHTML =
                '<i class="fa-solid fa-map-location-dot"></i> All Destinations';

            if (filterBar) {
                filterBar.classList.remove('hidden');
                filterBar.innerHTML = `
                    <input type="search" id="browse-destination-search" placeholder="Search destinations">
                    <select id="browse-state-filter"><option value="">All states</option></select>
                `;
            }

            const dests =
                window._allDestinations &&
                window._allDestinations.length
                    ? window._allDestinations
                    : await apiGetDestinations();

            const stateSel = document.getElementById('browse-state-filter');
            const searchInput = document.getElementById('browse-destination-search');
            if (stateSel) {
                const states = [...new Set(dests.map(d => d.state).filter(Boolean))].sort();
                stateSel.innerHTML = '<option value="">All states</option>' + states.map(s => `<option value="${escHtml(s)}">${escHtml(s)}</option>`).join('');
            }
            const renderDestinations = () => {
                const term = (searchInput?.value || '').toLowerCase();
                const state = stateSel?.value || '';
                const filtered = dests.filter(d =>
                    (!term || [d.name, d.state, d.country, d.description].some(v => (v || '').toLowerCase().includes(term))) &&
                    (!state || d.state === state)
                );
                grid.innerHTML = filtered.length
                    ? filtered.map(destCardHtml).join('')
                    : '<p class="empty-state">No destinations match your filters.</p>';
                wireFavHearts(grid);
                grid.querySelectorAll('.dest-card').forEach(card => {
                    card.addEventListener('click', () => openDestinationModal(parseInt(card.getAttribute('data-dest-id'))));
                });
            };
            searchInput?.addEventListener('input', renderDestinations);
            stateSel?.addEventListener('change', renderDestinations);
            renderDestinations();

        } else if (type === 'planners') {

            title.innerHTML =
                '<i class="fa-solid fa-user-tie"></i> All Planners';

            if (filterBar) {
                filterBar.classList.add('hidden');
            }

            const planners =
                window._allPlanners &&
                window._allPlanners.length
                    ? window._allPlanners
                    : await apiGetPlanners();

            grid.innerHTML =
                planners.length
                    ? planners.map(plannerCardHtml).join('')
                    : '<p class="empty-state">No planners available.</p>';

            wireFavHearts(grid);

            grid.querySelectorAll('.planner-card').forEach(card => {
                card.addEventListener('click', () => {
                    openPlannerModal(
                        parseInt(
                            card.getAttribute('data-planner-id')
                        )
                    );
                });
            });

        } else if (type === 'packages') {

            title.innerHTML =
                '<i class="fa-solid fa-suitcase-rolling"></i> All Packages';

            if (filterBar) {
                filterBar.classList.remove('hidden');
                filterBar.innerHTML = `
                    <label for="browse-dest-filter">Filter by destination</label>
                    <select id="browse-dest-filter"><option value="">All destinations</option></select>
                `;
            }

            const dests =
                window._allDestinations &&
                window._allDestinations.length
                    ? window._allDestinations
                    : await apiGetDestinations();

            const packageFilterSel = document.getElementById('browse-dest-filter');
            if (packageFilterSel) {

                packageFilterSel.innerHTML =
                    '<option value="">All destinations</option>' +
                    dests.map(d =>
                        `<option value="${d.id}">
                            ${escHtml(d.name)}
                        </option>`
                    ).join('');

                packageFilterSel.onchange = async () => {

                    grid.innerHTML = `
                        <div class="dest-loading">
                            <i class="fa-solid fa-circle-notch fa-spin"></i>
                            Loading packages...
                        </div>
                    `;

                    const pkgs =
                        await apiGetPackages(
                            packageFilterSel.value || undefined
                        );

                    renderPackageGrid(pkgs, grid);
                };
            }

            const pkgs =
                await apiGetPackages();

            renderPackageGrid(pkgs, grid);
        }

    } catch (error) {

        console.error(
            '[BROWSE] Failed:',
            error
        );

        grid.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <p>Unable to load this section.</p>
                <small>${escHtml(error.message || 'Unknown error')}</small>
            </div>
        `;
    }
}
function closeBrowseModal() { document.getElementById('browse-modal')?.classList.add('hidden'); }

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

/* ============================================================
   PLANNER DASHBOARD MODAL
   ============================================================ */
function openDashboardModal() {
  const modal = document.getElementById('dashboard-modal');
  if (!modal) return;
  const user = getUser();
  const title = user?.role === 'package_provider'
    ? 'Package Provider Dashboard'
    : user?.role === 'admin'
      ? 'Admin Dashboard'
      : 'Travel Planner Dashboard';
  const titleEl = document.getElementById('dashboard-title');
  if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-briefcase"></i> ${title}`;
  modal.classList.remove('hidden');
  switchDashTab('dash-profile');
  prefillDashProfile();
  loadPackageDestOptions();
}
function closeDashboardModal() {
  // Planners can't dismiss their own workspace — there's nothing else to show them.
  if (document.body.classList.contains('planner-view')) return;
  document.getElementById('dashboard-modal')?.classList.add('hidden');
}

// Switches the whole page between the normal traveler interface (search hero,
// destinations, planners, results, etc.) and a planner's dedicated workspace.
// Planners never see the traveler homepage — only their own dashboard.
function applyRoleView() {
  const user = getUser();
  const isPlanner = !!user && (user.role === 'planner' || user.role === 'package_provider' || user.role === 'admin');
  document.body.classList.toggle('planner-view', isPlanner);

  if (isPlanner) {
    openDashboardModal(); // unhides #dashboard-modal, loads profile/packages/requests tabs
  } else {
    document.getElementById('dashboard-modal')?.classList.add('hidden');
  }
}
function switchDashTab(tabId) {
  document.querySelectorAll('#dash-tabs .mt-tab-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-dash-tab') === tabId));
  document.querySelectorAll('#dashboard-modal .mt-panel').forEach(p => p.classList.toggle('active', p.id === tabId));
  if (tabId === 'dash-packages') loadDashPackages();
  if (tabId === 'dash-requests') loadDashRequests();
  if (tabId === 'dash-chats') loadDashChats();
  if (tabId === 'dash-blogs') loadDashBlogs();
}
function prefillDashProfile() {
  const user = getUser();
  if (!user) return;
  document.getElementById('dash-profile-error').textContent = '';
}
async function loadPackageDestOptions() {
  const sel = document.getElementById('pkg-destination');
  if (!sel || sel.options.length > 1) return;
  const dests = window._allDestinations && window._allDestinations.length ? window._allDestinations : await apiGetDestinations();
  sel.innerHTML = '<option value="">No specific destination</option>' + dests.map(d => `<option value="${d.id}">${escHtml(d.name)}</option>`).join('');
}
async function handleDashProfileSubmit(e) {
  e.preventDefault();
  const errEl = document.getElementById('dash-profile-error');
  const btn = document.getElementById('dash-profile-submit');
  errEl.textContent = '';
  btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Saving…';
  try {
    await apiSavePlannerProfile({
      bio: document.getElementById('dash-bio').value || null,
      location: document.getElementById('dash-location').value || null,
      years_experience: parseInt(document.getElementById('dash-years').value) || 0,
      starting_price: parseFloat(document.getElementById('dash-price').value) || 0,
    });
    // Upgrade cached role locally so nav shows "Dashboard" immediately
    const auth = getAuth();
    if (auth && auth.user && auth.user.role !== 'planner') {
      auth.user.role = 'planner';
      setAuth(auth);
      updateNavAuth();
      applyRoleView(); // switch them straight into the planner workspace
    }
    showToast('Planner profile saved! 🎉');
    loadPlannersSection();
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    btn.disabled = false; btn.textContent = 'Save Profile';
  }
}
async function handleDashPackageSubmit(e) {
  e.preventDefault();
  const errEl = document.getElementById('dash-package-error');
  const btn = document.getElementById('dash-package-submit');
  errEl.textContent = '';
  btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Creating…';
  try {
    await apiCreatePackage({
      destination_id: document.getElementById('pkg-destination').value ? parseInt(document.getElementById('pkg-destination').value) : null,
      title: document.getElementById('pkg-title').value,
      description: document.getElementById('pkg-description').value || null,
      duration_days: parseInt(document.getElementById('pkg-duration').value) || 1,
      price: parseFloat(document.getElementById('pkg-price').value) || 0,
      max_travelers: parseInt(document.getElementById('pkg-max-travelers').value) || 10,
      travel_style: document.getElementById('pkg-style').value || null,
      hotels: splitLines(document.getElementById('pkg-hotels')?.value),
      activities: splitLines(document.getElementById('pkg-activities')?.value),
      images: splitLines(document.getElementById('pkg-images')?.value),
      inclusions: splitLines(document.getElementById('pkg-inclusions')?.value),
      exclusions: splitLines(document.getElementById('pkg-exclusions')?.value),
      availability: { note: document.getElementById('pkg-availability')?.value || 'Available on request' },
    });
    showToast('Package created! 🧳');
    document.getElementById('dash-package-form').reset();
    document.getElementById('dash-package-form').classList.add('hidden');
    loadDashPackages();
    loadPackagesSection();
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    btn.disabled = false; btn.textContent = 'Create Package';
  }
}
async function loadDashPackages() {
  const list = document.getElementById('dash-packages-list');
  list.innerHTML = '<div class="dest-loading"><i class="fa-solid fa-circle-notch fa-spin"></i></div>';
  
  try {
    const myPkgs = await apiGetMyPackages();

    list.innerHTML = myPkgs.length
      ? myPkgs.map(pkg => `
        <div class="request-card">
          <div class="request-card-top">
            <strong>${escHtml(pkg.title)}</strong>
            <span class="request-status-badge accepted">${escHtml(pkg.status)}</span>
          </div>
          <div class="request-card-meta">
            <span><i class="fa-solid fa-calendar-days"></i> ${pkg.duration_days} days</span>
            <span><i class="fa-solid fa-indian-rupee-sign"></i> ₹${Number(pkg.price).toLocaleString('en-IN')}</span>
          </div>
        </div>`).join('')
      : '<p class="empty-state">No packages yet. Create your first one above.</p>';
    if (myPkgs.length) {
      list.querySelectorAll('.request-card').forEach((card, index) => {
        const pkg = myPkgs[index];
        const actions = document.createElement('div');
        actions.className = 'request-card-actions';
        actions.innerHTML = `
          <button class="request-action-btn" onclick="openPackageModal(${pkg.id})"><i class="fa-solid fa-eye"></i> View</button>
          <button class="request-action-btn" onclick="setPackageStatus(${pkg.id}, '${pkg.status === 'active' ? 'inactive' : 'active'}', this)">
            ${pkg.status === 'active' ? 'Deactivate' : 'Activate'}
          </button>
          <button class="request-action-btn danger" onclick="deleteDashPackage(${pkg.id}, this)"><i class="fa-solid fa-trash"></i> Delete</button>
        `;
        card.appendChild(actions);
      });
    }
  } catch (err) {
    list.innerHTML = '<p class="empty-state">Error loading packages.</p>';
  }
}
async function loadDashRequests() {
  const list = document.getElementById('dash-requests-list');
  list.innerHTML = '<div class="dest-loading"><i class="fa-solid fa-circle-notch fa-spin"></i></div>';
  const requests = await apiGetMyTripRequests();
  if (!requests.length) { list.innerHTML = '<p class="empty-state">No incoming trip requests yet.</p>'; return; }
  list.innerHTML = requests.map(requestCardHtml).join('');
  wireRequestActions(list);
}

// ── DOMContentLoaded: wire everything up ─────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  updateNavAuth();
  applyRoleView();
  loadDestinationsSection();
  loadPlannersSection();
  loadPackagesSection();

  // ── Mobile hamburger menu ──
  const hamburger = document.getElementById('nav-hamburger');
  const navPills  = document.getElementById('nav-pills');
  if (hamburger && navPills) {
    hamburger.addEventListener('click', (e) => {
      e.stopPropagation();
      navPills.classList.toggle('open');
    });
    navPills.querySelectorAll('.nav-pill').forEach(p => p.addEventListener('click', () => navPills.classList.remove('open')));
    document.addEventListener('click', (e) => {
      if (navPills.classList.contains('open') && !navPills.contains(e.target) && e.target !== hamburger && !hamburger.contains(e.target)) {
        navPills.classList.remove('open');
      }
    });
  }

  // ── Nav quick links → browse modal ──
  document.getElementById('nav-link-destinations')?.addEventListener('click', (e) => { e.preventDefault(); openBrowseModal('destinations'); });
  document.getElementById('nav-link-planners')?.addEventListener('click', (e) => { e.preventDefault(); openBrowseModal('planners'); });
  document.getElementById('nav-link-packages')?.addEventListener('click', (e) => { e.preventDefault(); openBrowseModal('packages'); });
  document.getElementById('btn-viewall-destinations')?.addEventListener('click', () => openBrowseModal('destinations'));
  document.getElementById('btn-viewall-planners')?.addEventListener('click', () => openBrowseModal('planners'));
  document.getElementById('btn-viewall-packages')?.addEventListener('click', () => openBrowseModal('packages'));

  // Smooth-scroll nav pills pointing at in-page sections
  document.querySelectorAll('.nav-pill[data-scroll]').forEach(pill => {
    pill.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById(pill.getAttribute('data-scroll'))?.scrollIntoView({ behavior: 'smooth' });
    });
  });
  
// Auth form
const authForm = document.getElementById('auth-form');

if (authForm) {
  authForm.addEventListener('submit', handleAuthSubmit);

  console.log('[AUTH] Auth form connected');
} else {
  console.error('[AUTH] #auth-form not found');
}


// ========================================================
// AUTH: LOGIN <-> SIGNUP SWITCH
// ========================================================

document.addEventListener('click', (e) => {
  const switchLink = e.target.closest('#auth-switch-link');

  if (!switchLink) return;

  e.preventDefault();
  e.stopImmediatePropagation();

  const mode = switchLink.getAttribute('data-mode');

  console.log('[AUTH] Switching mode to:', mode);

  openAuthModal(mode);
});


// Auth modal close
const authClose = document.getElementById('auth-modal-close');

if (authClose) authClose.addEventListener('click', closeAuthModal);


// ── Generic modal close buttons ──
const modalCloseMap = {
  'browse-modal-close': closeBrowseModal,
  'destination-modal-close': closeDestinationModal,
  'planner-modal-close': closePlannerModal,
  'package-modal-close': closePackageModal,
  'request-modal-close': closeRequestModal,
  'review-modal-close': closeReviewModal,
  'dashboard-modal-close': closeDashboardModal,
};

Object.entries(modalCloseMap).forEach(([id, fn]) => {
  document.getElementById(id)?.addEventListener('click', fn);
});

  // ── Click on backdrop (not modal content) to close ──
  // Attached directly to each overlay element instead of delegating
  // through `document`, so clicks on cards/buttons OUTSIDE the modal
  // (which is what opens it in the first place) can never bubble through
  // the overlay and immediately re-close it.
  function wireOverlayBackdropClose(overlayId, closeFn) {
    const overlay = document.getElementById(overlayId);
    if (!overlay) return;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeFn();
    });
  }

  wireOverlayBackdropClose('auth-modal', closeAuthModal);
  wireOverlayBackdropClose('my-trips-modal', closeMyTripsModal);
  wireOverlayBackdropClose('browse-modal', closeBrowseModal);
  wireOverlayBackdropClose('destination-modal', closeDestinationModal);
  wireOverlayBackdropClose('planner-modal', closePlannerModal);
  wireOverlayBackdropClose('package-modal', closePackageModal);
  wireOverlayBackdropClose('request-modal', closeRequestModal);
  wireOverlayBackdropClose('review-modal', closeReviewModal);
  wireOverlayBackdropClose('dashboard-modal', closeDashboardModal);
  wireOverlayBackdropClose('user-chat-modal', () => document.getElementById('user-chat-modal-close')?.click());

  // Save itinerary
  const saveBtn = document.getElementById('btn-save-itinerary');
  if (saveBtn) saveBtn.addEventListener('click', handleSaveItinerary);

  // Default sign-in button (visible before login, in hero/nav area)
  document.getElementById('nav-signin-btn-default')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    console.log('[AUTH] Default Sign in button clicked');

    openAuthModal('login');
});

  // My trips modal close
  const tripsClose = document.getElementById('my-trips-modal-close');
  if (tripsClose) tripsClose.addEventListener('click', closeMyTripsModal);

  // My trips tabs
  document.querySelectorAll('#mt-tabs .mt-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchMyTripsTab(btn.getAttribute('data-mt-tab')));
  });

  // Dashboard tabs
  document.querySelectorAll('#dash-tabs .mt-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchDashTab(btn.getAttribute('data-dash-tab')));
  });

  // Request / Review forms
  document.getElementById('request-form')?.addEventListener('submit', handleRequestSubmit);
  document.getElementById('review-form')?.addEventListener('submit', handleReviewSubmit);
  document.querySelectorAll('#review-star-picker i').forEach(star => {
    star.addEventListener('click', () => setStarRating(parseInt(star.getAttribute('data-val'))));
  });

  // Dashboard forms
  document.getElementById('dash-profile-form')?.addEventListener('submit', handleDashProfileSubmit);
  document.getElementById('dash-package-form')?.addEventListener('submit', handleDashPackageSubmit);
  document.getElementById('dash-blog-form')?.addEventListener('submit', handleDashBlogSubmit);
  document.getElementById('btn-new-package')?.addEventListener('click', () => {
    document.getElementById('dash-package-form')?.classList.toggle('hidden');
  });
});


// ============================================================
// AUTH DEBUGGING
// ============================================================

window.addEventListener('error', (event) => {
    console.error(
        '[APP GLOBAL ERROR]',
        event.error || event.message
    );
});

window.addEventListener('unhandledrejection', (event) => {
    console.error(
        '[APP UNHANDLED PROMISE ERROR]',
        event.reason
    );
});

/* ============================================================
   REAL-TIME USER-PLANNER CHAT
   ============================================================ */
let currentChatSocket = null;
let currentChatRoomId = null;

async function openUserChat(plannerId) {
    if (!getToken()) {
        window._pendingAfterLogin = () => openUserChat(plannerId);
        openAuthModal("login");
        showToast("Sign in to chat with a planner", "error");
        return;
    }
    
    // Close planner modal so chat can be center stage
    closePlannerModal();
    
    const modal = document.getElementById("user-chat-modal");
    const msgsContainer = document.getElementById("user-chat-messages");
    if (!modal || !msgsContainer) return;
    
    modal.classList.remove("hidden");
    msgsContainer.innerHTML = `<div class="dest-loading"><i class="fa-solid fa-circle-notch fa-spin"></i></div>`;
    
    try {
        // Start or get chat room
        const token = getToken();
        const roomRes = await fetch(BACKEND_URL + `/api/chat/rooms/start/${plannerId}`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        if (!roomRes.ok) throw new Error("Could not start chat");
        const room = await roomRes.json();
        currentChatRoomId = room.id;
        
        document.getElementById("user-chat-title").innerHTML = `<i class="fa-solid fa-comments"></i> Chat with ${escHtml(room.planner.name)}`;
        
        // Fetch history
        const histRes = await fetch(BACKEND_URL + `/api/chat/rooms/${room.id}/messages`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const messages = await histRes.json();
        
        msgsContainer.innerHTML = "";
        messages.forEach(m => renderUserChatMessage(m));
        scrollToChatBottom();
        
        // Connect WebSocket
        if (currentChatSocket) { currentChatSocket.close(); }
        // Determine WS URL
        const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsHost = BACKEND_URL.replace(/^https?:\/\//, "");
        const wsUrl = `${wsProtocol}//${wsHost}/api/chat/ws/${room.id}?token=${token}`;
        
        currentChatSocket = new WebSocket(wsUrl);
        
        currentChatSocket.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            renderUserChatMessage(msg);
            scrollToChatBottom();
        };
        
    } catch (err) {
        msgsContainer.innerHTML = `<p class="empty-state">${escHtml(err.message)}</p>`;
    }
}

async function openExistingUserChat(roomId) {
    if (!getToken()) {
        window._pendingAfterLogin = () => openExistingUserChat(roomId);
        openAuthModal("login");
        showToast("Sign in to open chats", "error");
        return;
    }

    const modal = document.getElementById("user-chat-modal");
    const msgsContainer = document.getElementById("user-chat-messages");
    if (!modal || !msgsContainer) return;

    modal.classList.remove("hidden");
    msgsContainer.innerHTML = `<div class="dest-loading"><i class="fa-solid fa-circle-notch fa-spin"></i></div>`;

    try {
        const token = getToken();
        currentChatRoomId = roomId;
        const histRes = await fetch(BACKEND_URL + `/api/chat/rooms/${roomId}/messages`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!histRes.ok) throw new Error("Could not load chat");
        const messages = await histRes.json();

        document.getElementById("user-chat-title").innerHTML = `<i class="fa-solid fa-comments"></i> Chat`;
        msgsContainer.innerHTML = "";
        messages.forEach(m => renderUserChatMessage(m));
        scrollToChatBottom();

        if (currentChatSocket) currentChatSocket.close();
        const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsHost = BACKEND_URL.replace(/^https?:\/\//, "");
        currentChatSocket = new WebSocket(`${wsProtocol}//${wsHost}/api/chat/ws/${roomId}?token=${token}`);
        currentChatSocket.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            renderUserChatMessage(msg);
            scrollToChatBottom();
        };
    } catch (err) {
        msgsContainer.innerHTML = `<p class="empty-state">${escHtml(err.message)}</p>`;
    }
}

function renderUserChatMessage(msg) {
    const msgsContainer = document.getElementById("user-chat-messages");
    const user = getUser();
    const isMe = msg.sender_id === user.id;
    
    const div = document.createElement("div");
    div.style.padding = "10px 14px";
    div.style.borderRadius = "12px";
    div.style.maxWidth = "80%";
    div.style.wordWrap = "break-word";
    
    if (isMe) {
        div.style.backgroundColor = "var(--brand)";
        div.style.color = "#fff";
        div.style.alignSelf = "flex-end";
    } else {
        div.style.backgroundColor = "var(--surface-1)";
        div.style.border = "1px solid var(--border)";
        div.style.alignSelf = "flex-start";
    }
    
    div.textContent = msg.content;
    msgsContainer.appendChild(div);
}

function scrollToChatBottom() {
    const container = document.getElementById("user-chat-messages");
    if (container) container.scrollTop = container.scrollHeight;
}

document.getElementById("user-chat-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("user-chat-input");
    const val = input.value.trim();
    if (!val || !currentChatSocket || currentChatSocket.readyState !== WebSocket.OPEN) return;
    
    currentChatSocket.send(val);
    input.value = "";
});

document.getElementById("user-chat-modal-close")?.addEventListener("click", () => {
    document.getElementById("user-chat-modal").classList.add("hidden");
    if (currentChatSocket) {
        currentChatSocket.close();
        currentChatSocket = null;
    }
    currentChatRoomId = null;
});
