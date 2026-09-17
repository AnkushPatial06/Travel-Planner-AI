/* ============================================================
   Search — search form handling, swap/tabs/sort controls, submit, and cancel-search.
   ============================================================ */

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
    document.getElementById('matched-destination-wrap')?.classList.add('hidden');
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
        searchAbortController = new AbortController();
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
            }),
            signal: searchAbortController.signal,
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
        if (err.name === 'AbortError') {
            // User cancelled the search — already handled by the cancel button, no error toast needed.
            return;
        }
        console.error('[Travel Planner] Search error:', err);
        showToast(`Search error: ${err.message}`, 'error');
        welcomeEl.classList.remove('hidden');
    } finally {
        loadingEl.classList.add('hidden');
        searchAbortController = null;
    }
});

// ── Cancel Search Button ───────────────────────────────────
// Lets the user abort an in-progress search and return straight to the home page.
document.getElementById('loading-cancel-btn')?.addEventListener('click', () => {
    if (searchAbortController) {
        searchAbortController.abort();
        searchAbortController = null;
    }
    if (loadingStepsInterval) {
        clearInterval(loadingStepsInterval);
        loadingStepsInterval = null;
    }
    loadingEl.classList.add('hidden');
    resultsEl?.classList.add('hidden');
    document.getElementById('matched-destination-wrap')?.classList.add('hidden');
    welcomeEl.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('Search cancelled.');
});

