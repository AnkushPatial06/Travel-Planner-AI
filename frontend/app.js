/* ============================================================
   BOOKING.AI — APP LOGIC v2.0
   ============================================================ */

// ── Backend Configuration ──────────────────────────────────
const BACKEND_URL = (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
) ? '' : 'https://travel-planner-ai-production-f4c4.up.railway.app';

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
document.addEventListener('DOMContentLoaded', () => {
    const today    = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const nextWeek = new Date(tomorrow);
    nextWeek.setDate(tomorrow.getDate() + 6);

    outboundInput.value = formatDate(tomorrow);
    returnInput.value   = formatDate(nextWeek);

    // Nav scroll style
    window.addEventListener('scroll', () => {
        document.getElementById('topnav').style.boxShadow =
            window.scrollY > 10 ? '0 4px 24px rgba(0,0,0,.35)' : '0 2px 12px rgba(0,0,0,.3)';
    });

    // Initial budget display
    updateBudgetTracker(50000);
});

// ── Swap Airports ──────────────────────────────────────────
document.getElementById('swap-airports').addEventListener('click', () => {
    const origin = document.getElementById('origin');
    const dest   = document.getElementById('destination');
    [origin.value, dest.value] = [dest.value, origin.value];
});

// ── New Search Button ──────────────────────────────────────
document.getElementById('new-search-btn').addEventListener('click', () => {
    resultsEl.classList.add('hidden');
    welcomeEl.classList.remove('hidden');
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
            headers: { 'Content-Type': 'application/json' },
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
    updateBudgetTracker(budget);

    setTimeout(() => {
        resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
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
function showToast(msg, type = 'info') {
    const old = document.querySelector('.toast-msg');
    if (old) old.remove();

    const t = document.createElement('div');
    t.className = 'toast-msg';
    const colors = { success: '#00875a', error: '#d32f2f', info: '#006ce4' };
    t.style.cssText = `
        position:fixed;bottom:28px;right:28px;z-index:9999;
        background:${colors[type]||colors.info};color:#fff;
        padding:12px 22px;border-radius:12px;
        font-size:.88rem;font-weight:600;font-family:Inter,sans-serif;
        box-shadow:0 8px 24px rgba(0,0,0,.25);
        animation:slideInToast .3s cubic-bezier(.4,0,.2,1);
    `;
    t.textContent = msg;

    if (!document.querySelector('#toast-style')) {
        const s = document.createElement('style');
        s.id = 'toast-style';
        s.textContent = `
            @keyframes slideInToast {
                from { opacity:0; transform:translateY(16px); }
                to   { opacity:1; transform:translateY(0); }
            }`;
        document.head.appendChild(s);
    }

    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3200);
}

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
chatFab.addEventListener('click', () => {
    chatOpen = !chatOpen;
    chatPanel.classList.toggle('hidden', !chatOpen);
    chatFab.classList.toggle('active', chatOpen);
    chatFabIcon.className = chatOpen ? 'fa-solid fa-xmark' : 'fa-solid fa-comments';
    if (chatOpen) {
        chatInput.focus();
        scrollChatBottom();
    }
});

document.getElementById('chat-close').addEventListener('click', () => {
    chatOpen = false;
    chatPanel.classList.add('hidden');
    chatFab.classList.remove('active');
    chatFabIcon.className = 'fa-solid fa-comments';
});

document.getElementById('chat-clear').addEventListener('click', () => {
    chatHistory = [];
    chatMsgs.innerHTML = '';
    addChatMsg('assistant',
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
chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = chatInput.value.trim();
    if (!msg || chatBusy) return;
    sendChatMessage(msg);
});

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
