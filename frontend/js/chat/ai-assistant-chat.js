/* ============================================================
   Chat — the context-aware AI travel assistant widget (trip Q&A chat).
   ============================================================ */

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

