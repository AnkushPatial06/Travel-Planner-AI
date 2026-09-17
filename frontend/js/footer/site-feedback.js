/* ============================================================
   Footer — website feedback/star-rating widget and reviews strip.
   ============================================================ */

/* ============================================================
   SITE FOOTER — WEBSITE FEEDBACK / REVIEWS WIDGET
   ============================================================
   Feedback is now stored server-side via GET/POST /api/site-feedback
   (see backend/api/site_feedback.py), so every visitor sees the same
   reviews. If the backend request fails (offline, backend down), we
   fall back to a local cache in this browser so the UI never breaks.
   ------------------------------------------------------------ */
const SITE_FEEDBACK_CACHE_KEY = 'tp_site_feedback_cache';

// Seeded only as a last-resort fallback if the backend is unreachable
// AND this browser has never successfully loaded real reviews before.
const SITE_FEEDBACK_SEED = [
    { rating: 5, comment: 'Booked my Goa trip in minutes — the AI travel score made choosing a hotel so much easier.', name: 'Ananya R.', created_at: new Date().toISOString() },
    { rating: 4, comment: 'Love the budget tracker. Wish flight results loaded a touch faster, but overall a great planning tool.', name: 'Karan M.', created_at: new Date().toISOString() },
    { rating: 5, comment: 'Connected with a planner for our Kerala honeymoon and it was seamless from search to chat.', name: 'Divya & Rohan', created_at: new Date().toISOString() },
];

function getCachedSiteFeedback() {
    try {
        const stored = JSON.parse(localStorage.getItem(SITE_FEEDBACK_CACHE_KEY));
        if (Array.isArray(stored) && stored.length) return stored;
    } catch { /* ignore */ }
    return SITE_FEEDBACK_SEED;
}

function cacheSiteFeedback(list) {
    try { localStorage.setItem(SITE_FEEDBACK_CACHE_KEY, JSON.stringify(list.slice(0, 20))); } catch { /* storage full — ignore */ }
}

async function apiGetSiteFeedback(limit = 6) {
    const res = await fetch(`${BACKEND_URL}/api/site-feedback/?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to load site feedback');
    return res.json();
}

async function apiPostSiteFeedback(payload) {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${BACKEND_URL}/api/site-feedback/`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Could not submit feedback.');
    }
    return res.json();
}

function starsHtml(rating) {
    const full = Math.round(rating);
    return Array.from({ length: 5 }, (_, i) =>
        `<i class="fa-solid fa-star" style="opacity:${i < full ? 1 : 0.25}"></i>`
    ).join('');
}

function footerReviewCardHtml(r) {
    return `
      <div class="footer-review-card">
        <div class="footer-review-stars">${starsHtml(r.rating)}</div>
        <p class="footer-review-text">${escHtml(r.comment)}</p>
        <div class="footer-review-author">${escHtml(r.name || 'Anonymous traveler')}</div>
      </div>`;
}

function renderFooterReviews(list) {
    const track = document.getElementById('footer-reviews-track');
    if (!track) return;
    if (!list.length) {
        track.innerHTML = '<p class="empty-state">Be the first to rate Booking.AI!</p>';
        return;
    }
    track.innerHTML = list.slice(0, 6).map(footerReviewCardHtml).join('');
}

async function loadFooterReviews() {
    const track = document.getElementById('footer-reviews-track');
    if (!track) return;
    try {
        const list = await apiGetSiteFeedback(6);
        renderFooterReviews(list);
        cacheSiteFeedback(list); // keep an offline fallback fresh
    } catch (err) {
        console.warn('[Footer] Falling back to cached feedback:', err.message);
        renderFooterReviews(getCachedSiteFeedback());
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadFooterReviews();

    // Star rating picker
    const starWrap = document.getElementById('footer-star-rating');
    const ratingInput = document.getElementById('footer-feedback-rating');
    if (starWrap && ratingInput) {
        const stars = Array.from(starWrap.querySelectorAll('.footer-star'));
        const paint = (value) => stars.forEach(s => s.classList.toggle('hovered', parseInt(s.dataset.value) <= value));
        stars.forEach(star => {
            star.addEventListener('mouseenter', () => paint(parseInt(star.dataset.value)));
            star.addEventListener('click', () => {
                ratingInput.value = star.dataset.value;
                stars.forEach(s => s.classList.toggle('active', parseInt(s.dataset.value) <= parseInt(star.dataset.value)));
            });
        });
        starWrap.addEventListener('mouseleave', () => paint(parseInt(ratingInput.value) || 0));
    }

    // Submit handler
    const feedbackForm = document.getElementById('site-feedback-form');
    feedbackForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msgEl = document.getElementById('footer-feedback-msg');
        const submitBtn = document.getElementById('footer-feedback-submit');
        const rating = parseInt(ratingInput?.value) || 0;
        const comment = document.getElementById('footer-feedback-text').value.trim();

        if (!rating) {
            msgEl.textContent = 'Please select a star rating first.';
            msgEl.className = 'footer-feedback-msg error';
            return;
        }
        if (!comment) {
            msgEl.textContent = 'Please add a quick comment before sending.';
            msgEl.className = 'footer-feedback-msg error';
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Sending…';

        try {
            const user = getUser();
            await apiPostSiteFeedback({ rating, comment, name: user?.name });

            msgEl.textContent = 'Thanks for your feedback! 🎉';
            msgEl.className = 'footer-feedback-msg success';
            feedbackForm.reset();
            ratingInput.value = '0';
            starWrap?.querySelectorAll('.footer-star').forEach(s => s.classList.remove('active', 'hovered'));
            showToast('Thanks for rating Booking.AI!');

            loadFooterReviews(); // refresh the strip with the real, server-side list
        } catch (err) {
            msgEl.textContent = err.message || 'Something went wrong. Please try again.';
            msgEl.className = 'footer-feedback-msg error';
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send Feedback';
        }
    });
});
