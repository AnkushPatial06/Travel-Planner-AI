# Booking.AI — Travel Planner (Frontend)

This is the same app you had before, reorganized from two giant single files
(`app.js`, `style.css`) into a proper folder structure, split by feature area.
No behavior was changed in this split — every file is an exact, contiguous
slice of the original code, loaded in the same order, so the app runs
identically to before.

## Folder structure

```
.
├── index.html
├── css/
│   ├── base.css                 Design tokens (colors, fonts, spacing), reset
│   ├── layout.css                Top nav, hero search bar, page wrapper, loading overlay
│   ├── landing.css               Homepage welcome state + Destinations/Planners/Packages preview
│   ├── results.css               Search results layout, tabs, hotel/flight cards, budget sidebar
│   ├── misc-and-chat.css         Small responsive tweaks + AI chat widget styling
│   ├── analysis-tabs.css         Travel Score, Weather, Budget Analysis tab styling
│   ├── auth-and-planner.css      Nav auth UI + planner full-page workspace mode
│   ├── modals.css                All modal overlays, detail modals, toasts, mobile nav
│   └── footer.css                Site footer, feedback form, reviews strip
│
└── js/
    ├── core/
    │   ├── config-and-state.js   Backend URL config, global state, shared DOM refs
    │   ├── api-client.js         All backend API calls (fetch wrappers)
    │   ├── bootstrap.js          DOMContentLoaded — wires up the whole page
    │   └── error-logging.js      Global error / unhandled-rejection logging
    │
    ├── search/
    │   ├── search-form.js        Search form: submit, cancel-search, sort, tabs
    │   ├── results-render.js     Renders hotels/flights/weather/budget/score/AI match
    │   └── ui-utils.js           Budget tracker, loading animation, toasts, helpers
    │
    ├── auth/
    │   ├── auth-state.js         Session/token helpers
    │   ├── auth-nav.js           Nav bar auth UI (sign in / account menu)
    │   └── auth-modal.js         Login & signup modal
    │
    ├── landing/
    │   └── landing-sections.js   Homepage Destinations/Planners/Packages preview cards
    │
    ├── modals/
    │   ├── browse-modal.js       "View All" browse modal
    │   ├── detail-modals.js      Destination / Planner / Package detail modals
    │   └── request-review-modals.js   Trip request + review modals, My Trips tabs
    │
    ├── planner/
    │   └── dashboard-modal.js    Planner dashboard + role-based full-page workspace
    │
    ├── trips/
    │   └── my-trips.js           Save itinerary + "My Trips" modal shell
    │
    ├── favorites/
    │   └── favorites.js          Favorites (heart icon) cache & wiring
    │
    ├── chat/
    │   ├── ai-assistant-chat.js  AI travel assistant chat widget
    │   └── planner-chat.js       Real-time traveler ↔ planner WebSocket chat
    │
    └── footer/
        └── site-feedback.js      Footer feedback form + reviews strip
```

## Why plain multiple `<script>`/`<link>` tags, not ES modules / a bundler?

The original code was written as classic (non-module) scripts, with every
function and variable living in one shared global scope. Splitting it into
ES modules with `import`/`export` would mean touching every single
cross-file reference — high risk of introducing bugs with no functional
benefit for a project this size.

Instead, each file is loaded via its own `<script>` tag in `index.html`, in
the **same order** the code originally appeared in `app.js`. Since classic
scripts share one global scope, this is functionally identical to the
original single file — nothing had to be rewired, and nothing behaves
differently.

If you later want real ES modules (for tree-shaking, a bundler, TypeScript,
etc.), that's a bigger, separate refactor — happy to help with that too.

## Running locally

This is a static frontend — no build step required.

```bash
# from this folder
python3 -m http.server 5500
# then open http://localhost:5500
```

By default it talks to a backend at `http://127.0.0.1:8000` when running on
`localhost`/`127.0.0.1`/`file://` (see `js/core/config-and-state.js`,
`BACKEND_URL`). Make sure your FastAPI backend is running on that port, or
update `BACKEND_URL` to point at wherever your backend is deployed.

## Recent feature notes

- **Cancel Search**: a "Cancel Search" button now appears on the loading
  screen — it aborts the in-flight search request and returns to the home
  page (`js/search/search-form.js`).
- **Planner workspace mode**: logged-in planners now see a dedicated
  full-page dashboard instead of the traveler homepage
  (`js/planner/dashboard-modal.js`, `css/auth-and-planner.css`).
- **Site footer**: a footer with quick links, a star-rating feedback form,
  and a reviews strip was added (`js/footer/site-feedback.js`,
  `css/footer.css`). Feedback is currently stored in the visitor's browser
  (`localStorage`) and also attempts a best-effort POST to
  `/api/site-feedback` in case that backend route exists or is added later.
