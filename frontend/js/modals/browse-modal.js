/* ============================================================
   Modals — the 'View All' browse modal (destinations/planners/packages listings).
   ============================================================ */

/* ============================================================
   BROWSE ("View All") MODAL
   ============================================================ */
async function openBrowseModal(type) {

    console.log('[BROWSE] Opening:', type);

    const modal = document.getElementById('browse-modal');
    const title = document.getElementById('browse-modal-title');
    const grid = document.getElementById('browse-modal-grid');
    const filterBar = document.getElementById('browse-filter-bar');
    const filterSel = document.getElementById('browse-dest-filter');

    if (!modal) {
        console.error('[BROWSE] #browse-modal not found');
        return;
    }

    if (!title) {
        console.error('[BROWSE] #browse-modal-title not found');
        return;
    }

    if (!grid) {
        console.error('[BROWSE] #browse-modal-grid not found');
        return;
    }

    modal.classList.remove('hidden');

    grid.innerHTML = `
        <div class="dest-loading">
            <i class="fa-solid fa-circle-notch fa-spin"></i>
            Loading...
        </div>
    `;

    try {

        await ensureFavoritesLoaded();

        if (type === 'destinations') {

            title.innerHTML =
                '<i class="fa-solid fa-map-location-dot"></i> All Destinations';

            if (filterBar) {
                filterBar.classList.remove('hidden');
                filterBar.innerHTML = `
                    <input type="search" id="browse-destination-search" placeholder="Search destinations">
                    <select id="browse-state-filter"><option value="">All states</option></select>
                `;
            }

            const dests =
                window._allDestinations &&
                window._allDestinations.length
                    ? window._allDestinations
                    : await apiGetDestinations();

            const stateSel = document.getElementById('browse-state-filter');
            const searchInput = document.getElementById('browse-destination-search');
            if (stateSel) {
                const states = [...new Set(dests.map(d => d.state).filter(Boolean))].sort();
                stateSel.innerHTML = '<option value="">All states</option>' + states.map(s => `<option value="${escHtml(s)}">${escHtml(s)}</option>`).join('');
            }
            const renderDestinations = () => {
                const term = (searchInput?.value || '').toLowerCase();
                const state = stateSel?.value || '';
                const filtered = dests.filter(d =>
                    (!term || [d.name, d.state, d.country, d.description].some(v => (v || '').toLowerCase().includes(term))) &&
                    (!state || d.state === state)
                );
                grid.innerHTML = filtered.length
                    ? filtered.map(destCardHtml).join('')
                    : '<p class="empty-state">No destinations match your filters.</p>';
                wireFavHearts(grid);
                grid.querySelectorAll('.dest-card').forEach(card => {
                    card.addEventListener('click', () => openDestinationModal(parseInt(card.getAttribute('data-dest-id'))));
                });
            };
            searchInput?.addEventListener('input', renderDestinations);
            stateSel?.addEventListener('change', renderDestinations);
            renderDestinations();

        } else if (type === 'planners') {

            title.innerHTML =
                '<i class="fa-solid fa-user-tie"></i> All Planners';

            if (filterBar) {
                filterBar.classList.add('hidden');
            }

            const planners =
                window._allPlanners &&
                window._allPlanners.length
                    ? window._allPlanners
                    : await apiGetPlanners();

            grid.innerHTML =
                planners.length
                    ? planners.map(plannerCardHtml).join('')
                    : '<p class="empty-state">No planners available.</p>';

            wireFavHearts(grid);

            grid.querySelectorAll('.planner-card').forEach(card => {
                card.addEventListener('click', () => {
                    openPlannerModal(
                        parseInt(
                            card.getAttribute('data-planner-id')
                        )
                    );
                });
            });

        } else if (type === 'packages') {

            title.innerHTML =
                '<i class="fa-solid fa-suitcase-rolling"></i> All Packages';

            if (filterBar) {
                filterBar.classList.remove('hidden');
                filterBar.innerHTML = `
                    <label for="browse-dest-filter">Filter by destination</label>
                    <select id="browse-dest-filter"><option value="">All destinations</option></select>
                `;
            }

            const dests =
                window._allDestinations &&
                window._allDestinations.length
                    ? window._allDestinations
                    : await apiGetDestinations();

            const packageFilterSel = document.getElementById('browse-dest-filter');
            if (packageFilterSel) {

                packageFilterSel.innerHTML =
                    '<option value="">All destinations</option>' +
                    dests.map(d =>
                        `<option value="${d.id}">
                            ${escHtml(d.name)}
                        </option>`
                    ).join('');

                packageFilterSel.onchange = async () => {

                    grid.innerHTML = `
                        <div class="dest-loading">
                            <i class="fa-solid fa-circle-notch fa-spin"></i>
                            Loading packages...
                        </div>
                    `;

                    const pkgs =
                        await apiGetPackages(
                            packageFilterSel.value || undefined
                        );

                    renderPackageGrid(pkgs, grid);
                };
            }

            const pkgs =
                await apiGetPackages();

            renderPackageGrid(pkgs, grid);
        }

    } catch (error) {

        console.error(
            '[BROWSE] Failed:',
            error
        );

        grid.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <p>Unable to load this section.</p>
                <small>${escHtml(error.message || 'Unknown error')}</small>
            </div>
        `;
    }
}
function closeBrowseModal() { document.getElementById('browse-modal')?.classList.add('hidden'); }

