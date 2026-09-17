/* ============================================================
   Auth — top navigation bar auth UI (sign in / account menu).
   ============================================================ */

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

