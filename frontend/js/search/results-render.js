/* ============================================================
   Search — renders search results: hotels, flights, weather, budget, travel score, and AI destination matching.
   ============================================================ */

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
    if (!dests.length) { wrap.innerHTML = ''; wrap.classList.add('hidden'); return; }

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

        if (!topPkgs.length && !topPlanners.length) { wrap.innerHTML = ''; wrap.classList.add('hidden'); return; }

        wrap.classList.remove('hidden');
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

    wrap.classList.remove('hidden');
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

