/* ============================================================
   Core — DOMContentLoaded bootstrap: wires up nav, modals, and page-load behavior.
   ============================================================ */

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


