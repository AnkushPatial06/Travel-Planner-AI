/* ============================================================
   Core — global error/unhandled-rejection logging.
   ============================================================ */

// ============================================================
// AUTH DEBUGGING
// ============================================================

window.addEventListener('error', (event) => {
    console.error(
        '[APP GLOBAL ERROR]',
        event.error || event.message
    );
});

window.addEventListener('unhandledrejection', (event) => {
    console.error(
        '[APP UNHANDLED PROMISE ERROR]',
        event.reason
    );
});

