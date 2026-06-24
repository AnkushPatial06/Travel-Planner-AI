/* ============================================================
   BOOKING.AI — APP LOGIC
   ============================================================ */

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
        const res = await fetch('/complete_search/', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                flight_request: {
                    origin,
                    destination,
                    outbound_date: outbound,
                    return_date:   ret
                }
            })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Search failed');
        }

        currentTripData = await res.json();
        renderResults(origin, destination, outbound, ret, budget);

    } catch (err) {
        showToast(`Search error: ${err.message}`, 'error');
        welcomeEl.classList.remove('hidden');
    } finally {
        loadingEl.classList.add('hidden');
    }
});

// ── Render All Results ─────────────────────────────────────
function renderResults(origin, dest, outbound, ret, budget) {
    // Trip header
    document.getElementById('trip-header-origin').textContent = origin;
    document.getElementById('trip-header-dest').textContent   = dest;
    document.getElementById('trip-header-dates').textContent  =
        `${formatDisplayDate(outbound)} → ${formatDisplayDate(ret)} · ${tripNights} night${tripNights!==1?'s':''}`;

    hotelsData  = currentTripData.hotels  || [];
    flightsData = currentTripData.flights || [];

    // Count badges
    document.getElementById('stays-count').textContent   = hotelsData.length;
    document.getElementById('flights-count').textContent = flightsData.length;

    renderStays(sortHotels([...hotelsData], 'rating'));
    renderFlights(sortFlights([...flightsData], 'price-asc'));

    // AI Recommendations
    const flightAI = document.getElementById('flight-ai-content');
    const hotelAI  = document.getElementById('hotel-ai-content');
    flightAI.innerHTML = currentTripData.ai_flight_recommendation
        ? marked.parse(currentTripData.ai_flight_recommendation)
        : '<p class="ai-placeholder">No flight analysis available.</p>';
    hotelAI.innerHTML = currentTripData.ai_hotel_recommendation
        ? marked.parse(currentTripData.ai_hotel_recommendation)
        : '<p class="ai-placeholder">No hotel analysis available.</p>';

    // Itinerary
    const itinEl = document.getElementById('itinerary-content');
    if (currentTripData.itinerary) {
        itinEl.innerHTML = marked.parse(currentTripData.itinerary);
        document.getElementById('btn-download-itinerary').onclick =
            () => downloadMarkdown(currentTripData.itinerary, dest, outbound);
    } else {
        itinEl.innerHTML = '<p>Itinerary requires both flights and hotels to be found.</p>';
    }

    // Show results — default to Stays tab
    tabBtns[0].click();
    resultsEl.classList.remove('hidden');
    updateBudgetTracker(budget);

    // Scroll to results
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

            // Visual feedback
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

        // Parse times from "Thu, Jul 3 (BLR) at 10:05 AM"
        const depTime = parseFlightTime(flight.departure);
        const arrTime = parseFlightTime(flight.arrival);
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
                        <div class="flight-time">${escHtml(depTime)}</div>
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
                        <div class="flight-time">${escHtml(arrTime)}</div>
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
    const steps = ['lstep-flights', 'lstep-hotels', 'lstep-ai'];
    let i = 0;
    document.querySelectorAll('.lstep').forEach(s => s.classList.remove('active'));
    const iv = setInterval(() => {
        if (i > 0) document.getElementById(steps[i-1]).classList.remove('active');
        if (i < steps.length) {
            document.getElementById(steps[i]).classList.add('active');
            i++;
        } else {
            clearInterval(iv);
        }
    }, 4000);
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
        airline:  f.airline,
        price:    f.price,
        duration: f.duration,
        stops:    f.stops,
        departure: f.departure,
        arrival:   f.arrival,
        travel_class: f.travel_class,
    }));

    // Summarize available hotels
    const availHotels = (hotelsData || []).map(h => ({
        name:     h.name,
        price:    h.price,
        rating:   h.rating,
        location: h.location,
    }));

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
        const res = await fetch('/chat/', {
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
