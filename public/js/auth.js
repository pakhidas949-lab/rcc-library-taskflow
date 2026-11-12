/**
 * Auth UI helpers for the public pages (landing + login).
 *
 * Talks to the TaskFlow session API:
 *   POST /api/auth/login   { username, password }
 *   POST /api/auth/logout
 *   GET  /api/auth/session
 *
 * The session id lives in an HttpOnly cookie, so nothing sensitive is ever
 * exposed to JavaScript.
 */
(function (global) {
  'use strict';

  const AuthUI = {
    /**
     * Current session, or null when signed out.
     */
    session: null,

    /**
     * GET /api/auth/session
     * @returns {Promise<{authenticated:boolean,user:object|null}>}
     */
    async currentSession() {
      try {
        const response = await fetch('/api/auth/session', {
          headers: { Accept: 'application/json' },
          credentials: 'same-origin',
        });
        if (!response.ok) return { authenticated: false, user: null };
        const payload = await response.json();
        const data = (payload && payload.data) || { authenticated: false, user: null };
        this.session = data;
        return data;
      } catch {
        return { authenticated: false, user: null };
      }
    },

    /**
     * POST /api/auth/login
     * @param {string} identifier
     * @param {string} password
     */
    async login(identifier, password) {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ username: identifier, password }),
      });

      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok) {
        const error = new Error(
          (payload && payload.error && payload.error.message) ||
            'Sign in failed. Please try again.'
        );
        error.status = response.status;
        throw error;
      }

      this.session = payload && payload.data;
      return this.session;
    },

    /**
     * POST /api/auth/logout
     */
    async logout() {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Accept: 'application/json' },
          credentials: 'same-origin',
        });
      } finally {
        this.session = null;
        window.location.href = '/';
      }
    },

    /**
     * Read the `next` query parameter (used to return the user to the page
     * they originally asked for).
     */
    nextTarget() {
      const params = new URLSearchParams(window.location.search);
      const next = params.get('next');
      // Only allow same-origin relative paths - never an absolute URL.
      if (!next || !next.startsWith('/') || next.startsWith('//')) return '/dashboard';
      return next;
    },

    /**
     * Landing page: point the sign-in button at the right destination.
     */
    initLanding() {
      const link = document.getElementById('signin-link');
      const label = document.getElementById('signin-label');
      if (!link) return;

      this.currentSession().then((session) => {
        if (session && session.authenticated) {
          link.setAttribute('href', '/dashboard');
          if (label) label.textContent = 'Open Dashboard';
          const icon = link.querySelector('.material-symbols-outlined');
          if (icon) icon.textContent = 'space_dashboard';
        } else {
          link.setAttribute('href', '/login');
        }
      });
    },

    /**
     * Login page: wire up the form, the demo-credential chips and the
     * show/hide password toggle.
     */
    initLogin() {
      const form = document.getElementById('login-form');
      if (!form) return;

      const identifierInput = document.getElementById('identifier');
      const passwordInput = document.getElementById('password');
      const submitButton = document.getElementById('login-submit');
      const submitText = document.getElementById('login-submit-text');
      const errorBox = document.getElementById('login-error');
      const errorText = document.getElementById('login-error-text');
      const toggleButton = document.getElementById('toggle-password');

      const showError = (message) => {
        if (!errorBox || !errorText) return;
        errorText.textContent = message;
        errorBox.classList.remove('hidden');
      };

      const clearError = () => {
        if (errorBox) errorBox.classList.add('hidden');
        [identifierInput, passwordInput].forEach((field) => {
          if (field) field.classList.remove('is-invalid');
        });
      };

      // Already signed in? Go straight to the dashboard.
      this.currentSession().then((session) => {
        if (session && session.authenticated) {
          window.location.replace(this.nextTarget());
        }
      });

      // Show / hide password.
      if (toggleButton && passwordInput) {
        toggleButton.addEventListener('click', () => {
          const isHidden = passwordInput.type === 'password';
          passwordInput.type = isHidden ? 'text' : 'password';
          const icon = toggleButton.querySelector('.material-symbols-outlined');
          if (icon) icon.textContent = isHidden ? 'visibility_off' : 'visibility';
          toggleButton.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
          passwordInput.focus();
        });
      }

      // Demo credential chips.
      document.querySelectorAll('.demo-credential').forEach((chip) => {
        chip.addEventListener('click', () => {
          if (identifierInput) identifierInput.value = chip.dataset.demoUser || '';
          if (passwordInput) passwordInput.value = chip.dataset.demoPass || '';
          clearError();
          if (submitButton) submitButton.focus();
        });
      });

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        clearError();

        const identifier = identifierInput ? identifierInput.value.trim() : '';
        const password = passwordInput ? passwordInput.value : '';

        if (!identifier || !password) {
          showError('Please enter both your username and your password.');
          if (!identifier && identifierInput) identifierInput.classList.add('is-invalid');
          if (!password && passwordInput) passwordInput.classList.add('is-invalid');
          return;
        }

        if (submitButton) submitButton.disabled = true;
        if (submitText) submitText.textContent = 'Signing in…';

        try {
          await this.login(identifier, password);
          if (submitText) submitText.textContent = 'Signed in — redirecting…';
          window.location.href = this.nextTarget();
        } catch (error) {
          showError(error.message);
          if (passwordInput) {
            passwordInput.classList.add('is-invalid');
            passwordInput.value = '';
            passwordInput.focus();
          }
          if (submitButton) submitButton.disabled = false;
          if (submitText) submitText.textContent = 'Sign in';
        }
      });
    },
  };

  global.AuthUI = AuthUI;
})(window);
