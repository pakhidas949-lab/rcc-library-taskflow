/**
 * TaskFlow live-data layer for the Athenaeum ILS
 * ----------------------------------------------
 * Wires every dashboard page to the TaskFlow REST API so the pages are no
 * longer static mock-ups:
 *
 *   1. Every row of a page's table is mirrored to a server-side task.
 *   2. The completion state is owned by the backend, not by the browser.
 *   3. A "Live Task Desk" panel adds full CRUD (create / toggle / delete).
 *   4. The sidebar navigation is wired to the real pages.
 *
 * No build step and no framework - the pages are plain HTML, so this file is
 * loaded with a single <script> tag.
 */
(function () {
  'use strict';

  const API = window.TaskFlowAPI;
  if (!API) {
    console.warn('[TaskFlow] API client not loaded - skipping live-data layer.');
    return;
  }

  /* ------------------------------------------------------------------ *
   * Page configuration
   * ------------------------------------------------------------------ */

  /** Pull the visible lines out of a cell, ignoring Material icon glyphs. */
  function cellLines(td) {
    if (!td) return [];
    const clone = td.cloneNode(true);
    clone.querySelectorAll('.material-symbols-outlined').forEach((node) => node.remove());
    return clone
      .textContent.split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
  }

  const PAGES = {
    '/dashboard': {
      namespace: 'Catalog',
      heading: 'Catalog & Resource Inventory',
      statusCell: 6,
      actionsCell: 7,
      pick: (cells) => cells[1] && cells[1][0],
    },
    '/dashboard/pages/page1.html': {
      namespace: 'Circulation',
      heading: 'Overview & Circulation Analytics',
      statusCell: 4,
      actionsCell: 5,
      pick: (cells) => {
        const action = cells[0] && cells[0][1];
        const item = cells[1] && cells[1][0];
        return action && item ? action + ' — ' + item : item || action;
      },
    },
    '/dashboard/pages/page2.html': {
      namespace: 'Borrowers',
      heading: 'Borrowers & Circulation Services',
      statusCell: 5,
      actionsCell: 6,
      pick: (cells) => {
        const lines = cells[0] || [];
        return (
          lines.find((l) => /[a-z]/.test(l) && l.includes(' ')) || lines[0] || 'Patron'
        );
      },
    },
    '/dashboard/pages/page3.html': {
      namespace: 'Acquisitions',
      heading: 'Acquisitions & Order Management',
      statusCell: 5,
      actionsCell: 6,
      pick: (cells) => {
        const lines = cells[0] || [];
        return lines.find((l) => /^PO-/.test(l)) || lines[0] || 'Purchase order';
      },
    },
  };

  /** Normalise the current path so /dashboard/ and /dashboard/index.html resolve. */
  function currentPath() {
    let path = window.location.pathname;
    if (!path || path === '/') return '/';
    if (path.endsWith('/index.html')) {
      path = path.slice(0, -'index.html'.length);
    }
    return path.replace(/\/+$/, '') || '/';
  }

  const PAGE = PAGES[currentPath()] || null;

  /* ------------------------------------------------------------------ *
   * Sidebar navigation
   * ------------------------------------------------------------------ */

  const NAV_ROUTES = {
    overview: '/dashboard/pages/page1.html',
    'catalog-inventory': '/dashboard',
    'borrowers-circulation': '/dashboard/pages/page2.html',
    'acquisitions-orders': '/dashboard/pages/page3.html',
    'study-rooms-events': '/dashboard/pages/page1.html',
    'reports-audits': '/dashboard/pages/page3.html',
  };

  function wireNavigation() {
    const links = Array.from(document.querySelectorAll('a[data-path]'));
    let activeApplied = false;

    links.forEach((link) => {
      const key = link.getAttribute('data-path');
      const route = NAV_ROUTES[key];
      if (!route) return;

      link.setAttribute('href', route);
      link.removeAttribute('aria-current');

      // Exactly one nav item is highlighted per page - the first one that
      // points at the current path.
      const isActive = !activeApplied && route.split('#')[0] === currentPath();
      if (isActive) {
        activeApplied = true;
        link.setAttribute('aria-current', 'page');
        link.classList.add('bg-primary-container', 'text-on-primary', 'font-semibold');
      }
    });
  }

  /* ------------------------------------------------------------------ *
   * Global search shortcut (Ctrl/Cmd + K)
   * ------------------------------------------------------------------ */

  /**
   * The header advertises a "Cmd K" shortcut for the global quick-search.
   * Make it real, and show the right modifier key for the platform.
   */
  function wireKeyboardShortcuts() {
    const isApple = /Mac|iPhone|iPad|iPod/.test(
      navigator.platform || navigator.userAgent || ''
    );

    document.querySelectorAll('header span').forEach((badge) => {
      if (badge.textContent.trim() === '⌘K') {
        badge.textContent = isApple ? '⌘K' : 'Ctrl K';
      }
    });

    document.addEventListener('keydown', (event) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key !== 'k' && event.key !== 'K') return;

      const input = document.querySelector('header input[type="text"]');
      if (!input) return;
      event.preventDefault();
      input.focus();
      input.select();
    });
  }

  /* ------------------------------------------------------------------ *
   * Row <-> task binding
   * ------------------------------------------------------------------ */

  /** Find the table that holds the live rows. */
  function liveTable() {
    const tables = document.querySelectorAll('table');
    for (const table of tables) {
      if (table.querySelector('tbody tr')) return table;
    }
    return null;
  }

  /** Build the chip that shows the server-side task state. */
  function buildChip(task) {
    const chip = document.createElement('span');
    chip.className =
      'taskflow-chip ml-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-label-sm text-label-sm font-semibold whitespace-nowrap';

    if (task.completed) {
      chip.classList.add('bg-secondary-container', 'text-on-secondary-container');
      chip.innerHTML =
        '<span class="w-1.5 h-1.5 rounded-full bg-secondary"></span>Cleared';
    } else {
      chip.classList.add('bg-surface-container-highest', 'text-on-surface-variant');
      chip.innerHTML =
        '<span class="w-1.5 h-1.5 rounded-full bg-secondary"></span>Open';
    }
    chip.title = task.completed
      ? 'Synced with TaskFlow API - completed'
      : 'Synced with TaskFlow API - pending';
    return chip;
  }

  /** Build the toggle button appended to the row's Actions cell. */
  function buildToggle(task, onToggle) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className =
      'taskflow-toggle p-1 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded transition-colors';
    button.title = task.completed
      ? 'Reopen this task (TaskFlow API)'
      : 'Mark this task complete (TaskFlow API)';
    button.innerHTML =
      '<span class="material-symbols-outlined text-[18px]">task_alt</span>';
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      onToggle(task);
    });
    return button;
  }

  /**
   * Mirror the page's rows to the API and paint the live state.
   */
  async function syncRows() {
    if (!PAGE) return;

    const table = liveTable();
    if (!table) return;

    const rows = Array.from(table.querySelectorAll('tbody tr'));

    // 1. Load the tasks that belong to this page.
    let tasks = [];
    try {
      tasks = await API.search('[' + PAGE.namespace + ']');
    } catch (error) {
      console.warn('[TaskFlow] Could not load tasks:', error.message);
      showError(error);
      return;
    }

    // 2. Make sure every row has a server-side task.
    const byLabel = new Map();
    tasks.forEach((task) => {
      const label = API.Namespace.parse(task.text).label;
      if (!byLabel.has(label)) byLabel.set(label, task);
    });

    const created = [];
    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll('td')).map(cellLines);
      const label = PAGE.pick(cells);
      if (!label || byLabel.has(label)) continue;

      try {
        // eslint-disable-next-line no-await-in-loop
        const task = await API.create(API.Namespace.tag(PAGE.namespace, label));
        byLabel.set(label, task);
        created.push(task);
      } catch (error) {
        console.warn('[TaskFlow] Could not create task for "' + label + '":', error.message);
      }
    }

    // 3. Paint the live state onto every row.
    rows.forEach((row) => {
      const tds = row.querySelectorAll('td');
      const cells = Array.from(tds).map(cellLines);
      const label = PAGE.pick(cells);
      const task = label ? byLabel.get(label) : null;
      if (!task) return;

      row.setAttribute('data-taskflow-id', task.id);

      // Status cell -> append (never replace) the live chip.
      const statusTd = tds[PAGE.statusCell];
      if (statusTd) {
        const existing = statusTd.querySelector('.taskflow-chip');
        if (existing) existing.remove();
        statusTd.appendChild(buildChip(task));
      }

      // Actions cell -> append the toggle button.
      const actionsTd = tds[PAGE.actionsCell];
      if (actionsTd) {
        const holder = actionsTd.querySelector('div') || actionsTd;
        const old = holder.querySelector('.taskflow-toggle');
        if (old) old.remove();
        holder.appendChild(buildToggle(task, toggleTask));
      }
    });

    if (created.length) {
      console.log('[TaskFlow] Created ' + created.length + ' task(s) for ' + PAGE.namespace);
    }

    renderPanel(byLabel);
    await refreshStats();
  }

  /** Flip a task and repaint the row it belongs to. */
  async function toggleTask(task) {
    try {
      const updated = await API.toggle(task);
      if (updated) {
        task.completed = updated.completed;
        repaintTask(task);
      }
      renderPanel();
      await refreshStats();
    } catch (error) {
      console.warn('[TaskFlow] Toggle failed:', error.message);
      showError(error);
    }
  }

  /** Repaint a single row after its task changed. */
  function repaintTask(task) {
    const row = document.querySelector('[data-taskflow-id="' + task.id + '"]');
    if (!row || !PAGE) return;

    const tds = row.querySelectorAll('td');
    const statusTd = tds[PAGE.statusCell];
    if (statusTd) {
      const existing = statusTd.querySelector('.taskflow-chip');
      if (existing) existing.remove();
      statusTd.appendChild(buildChip(task));
    }

    const actionsTd = tds[PAGE.actionsCell];
    if (actionsTd) {
      const holder = actionsTd.querySelector('div') || actionsTd;
      const old = holder.querySelector('.taskflow-toggle');
      if (old) old.remove();
      holder.appendChild(buildToggle(task, toggleTask));
    }
  }

  /* ------------------------------------------------------------------ *
   * Live Task Desk panel
   * ------------------------------------------------------------------ */

  const state = {
    tasks: [],
    byId: new Map(),
    open: false,
    online: false,
  };

  function setStatus(online, message) {
    state.online = online;
    const dot = document.getElementById('taskflow-status-dot');
    const label = document.getElementById('taskflow-status-label');
    if (!dot || !label) return;
    dot.className =
      'w-2 h-2 rounded-full ' + (online ? 'bg-emerald-600' : 'bg-error');
    label.textContent = online ? 'API online' : message ? 'API error' : 'API offline';
    if (message) {
      label.title = message;
      dot.title = message;
    } else {
      label.removeAttribute('title');
      dot.removeAttribute('title');
    }
  }

  /**
   * Show a transient error banner inside the panel.
   * Rate-limit errors get a dedicated hint because they are the most
   * likely thing to be hit while the dashboard seeds its tasks.
   */
  function showError(error) {
    const panel = panelElement();
    if (!panel) return;

    let banner = document.getElementById('taskflow-error');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'taskflow-error';
      banner.className =
        'mx-3 mb-2 px-2.5 py-2 rounded-lg bg-error-container text-on-error-container text-label-sm text-label-sm';
      const body = document.getElementById('taskflow-desk-body');
      if (body) body.appendChild(banner);
    }

    const isRateLimit = error && error.status === 429;
    banner.textContent = isRateLimit
      ? 'Rate limit reached - wait a few minutes or raise WRITE_RATE_LIMIT_MAX on the API.'
      : (error && error.message) || 'Unexpected error';
    banner.style.display = 'block';

    setStatus(false, error && error.message);
    setTimeout(() => {
      banner.style.display = 'none';
    }, 8000);
  }

  function panelElement() {
    return document.getElementById('taskflow-desk');
  }

  function renderPanel(byLabel) {
    const list = document.getElementById('taskflow-list');
    if (!list) return;

    const tasks = byLabel
      ? Array.from(byLabel.values())
      : state.tasks.slice();

    state.tasks = tasks;
    state.byId = new Map(tasks.map((t) => [String(t.id), t]));

    if (!tasks.length) {
      list.innerHTML =
        '<p class="text-on-surface-variant text-body-sm px-1 py-3">No tasks tracked yet.</p>';
      renderPanelState();
      return;
    }

    list.innerHTML = '';
    tasks.forEach((task) => {
      const { label } = API.Namespace.parse(task.text);
      const item = document.createElement('div');
      item.className =
        'flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-container transition-colors';

      const checkbox = document.createElement('button');
      checkbox.type = 'button';
      checkbox.className =
        'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ' +
        (task.completed
          ? 'bg-secondary border-secondary text-on-secondary'
          : 'border-outline-variant hover:border-secondary');
      checkbox.innerHTML = task.completed
        ? '<span class="material-symbols-outlined text-[12px]">check</span>'
        : '';
      checkbox.title = task.completed ? 'Reopen' : 'Complete';
      checkbox.addEventListener('click', () => toggleTask(task));

      const text = document.createElement('span');
      text.className =
        'flex-1 truncate text-body-sm ' +
        (task.completed
          ? 'line-through text-on-surface-variant'
          : 'text-on-surface');
      text.textContent = label;
      text.title = task.text;

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className =
        'p-1 text-on-surface-variant hover:text-error transition-colors shrink-0';
      remove.innerHTML =
        '<span class="material-symbols-outlined text-[16px]">delete</span>';
      remove.title = 'Delete task';
      remove.addEventListener('click', async () => {
        try {
          await API.remove(task.id);
          const row = document.querySelector(
            '[data-taskflow-id="' + task.id + '"]'
          );
          if (row) {
            const chip = row.querySelector('.taskflow-chip');
            if (chip) chip.remove();
            const toggle = row.querySelector('.taskflow-toggle');
            if (toggle) toggle.remove();
          }
          state.tasks = state.tasks.filter((t) => t.id !== task.id);
          renderPanel();
          await refreshStats();
        } catch (error) {
          console.warn('[TaskFlow] Delete failed:', error.message);
          showError(error);
        }
      });

      item.appendChild(checkbox);
      item.appendChild(text);
      item.appendChild(remove);
      list.appendChild(item);
    });

    renderPanelState();
  }

  function renderPanelState() {
    const openCount = state.tasks.filter((t) => !t.completed).length;
    const doneCount = state.tasks.length - openCount;

    const openEl = document.getElementById('taskflow-open-count');
    const doneEl = document.getElementById('taskflow-done-count');
    if (openEl) openEl.textContent = String(openCount);
    if (doneEl) doneEl.textContent = String(doneCount);
  }

  function injectPanel() {
    if (document.getElementById('taskflow-desk')) return;

    const namespace = PAGE ? PAGE.namespace : 'General';

    const panel = document.createElement('aside');
    panel.id = 'taskflow-desk';
    panel.className =
      'fixed bottom-5 right-5 z-50 w-[340px] rounded-xl bg-surface-container-lowest shadow-[0_8px_28px_rgba(0,0,0,0.16)] border border-outline-variant/40 overflow-hidden font-body-sm';

    panel.innerHTML = [
      '<div id="taskflow-desk-header" class="flex items-center gap-2 px-4 py-3 bg-primary-container text-on-primary cursor-pointer select-none">',
      '  <span class="material-symbols-outlined text-[20px]">checklist</span>',
      '  <div class="flex flex-col flex-1 leading-tight">',
      '    <span class="font-label-lg text-label-lg font-semibold">Live Task Desk</span>',
      '    <span class="font-label-sm text-label-sm opacity-80">' +
        namespace +
        ' · synced with TaskFlow API</span>',
      '  </div>',
      '  <span id="taskflow-status-dot" class="w-2 h-2 rounded-full bg-outline"></span>',
      '  <span id="taskflow-status-label" class="font-label-sm text-label-sm opacity-80">connecting…</span>',
      '  <span id="taskflow-desk-caret" class="material-symbols-outlined text-[20px] transition-transform">expand_less</span>',
      '</div>',
      '<div id="taskflow-desk-body" class="p-3 flex flex-col gap-3">',
      '  <div class="flex items-center gap-2 text-label-sm text-label-sm text-on-surface-variant">',
      '    <span class="px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface">Open <b id="taskflow-open-count" class="text-on-surface">0</b></span>',
      '    <span class="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container">Cleared <b id="taskflow-done-count">0</b></span>',
      '    <a href="/api/docs" target="_blank" rel="noopener" class="underline hover:text-on-surface">API docs</a>',
      '    <button id="taskflow-signout" type="button" class="ml-auto inline-flex items-center gap-1 underline hover:text-on-surface">',
      '      <span class="material-symbols-outlined text-[14px]">logout</span>Sign out',
      '    </button>',
      '  </div>',
      '  <div class="flex gap-2">',
      '    <input id="taskflow-input" type="text" maxlength="255" placeholder="Add a task…"',
      '      class="flex-1 bg-surface-container px-3 py-2 rounded-lg text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-secondary text-body-sm"/>',
      '    <button id="taskflow-add" type="button"',
      '      class="px-3 py-2 rounded-lg bg-secondary text-on-secondary font-label-md text-label-md font-semibold hover:opacity-90 transition-opacity">Add</button>',
      '  </div>',
      '  <div id="taskflow-list" class="flex flex-col gap-0.5 max-h-[240px] overflow-y-auto"></div>',
      '</div>',
    ].join('\n');

    document.body.appendChild(panel);

    const body = document.getElementById('taskflow-desk-body');
    const caret = document.getElementById('taskflow-desk-caret');
    const header = document.getElementById('taskflow-desk-header');

    const setOpen = (open) => {
      state.open = open;
      body.style.display = open ? 'flex' : 'none';
      caret.textContent = open ? 'expand_less' : 'expand_more';
    };

    header.addEventListener('click', (event) => {
      if (event.target.closest('a')) return;
      setOpen(!state.open);
    });
    setOpen(true);

    const input = document.getElementById('taskflow-input');
    const addButton = document.getElementById('taskflow-add');

    const addTask = async () => {
      const value = input.value.trim();
      if (!value) return;
      input.value = '';
      try {
        const task = await API.create(
          API.Namespace.tag(namespace, value)
        );
        if (task) {
          state.tasks.push(task);
          renderPanelState();
          await syncRows();
        }
      } catch (error) {
        console.warn('[TaskFlow] Create failed:', error.message);
        showError(error);
      }
    };

    addButton.addEventListener('click', addTask);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') addTask();
    });

    const signOutButton = document.getElementById('taskflow-signout');
    if (signOutButton) signOutButton.addEventListener('click', signOut);
  }

  /* ------------------------------------------------------------------ *
   * Header KPI strip
   * ------------------------------------------------------------------ */

  async function refreshStats() {
    try {
      const stats = await API.stats();
      setStatus(true);
      const openEl = document.getElementById('taskflow-kpi-open');
      const doneEl = document.getElementById('taskflow-kpi-done');
      if (openEl) openEl.textContent = String(stats.open ?? 0);
      if (doneEl) doneEl.textContent = String(stats.completed ?? 0);

      const scope = stats.byNamespace && stats.byNamespace[PAGE ? PAGE.namespace : ''];
      const scopeEl = document.getElementById('taskflow-kpi-scope');
      if (scopeEl && scope) {
        scopeEl.textContent =
          scope.open + ' open · ' + scope.completed + ' cleared';
      }
    } catch (error) {
      setStatus(false, error.message);
    }
  }

  /* ------------------------------------------------------------------ *
   * Session awareness
   * ------------------------------------------------------------------ */

  /**
   * Render the signed-in librarian in the header instead of the static
   * placeholder, so the dashboard always reflects the current session.
   */
  async function applySessionUser() {
    try {
      const response = await fetch('/api/auth/session', {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
      });
      const payload = await response.json();
      const data = (payload && payload.data) || {};
      if (!data.authenticated || !data.user) return false;

      const user = data.user;

      const nameEl = document.querySelector('[data-tf-user-name]');
      if (nameEl) nameEl.textContent = user.name;

      const roleEl = document.querySelector('[data-tf-user-role]');
      if (roleEl) roleEl.textContent = user.role;

      const avatar = document.querySelector('[data-tf-user-avatar]');
      if (avatar) {
        const initials =
          user.initials ||
          user.name
            .split(' ')
            .map((part) => part.charAt(0))
            .join('')
            .slice(0, 2)
            .toUpperCase();
        const text = avatar.querySelector('text');
        if (text) text.textContent = initials;
        avatar.setAttribute('aria-label', user.name + ', ' + user.role);
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Sign out and return to the landing page.
   */
  async function signOut() {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
      });
    } finally {
      window.location.href = '/';
    }
  }

  /* ------------------------------------------------------------------ *
   * Bootstrap
   * ------------------------------------------------------------------ */

  async function init() {
    wireNavigation();
    wireKeyboardShortcuts();
    injectPanel();

    await applySessionUser();

    if (!PAGE) {
      await refreshStats();
      return;
    }

    await syncRows();

    // Keep the dashboard live: poll the API so changes made elsewhere
    // (Postman, another tab, the terminal) show up automatically.
    setInterval(async () => {
      if (document.hidden) return;
      await syncRows();
    }, 15000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
/* ------------------------------------------------------------------ *
   * Public surface (used by the action layer)
   * ------------------------------------------------------------------ */

  window.TaskFlowUI = {
    /** Re-read the tasks and repaint every row. */
    refresh: syncRows,
    /** Look up a task by id from the last sync. */
    taskById(id) {
      const needle = String(id);
      return state.byId.get(needle) || null;
    },
    /** The namespace (queue) this page belongs to. */
    namespace: PAGE ? PAGE.namespace : 'General',
  };
})();
