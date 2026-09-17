/* ============================================================
   Planner — the Planner Dashboard modal (profile, packages, requests) and role-based view switching.
   ============================================================ */

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

