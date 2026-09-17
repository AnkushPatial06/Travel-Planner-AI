/* ============================================================
   Search — budget tracker widget, loading animation, toasts, and shared UI helpers.
   ============================================================ */

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
    if (loadingStepsInterval) clearInterval(loadingStepsInterval);
    loadingStepsInterval = setInterval(() => {
        if (i > 0) document.getElementById(steps[i-1])?.classList.remove('active');
        if (i < steps.length) {
            document.getElementById(steps[i])?.classList.add('active');
            i++;
        } else {
            clearInterval(loadingStepsInterval);
            loadingStepsInterval = null;
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


