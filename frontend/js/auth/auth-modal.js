/* ============================================================
   Auth — login & signup modal (including role selection).
   ============================================================ */

// ── Auth Modal ────────────────────────────────────────────────────────────────
let _authMode = 'login';

function openAuthModal(mode = 'login') {
    _authMode = mode === 'signup' ? 'signup' : 'login';

    const modal = document.getElementById('auth-modal');
    const title = document.getElementById('auth-modal-title');
    const nameField = document.getElementById('auth-name-field');
    const roleField = document.getElementById('auth-role-field');
    const submitBtn = document.getElementById('auth-submit-btn');
    const switchText = document.getElementById('auth-switch-text');
    const errorEl = document.getElementById('auth-error');

    if (!modal) {
        console.error('Auth modal not found');
        return;
    }

    // Show modal
    modal.classList.remove('hidden');

    // Title
    if (title) {
        title.textContent =
            _authMode === 'login'
                ? 'Welcome back'
                : 'Create account';
    }

    // Show/hide signup-only fields
    if (nameField) {
        nameField.style.display =
            _authMode === 'signup' ? 'flex' : 'none';
    }

    if (roleField) {
        roleField.style.display =
            _authMode === 'signup' ? 'flex' : 'none';
    }

    // Name is required only during signup
    const nameInput = document.getElementById('auth-name');

    if (nameInput) {
        nameInput.required = _authMode === 'signup';
    }

    // Submit button
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML =
            _authMode === 'login'
                ? '<i class="fa-solid fa-right-to-bracket"></i> Sign in'
                : '<i class="fa-solid fa-user-plus"></i> Create account';
    }

    // IMPORTANT:
    // Sign up / Sign in link is dynamically generated.
    if (switchText) {
        if (_authMode === 'login') {
            switchText.innerHTML = `
                Don't have an account?
                <a href="#" id="auth-switch-link" data-mode="signup">
                    Sign up
                </a>
            `;
        } else {
            switchText.innerHTML = `
                Already have an account?
                <a href="#" id="auth-switch-link" data-mode="login">
                    Sign in
                </a>
            `;
        }
    }

    // Clear previous error
    if (errorEl) {
        errorEl.textContent = '';
    }

    // Focus
    setTimeout(() => {
        if (_authMode === 'signup' && nameInput) {
            nameInput.focus();
        } else {
            document.getElementById('auth-email')?.focus();
        }
    }, 100);
}


function closeAuthModal() {

    const modal =
        document.getElementById(
            'auth-modal'
        );

    if (modal) {
        modal.classList.add('hidden');
    }
}


async function handleAuthSubmit(e) {

    e.preventDefault();

    console.log(
        `[AUTH] Form submitted: ${_authMode}`
    );

    const errorEl =
        document.getElementById(
            'auth-error'
        );

    const btnEl =
        document.getElementById(
            'auth-submit-btn'
        );

    const emailInput =
        document.getElementById(
            'auth-email'
        );

    const passwordInput =
        document.getElementById(
            'auth-password'
        );

    if (!emailInput || !passwordInput) {

        console.error(
            '[AUTH] Email/password field missing'
        );

        if (errorEl) {
            errorEl.textContent =
                'Authentication form is not configured correctly.';
        }

        return;
    }

    const email =
        emailInput.value.trim();

    const password =
        passwordInput.value;

    if (!email || !password) {

        if (errorEl) {
            errorEl.textContent =
                'Please enter your email and password.';
        }

        return;
    }

    if (errorEl) {
        errorEl.textContent = '';
    }

    if (btnEl) {

        btnEl.disabled = true;

        btnEl.innerHTML =
            '<i class="fa-solid fa-circle-notch fa-spin"></i> Please wait...';
    }

    try {

        let result;

        if (_authMode === 'login') {

            console.log(
                '[AUTH] Calling POST /api/auth/login'
            );

            result =
                await apiLogin(
                    email,
                    password
                );

        } else {

            const nameInput =
                document.getElementById(
                    'auth-name'
                );

            const roleInput =
                document.getElementById(
                    'auth-role'
                );

            const name =
                nameInput
                    ? nameInput.value.trim()
                    : '';

            const role =
                roleInput
                    ? roleInput.value
                    : 'traveler';

            if (!name) {

                if (errorEl) {
                    errorEl.textContent =
                        'Please enter your name.';
                }

                return;
            }

            console.log(
                '[AUTH] Calling POST /api/auth/signup'
            );

            result =
                await apiSignup(
                    name,
                    email,
                    password,
                    role
                );
        }

        console.log(
            '[AUTH] Authentication successful',
            result
        );

        setAuth(result);

        updateNavAuth();
        applyRoleView();

        closeAuthModal();

        const firstName =
            result?.user?.name
                ? result.user.name.split(' ')[0]
                : 'there';

        showToast(
            `Welcome, ${firstName}! 👋`
        );

        if (window._pendingAfterLogin) {

            const pending =
                window._pendingAfterLogin;

            window._pendingAfterLogin = null;

            setTimeout(() => {

                try {
                    pending();
                } catch (err) {

                    console.error(
                        '[AUTH] Pending action failed:',
                        err
                    );
                }

            }, 100);
        }

    } catch (err) {

        console.error(
            '[AUTH] Authentication error:',
            err
        );

        if (errorEl) {
            errorEl.textContent =
                err.message ||
                'Authentication failed.';
        }

    } finally {

        if (btnEl) {

            btnEl.disabled = false;

            btnEl.textContent =
                _authMode === 'login'
                    ? 'Sign in'
                    : 'Create account';
        }
    }
}

