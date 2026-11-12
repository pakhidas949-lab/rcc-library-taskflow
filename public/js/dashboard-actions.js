/**
 * Dashboard action layer
 * ======================
 * Wires every button on the four dashboard pages to a real behaviour.
 *
 * Design rules
 * ------------
 * 1. Anything that changes data goes through the TaskFlow REST API
 *    (POST / PATCH / DELETE) - the buttons are not cosmetic simulations.
 * 2. Buttons are classified by their icon + label rather than by hand-written
 *    per-button handlers, so all 141 of them stay consistent.
 * 3. Every action gives the operator visible feedback (a toast).
 */
(function (global) {
  'use strict';

  const API = global.TaskFlowAPI;
  if (!API) {
    console.warn('[TaskFlow] API client not loaded - dashboard actions disabled.');
    return;
  }

  /* ------------------------------------------------------------------ *
   * Helpers
   * ------------------------------------------------------------------ */

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const iconOf = (el) => {
    const i = el.querySelector('.material-symbols-outlined');
    return i ? i.textContent.trim() : '';
  };

  const labelOf = (el) => {
    const clone = el.cloneNode(true);
    clone.querySelectorAll('.material-symbols-outlined').forEach((n) => n.remove());
    return clone.textContent.replace(/\s+/g, ' ').trim();
  };

  const escapeHtml = (value) =>
    String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  /** The <tbody> row a button belongs to (null for toolbar buttons). */
  const rowOf = (button) => button.closest('tbody tr');

  /** The live table on the page. */
  const liveTable = () => {
    const tables = $$('table');
    for (const table of tables) {
      if (table.querySelector('tbody tr')) return table;
    }
    return null;
  };

  /** All data rows currently in the table. */
  const dataRows = () => {
    const table = liveTable();
    return table ? $$('tbody tr', table) : [];
  };

  /** Human label for a row, taken from the cell the page config points at. */
  const rowLabel = (row) => {
    const id = row.getAttribute('data-taskflow-id');
    if (id) {
      const task = (global.TaskFlowUI && global.TaskFlowUI.taskById(id)) || null;
      if (task) return API.Namespace.parse(task.text).label;
    }
    const cells = $$('td', row).map((td) => {
      const clone = td.cloneNode(true);
      clone.querySelectorAll('.material-symbols-outlined').forEach((n) => n.remove());
      return clone.textContent.replace(/\s+/g, ' ').trim();
    });
    return cells.filter(Boolean)[1] || cells.filter(Boolean)[0] || 'Record';
  };

  /* ------------------------------------------------------------------ *
   * Toast notifications
   * ------------------------------------------------------------------ */

  const TOAST_STYLE = {
    info: 'bg-primary-container text-on-primary',
    success: 'bg-emerald-700 text-white',
    error: 'bg-error-container text-on-error-container',
    warn: 'bg-secondary-container text-on-secondary-container',
  };

  const TOAST_ICON = {
    info: 'info',
    success: 'check_circle',
    error: 'error',
    warn: 'warning',
  };

  function toastHost() {
    let host = document.getElementById('tf-toast-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'tf-toast-host';
      host.className =
        'fixed bottom-5 left-5 z-[60] flex flex-col gap-2 pointer-events-none';
      document.body.appendChild(host);
    }
    return host;
  }

  function toast(message, type) {
    const kind = type || 'info';
    const el = document.createElement('div');
    el.className =
      'tf-toast pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,.22)] font-body-sm text-body-sm max-w-sm transition-all opacity-0 translate-y-2 ' +
      (TOAST_STYLE[kind] || TOAST_STYLE.info);
    el.innerHTML =
      '<span class="material-symbols-outlined text-[18px] shrink-0">' +
      (TOAST_ICON[kind] || TOAST_ICON.info) +
      '</span><span>' +
      escapeHtml(message) +
      '</span>';

    toastHost().appendChild(el);
    requestAnimationFrame(() => {
      el.classList.remove('opacity-0', 'translate-y-2');
    });
    setTimeout(() => {
      el.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => el.remove(), 300);
    }, 4200);
  }

  /* ------------------------------------------------------------------ *
   * Generic modal (command + drawer share the shell)
   * ------------------------------------------------------------------ */

  function modalShell() {
    let modal = document.getElementById('tf-modal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'tf-modal';
    modal.className = 'fixed inset-0 z-[70] hidden';
    modal.innerHTML = `
      <div class="absolute inset-0 bg-primary-container/50 backdrop-blur-sm" data-close="1"></div>
      <div class="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div id="tf-modal-card"
             class="pointer-events-auto w-full max-w-md rounded-2xl bg-surface-container-lowest shadow-[0_30px_80px_rgba(0,0,0,.3)] ring-1 ring-outline-variant/40 overflow-hidden max-h-[90vh] flex flex-col"></div>
      </div>`;
    document.body.appendChild(modal);

    modal.addEventListener('click', (event) => {
      if (event.target.closest('[data-close="1"]')) closeModal();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
    });

    return modal;
  }

  function openModal(html) {
    const modal = modalShell();
    $('#tf-modal-card', modal).innerHTML = html;
    modal.classList.remove('hidden');
    const focusable = $('#tf-modal-card input, #tf-modal-card textarea', modal);
    if (focusable) focusable.focus();
  }

  function closeModal() {
    const modal = document.getElementById('tf-modal');
    if (modal) modal.classList.add('hidden');
  }

  /* ------------------------------------------------------------------ *
   * Command modal - creates a real task through the API
   * ------------------------------------------------------------------ */

  const PAGE_NAMESPACE = {
    '/dashboard': 'Catalog',
    '/dashboard/pages/page1.html': 'Circulation',
    '/dashboard/pages/page2.html': 'Borrowers',
    '/dashboard/pages/page3.html': 'Acquisitions',
  };

  const currentNamespace = () => {
    const path = window.location.pathname.replace(/\/+$/, '') || '/dashboard';
    return PAGE_NAMESPACE[path] || 'General';
  };

  /**
   * Show a form that POSTs a new task.
   * @param {object} opts
   */
  function openCommand(opts) {
    const o = opts || {};
    const title = o.title || 'New task';
    const description = o.description || '';
    const placeholder = o.placeholder || 'Describe the task…';
    const submitLabel = o.submitLabel || 'Create task';
    const namespace = o.namespace || currentNamespace();
    const prefill = o.prefill || '';

    openModal(`
      <div class="px-6 py-5 border-b border-outline-variant/40">
        <div class="flex items-start gap-3">
          <span class="inline-flex w-10 h-10 items-center justify-center rounded-xl bg-surface-container text-secondary shrink-0">
            <span class="material-symbols-outlined text-[20px]">${o.icon || 'add_task'}</span>
          </span>
          <div class="flex-1">
            <h3 class="font-headline-sm text-headline-sm font-semibold">${escapeHtml(title)}</h3>
            ${description ? `<p class="font-body-sm text-body-sm text-on-surface-variant mt-1">${escapeHtml(description)}</p>` : ''}
          </div>
          <button type="button" data-close="1" class="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors">
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      </div>
      <form id="tf-command-form" class="px-6 py-5 flex flex-col gap-3 overflow-y-auto">
        <label class="font-label-md text-label-md font-semibold text-on-surface" for="tf-command-input">${escapeHtml(o.label || 'Task')}</label>
        <textarea id="tf-command-input" rows="3" maxlength="255"
                  class="w-full bg-surface-container-low px-3.5 py-2.5 rounded-xl font-body-sm text-body-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary resize-none transition-all"
                  placeholder="${escapeHtml(placeholder)}">${escapeHtml(prefill)}</textarea>
        <p class="font-body-sm text-body-sm text-on-surface-variant">
          Saved to the <strong class="font-semibold text-on-surface">${escapeHtml(namespace)}</strong> queue
          <span class="font-code-num text-code-num">(${escapeHtml(namespace)})</span> via <span class="font-code-num text-code-num">POST /api/tasks</span>.
        </p>
        <div class="flex justify-end gap-2 pt-1">
          <button type="button" data-close="1" class="px-4 py-2.5 rounded-xl font-label-md text-label-md font-semibold text-on-surface-variant hover:bg-surface-container transition-colors">Cancel</button>
          <button type="submit" id="tf-command-submit" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-container text-on-primary font-label-md text-label-md font-semibold hover:opacity-90 transition-opacity">
            <span class="material-symbols-outlined text-[18px]">add_task</span>${escapeHtml(submitLabel)}
          </button>
        </div>
      </form>`);

    const form = document.getElementById('tf-command-form');
    const input = document.getElementById('tf-command-input');
    const submit = document.getElementById('tf-command-submit');

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text) {
        toast('Please enter a task description.', 'warn');
        input.focus();
        return;
      }

      submit.disabled = true;
      try {
        const created = await API.create(API.Namespace.tag(namespace, text));
        closeModal();
        toast('Task created: ' + created.text.replace(/^\[[^\]]+\]\s*/, ''), 'success');
        if (global.TaskFlowUI) await global.TaskFlowUI.refresh();
      } catch (error) {
        toast(error.message, 'error');
        submit.disabled = false;
      }
    });
  }

  /* ------------------------------------------------------------------ *
   * Record drawer - shows a row and its task, with live actions
   * ------------------------------------------------------------------ */

  function openDrawer(row) {
    const label = rowLabel(row);
    const id = row.getAttribute('data-taskflow-id');
    const task = id && global.TaskFlowUI ? global.TaskFlowUI.taskById(id) : null;

    const cells = $$('td', row).map((td) => {
      const clone = td.cloneNode(true);
      clone.querySelectorAll('.material-symbols-outlined').forEach((n) => n.remove());
      return {
        text: clone.textContent.replace(/\s+/g, ' ').trim(),
        raw: td.innerHTML,
        icon: td.querySelector('.material-symbols-outlined')
          ? td.querySelector('.material-symbols-outlined').textContent.trim()
          : '',
      };
    });

    const body = cells
      .map(
        (cell) => `
        <div class="flex items-start gap-3 py-2.5 border-b border-outline-variant/30 last:border-0">
          <span class="material-symbols-outlined text-[18px] text-secondary shrink-0 mt-0.5">${cell.icon || 'label'}</span>
          <p class="font-body-sm text-body-sm text-on-surface break-words">${escapeHtml(cell.text) || '&nbsp;'}</p>
        </div>`
      )
      .join('');

    const taskBlock = task
      ? `<div class="rounded-xl bg-surface-container-low p-4 flex flex-col gap-3">
           <div class="flex items-center gap-2">
             <span class="w-2 h-2 rounded-full ${task.completed ? 'bg-secondary' : 'bg-outline'}"></span>
             <p class="font-label-md text-label-md font-semibold">${task.completed ? 'Task cleared' : 'Task open'}</p>
           </div>
           <p class="font-body-sm text-body-sm text-on-surface-variant break-words">${escapeHtml(task.text)}</p>
           <p class="font-code-num text-code-num text-on-surface-variant">Task #${task.id} · updated ${new Date(task.updatedAt).toLocaleString()}</p>
         </div>`
      : `<div class="rounded-xl bg-surface-container-low p-4">
           <p class="font-body-sm text-body-sm text-on-surface-variant">No task is linked to this record yet.</p>
         </div>`;

    openModal(`
      <div class="px-6 py-5 border-b border-outline-variant/40 flex items-start gap-3">
        <span class="inline-flex w-10 h-10 items-center justify-center rounded-xl bg-surface-container text-secondary shrink-0">
          <span class="material-symbols-outlined text-[20px]">library_books</span>
        </span>
        <div class="flex-1 min-w-0">
          <p class="font-label-sm text-label-sm text-secondary uppercase tracking-wider font-bold">Record</p>
          <h3 class="font-headline-sm text-headline-sm font-semibold break-words">${escapeHtml(label)}</h3>
        </div>
        <button type="button" data-close="1" class="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors">
          <span class="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>
      <div class="px-6 py-5 flex flex-col gap-4 overflow-y-auto">
        ${taskBlock}
        <div>${body}</div>
      </div>
      <div class="px-6 py-4 border-t border-outline-variant/40 flex flex-wrap gap-2">
        ${
          task
            ? `<button type="button" data-drawer-act="toggle" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-container text-on-primary font-label-md text-label-md font-semibold hover:opacity-90 transition-opacity">
                 <span class="material-symbols-outlined text-[18px]">${task.completed ? 'undo' : 'check_circle'}</span>
                 ${task.completed ? 'Reopen task' : 'Clear task'}
               </button>
               <button type="button" data-drawer-act="followup" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary-container text-on-secondary-container font-label-md text-label-md font-semibold hover:opacity-90 transition-opacity">
                 <span class="material-symbols-outlined text-[18px]">add_task</span>
                 Add follow-up
               </button>
               <button type="button" data-drawer-act="delete" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-label-md text-label-md font-semibold text-error hover:bg-error-container transition-colors">
                 <span class="material-symbols-outlined text-[18px]">delete</span>
                 Delete
               </button>`
            : `<button type="button" data-drawer-act="create" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-container text-on-primary font-label-md text-label-md font-semibold hover:opacity-90 transition-opacity">
                 <span class="material-symbols-outlined text-[18px]">add_task</span>
                 Create task
               </button>`
        }
      </div>`);

    $$('[data-drawer-act]', modalShell()).forEach((button) => {
      button.addEventListener('click', async () => {
        const act = button.getAttribute('data-drawer-act');

        if (act === 'create' || act === 'followup') {
          closeModal();
          openCommand({
            title: act === 'create' ? 'New task' : 'Follow-up for ' + label,
            description: 'Linked to the record "' + label + '".',
            icon: 'add_task',
            label: 'Task',
            placeholder: 'What needs to happen?',
            prefill: act === 'followup' ? '' : label,
            submitLabel: act === 'create' ? 'Create task' : 'Add follow-up',
          });
          return;
        }

        if (!task) return;

        try {
          if (act === 'toggle') {
            const updated = await API.toggle(task);
            toast(updated.completed ? 'Task cleared.' : 'Task reopened.', 'success');
          } else if (act === 'delete') {
            await API.remove(task.id);
            toast('Task deleted.', 'info');
          }
          closeModal();
          if (global.TaskFlowUI) await global.TaskFlowUI.refresh();
        } catch (error) {
          toast(error.message, 'error');
        }
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * Filtering
   * ------------------------------------------------------------------ */

  const activeFilters = new Map();

  /** Which table column a filter button should read from. */
  const filterColumn = (label) => {
    const l = label.toLowerCase();
    if (l.startsWith('status')) return 'status';
    if (l.startsWith('collection') || l.startsWith('location')) return 'location';
    if (l.startsWith('format') || l.startsWith('holdings')) return 'holdings';
    if (l.startsWith('scheme') || l.startsWith('call')) return 'call';
    return null;
  };

  const columnIndex = (kind) => {
    const table = liveTable();
    if (!table) return -1;
    const headers = $$('thead th', table).map((th) => th.textContent.replace(/\s+/g, ' ').trim().toLowerCase());
    const map = {
      status: ['status', 'order status', 'standing', 'card valid'],
      location: ['location'],
      holdings: ['holdings', 'active loans', 'fines', 'commitment', 'timeline & eta'],
      call: ['call number & isbn', 'patron details', 'po identifier', 'time / action'],
    };
    const candidates = map[kind] || [];
    for (let i = 0; i < headers.length; i += 1) {
      if (candidates.some((c) => headers[i].indexOf(c) !== -1)) return i;
    }
    return -1;
  };

  /** Distinct values available for a filter. */
  const filterValues = (kind) => {
    const index = columnIndex(kind);
    const values = new Set();
    dataRows().forEach((row) => {
      const cell = $$('td', row)[index];
      if (!cell) return;
      const clone = cell.cloneNode(true);
      clone.querySelectorAll('.material-symbols-outlined').forEach((n) => n.remove());
      const value = clone.textContent.replace(/\s+/g, ' ').trim();
      if (value) values.add(value);
    });
    return Array.from(values);
  };

  function openFilterMenu(button) {
    const label = labelOf(button);
    const kind = filterColumn(label);
    const values = kind ? filterValues(kind) : [];
    const current = activeFilters.get(label);

    openModal(`
      <div class="px-6 py-5 border-b border-outline-variant/40 flex items-start gap-3">
        <span class="inline-flex w-10 h-10 items-center justify-center rounded-xl bg-surface-container text-secondary shrink-0">
          <span class="material-symbols-outlined text-[20px]">filter_alt</span>
        </span>
        <div class="flex-1">
          <h3 class="font-headline-sm text-headline-sm font-semibold">${escapeHtml(label)}</h3>
          <p class="font-body-sm text-body-sm text-on-surface-variant mt-1">Filter the rows in this table.</p>
        </div>
        <button type="button" data-close="1" class="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors">
          <span class="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>
      <div class="px-6 py-4 flex flex-col gap-1.5 max-h-[46vh] overflow-y-auto">
        <button type="button" data-filter-value="" class="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left font-body-sm text-body-sm hover:bg-surface-container transition-colors ${!current ? 'bg-surface-container font-semibold' : 'text-on-surface-variant'}">
          <span>All</span>
          ${!current ? '<span class="material-symbols-outlined text-[16px] text-secondary">check</span>' : ''}
        </button>
        ${
          values.length
            ? values
                .map(
                  (v) => `<button type="button" data-filter-value="${escapeHtml(v)}"
                    class="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left font-body-sm text-body-sm hover:bg-surface-container transition-colors ${current === v ? 'bg-surface-container font-semibold' : 'text-on-surface-variant'}">
                    <span class="truncate">${escapeHtml(v)}</span>
                    ${current === v ? '<span class="material-symbols-outlined text-[16px] text-secondary">check</span>' : ''}
                  </button>`
                )
                .join('')
            : '<p class="font-body-sm text-body-sm text-on-surface-variant px-3.5 py-2">This filter matches against the whole row.</p>'
        }
      </div>
      <div class="px-6 py-4 border-t border-outline-variant/40 flex justify-end gap-2">
        <button type="button" data-close="1" class="px-4 py-2.5 rounded-xl font-label-md text-label-md font-semibold text-on-surface-variant hover:bg-surface-container transition-colors">Cancel</button>
        <button type="button" id="tf-filter-apply" class="px-5 py-2.5 rounded-xl bg-primary-container text-on-primary font-label-md text-label-md font-semibold hover:opacity-90 transition-opacity">Apply</button>
      </div>`);

    let chosen = current || '';
    $$('[data-filter-value]', modalShell()).forEach((option) => {
      option.addEventListener('click', () => {
        chosen = option.getAttribute('data-filter-value');
        $$('[data-filter-value]', modalShell()).forEach((o) => o.classList.remove('bg-surface-container', 'font-semibold'));
        option.classList.add('bg-surface-container', 'font-semibold');
      });
    });

    const apply = document.getElementById('tf-filter-apply');
    if (apply) {
      apply.addEventListener('click', () => {
        if (chosen) activeFilters.set(label, chosen);
        else activeFilters.delete(label);
        closeModal();
        applyFilters();
        toast(chosen ? label + ': ' + chosen : label + ' cleared', 'info');
      });
    }
  }

  /** Apply every active filter to the table. */
  function applyFilters() {
    const table = liveTable();
    if (!table) return;

    const entries = Array.from(activeFilters.entries());
    let visible = 0;

    dataRows().forEach((row) => {
      const rowText = row.textContent.replace(/\s+/g, ' ').toLowerCase();
      let show = true;

      entries.forEach(([label, value]) => {
        const kind = filterColumn(label);
        const index = kind ? columnIndex(kind) : -1;
        const cell = index >= 0 ? $$('td', row)[index] : null;
        const source = cell ? cell.textContent.replace(/\s+/g, ' ').toLowerCase() : rowText;
        if (!source.includes(String(value).toLowerCase())) show = false;
      });

      row.style.display = show ? '' : 'none';
      if (show) visible += 1;
    });

    // Keep the footer count honest.
    const counter = $$('span').find((s) => /^Showing \d+/.test(s.textContent.trim()));
    if (counter) {
      counter.textContent = 'Showing ' + visible + '–' + visible + ' of ' + visible + ' matches';
    }
  }

  function clearFilters() {
    activeFilters.clear();
    applyFilters();
    toast('All filters cleared.', 'info');
  }

  /* ------------------------------------------------------------------ *
   * View switching (table / grid / columns)
   * ------------------------------------------------------------------ */

  function setView(mode) {
    const table = liveTable();
    if (!table) return;

    $$('[data-tf-view]').forEach((b) => {
      const active = b.getAttribute('data-tf-view') === mode;
      b.classList.toggle('bg-surface-container-highest', active);
      b.classList.toggle('text-on-surface', active);
      b.classList.toggle('text-on-surface-variant', !active);
    });

    if (mode === 'grid') {
      table.classList.add('hidden');
      let grid = document.getElementById('tf-grid-view');
      if (!grid) {
        grid = document.createElement('div');
        grid.id = 'tf-grid-view';
        grid.className = 'grid sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4';
        table.parentElement.insertBefore(grid, table);
      }
      grid.innerHTML = dataRows()
        .map(
          (row) => `
          <div class="rounded-xl bg-surface-container-low p-4 border border-outline-variant/40">
            <p class="font-label-md text-label-md font-semibold">${escapeHtml(rowLabel(row))}</p>
            <p class="font-body-sm text-body-sm text-on-surface-variant mt-1 line-clamp-3">${escapeHtml(
              $$('td', row)
                .map((td) => td.textContent.replace(/\s+/g, ' ').trim())
                .filter(Boolean)
                .slice(1, 4)
                .join(' · ')
            )}</p>
          </div>`
        )
        .join('');
      grid.classList.remove('hidden');
    } else {
      const grid = document.getElementById('tf-grid-view');
      if (grid) grid.classList.add('hidden');
      table.classList.remove('hidden');
    }

    toast('View: ' + mode, 'info');
  }

  /* ------------------------------------------------------------------ *
   * CSV export - pulls the live data from the API
   * ------------------------------------------------------------------ */

  async function exportCsv(name) {
    try {
      const tasks = await API.list();
      const rows = tasks.map((t) => {
        const { namespace, label } = API.Namespace.parse(t.text);
        return [t.id, namespace || '', label, t.completed ? 'yes' : 'no', t.createdAt, t.updatedAt];
      });

      const csv = [
        ['id', 'queue', 'task', 'completed', 'createdAt', 'updatedAt'].join(','),
        ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name || 'taskflow-export.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast('Exported ' + tasks.length + ' tasks.', 'success');
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  /* ------------------------------------------------------------------ *
   * Bulk actions - create one task per affected row
   * ------------------------------------------------------------------ */

  async function bulkTask(action, scope) {
    const rows = dataRows().filter((r) => r.style.display !== 'none');
    if (!rows.length) {
      toast('No rows to act on.', 'warn');
      return;
    }

    try {
      const created = [];
      for (const row of rows) {
        // eslint-disable-next-line no-await-in-loop
        const task = await API.create(
          API.Namespace.tag(currentNamespace(), action + ' · ' + rowLabel(row))
        );
        created.push(task);
      }
      toast(
        action + ': queued ' + created.length + ' ' + (scope || 'record') + '(s).',
        'success'
      );
      if (global.TaskFlowUI) await global.TaskFlowUI.refresh();
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  /* ------------------------------------------------------------------ *
   * Action classification
   * ------------------------------------------------------------------ */

  const FILTER_LABELS = [
    'format:',
    'collection:',
    'scheme:',
    'status:',
    'this term',
    'past 30 days',
    'academic year',
  ];

  const isFilterButton = (button) => {
    const label = labelOf(button).toLowerCase();
    if (FILTER_LABELS.some((f) => label.startsWith(f))) return true;
    return iconOf(button) === 'expand_more' || label === 'filters';
  };

  const isViewButton = (button) =>
    ['table_rows', 'grid_view', 'view_column'].includes(iconOf(button));

  const isPaginationButton = (button) => {
    const icon = iconOf(button);
    return ['first_page', 'chevron_left', 'chevron_right', 'last_page'].includes(icon);
  };

  const isCloseButton = (button) => iconOf(button) === 'close';

  const isPrintButton = (button) => iconOf(button) === 'print';

  const isExportButton = (button) =>
    iconOf(button) === 'download' || iconOf(button) === 'file_download';

  /**
   * The main dispatcher. Returns true if the button was handled.
   */
  async function handle(button) {
    const icon = iconOf(button);
    const label = labelOf(button);
    const row = rowOf(button);
    const lower = label.toLowerCase();

    // --- structural ---
    if (isCloseButton(button)) {
      const container = button.closest('[data-tf-drawer], .fixed, .absolute');
      if (container && container.id !== 'tf-modal') {
        container.classList.add('hidden');
        toast('Closed.', 'info');
        return true;
      }
      closeModal();
      return true;
    }

    if (isFilterButton(button)) {
      openFilterMenu(button);
      return true;
    }

    if (isViewButton(button)) {
      const mode =
        iconOf(button) === 'grid_view' ? 'grid' : iconOf(button) === 'view_column' ? 'columns' : 'table';
      setView(mode);
      return true;
    }

    if (isPaginationButton(button)) {
      paginate(icon);
      return true;
    }

    if (isPrintButton(button)) {
      window.print();
      toast('Sending to the printer…', 'info');
      return true;
    }

    if (isExportButton(button)) {
      await exportCsv(label.toLowerCase().includes('roster') ? 'patron-roster.csv' : 'taskflow-export.csv');
      return true;
    }

    if (lower === 'reset all' || lower === 'reset filters') {
      clearFilters();
      return true;
    }

    // --- global toolbar ---
    if (icon === 'barcode_scanner' && label.toLowerCase().includes('quick check-in')) {
      openCommand({
        title: 'Quick check-in / out',
        description: 'Log an item movement at the desk.',
        icon: 'barcode_scanner',
        label: 'Item and action',
        placeholder: 'e.g. Return received · Principles of Neural Science',
        submitLabel: 'Log movement',
      });
      return true;
    }

    if (icon === 'qr_code_scanner' && label.toLowerCase().includes('scan barcode')) {
      openCommand({
        title: 'Scan a barcode',
        description: 'Record a scan against the current queue.',
        icon: 'qr_code_scanner',
        label: 'Barcode / item',
        placeholder: 'e.g. #39002148',
        submitLabel: 'Record scan',
      });
      return true;
    }

    if (icon === 'notifications') {
      openNotifications();
      return true;
    }

    // --- primary create-style CTAs ---
    if (lower.includes('add new') || lower.includes('+ add') || lower.includes('create purchase order') || lower.includes('register new patron') || lower.includes('issue new loan') || lower.includes('quick checkout') || lower.includes('import vendor catalog') || lower.includes('batch barcode import')) {
      openCommand({
        title: label.replace(/^\+\s*/, ''),
        description: 'This creates a task in the ' + currentNamespace() + ' queue.',
        icon: 'add_task',
        label: 'Details',
        placeholder: 'Describe what needs to happen…',
        submitLabel: 'Create task',
      });
      return true;
    }

    // --- bulk queue actions ---
    if (
      lower.includes('batch overdue reminders') ||
      lower.includes('batch signoff') ||
      lower.includes('review patron requests') ||
      lower.includes('notify courier') ||
      lower.includes('review holds') ||
      lower.includes('approve scans') ||
      lower.includes('batch rfid encode')
    ) {
      await bulkTask(label.replace(/\s*\d+\s*$/, '').trim(), 'item');
      return true;
    }

    // --- feature tiles that filter the table ---
    if (['inventory', 'how_to_reg', 'corporate_fare', 'shelves', 'fact_check', 'outgoing_mail', 'local_printshop', 'receipt_long', 'sync', 'flag', 'more_vert'].includes(icon)) {
      openCommand({
        title: label || 'Queue an action',
        description: 'Records this action against every visible row.',
        icon: icon,
        label: 'Details',
        placeholder: 'What should happen?',
        submitLabel: 'Queue action',
      });
      return true;
    }

    // --- row-level actions ---
    if (row) {
      const rowActions = {
        edit_note: { title: 'MARC21 record', icon: 'edit_note' },
        bookmark_add: { title: 'Place a hold', icon: 'bookmark_add' },
        bookmark: { title: 'Place a hold', icon: 'bookmark_add' },
        more_vert: { title: 'Record actions', icon: 'more_horiz' },
        open_in_new: { title: 'Open record', icon: 'open_in_new' },
        history: { title: 'Circulation history', icon: 'history' },
        qr_code_2: { title: 'Print slip', icon: 'qr_code_2' },
        visibility: { title: 'Patron record', icon: 'visibility' },
        add_shopping_cart: { title: 'Add to loan queue', icon: 'add_shopping_cart' },
        send: { title: 'Send notice', icon: 'send' },
        autorenew: { title: 'Renew loan', icon: 'autorenew' },
        location_on: { title: 'Delivery location', icon: 'location_on' },
        description: { title: 'Item detail', icon: 'description' },
        inventory_2: { title: 'Process remaining', icon: 'inventory_2' },
        assignment_late: { title: 'Flag as late', icon: 'assignment_late' },
        badge: { title: 'Membership badge', icon: 'badge' },
        lock: { title: 'Access control', icon: 'lock' },
        account_circle: { title: 'Patron account', icon: 'account_circle' },
        local_printshop: { title: 'Print on demand', icon: 'local_printshop' },
        dataset: { title: 'Export record', icon: 'dataset' },
        tune: { title: 'Configure', icon: 'tune' },
      };

      const spec = rowActions[icon];
      if (spec) {
        if (lower.includes('print') || lower.includes('slip') || lower.includes('spine') || lower.includes('statement')) {
          window.print();
          toast(spec.title + ': sending to printer…', 'info');
          return true;
        }
        if (lower.includes('export') || lower.includes('download')) {
          await exportCsv(label.toLowerCase().includes('roster') ? 'patron-roster.csv' : 'taskflow-export.csv');
          return true;
        }
        openDrawer(row);
        return true;
      }
    }

    // --- labelled row CTAs (Renew, Collect, Extend loan, ...) ---
    if (
      row &&
      /(renew|collect|extend|assign loan|print statement|send notice|re-send po|process remaining|receive items|review queue|view all)/.test(
        lower
      )
    ) {
      if (lower.includes('print')) {
        window.print();
        toast('Sending to printer…', 'info');
        return true;
      }
      if (lower.includes('view all')) {
        applyFilters();
        toast('Showing all visible rows.', 'info');
        return true;
      }
      await bulkTask(label.replace(/\s*→\s*$/, '').trim(), 'record');
      return true;
    }

    // --- scan / verification ---
    if (lower.includes('verify item') || lower.includes('single scan') || lower.includes('rfid tunnel') || lower.includes('check-in returns')) {
      openCommand({
        title: label,
        description: 'Records a scan against the current queue.',
        icon: 'qr_code_scanner',
        label: 'Scan / reference',
        placeholder: 'e.g. #39002148 or a note',
        submitLabel: 'Record scan',
      });
      return true;
    }

    // --- generic fallback: open the record drawer ---
    if (row) {
      openDrawer(row);
      return true;
    }

    toast(label ? label + ' — no action is configured for this control.' : 'Nothing to do.', 'warn');
    return false;
  }

  /* ------------------------------------------------------------------ *
   * Notifications
   * ------------------------------------------------------------------ */

  async function openNotifications() {
    try {
      const tasks = await API.list();
      const open = tasks.filter((t) => !t.completed).slice(0, 12);

      openModal(`
        <div class="px-6 py-5 border-b border-outline-variant/40 flex items-start gap-3">
          <span class="inline-flex w-10 h-10 items-center justify-center rounded-xl bg-surface-container text-secondary shrink-0">
            <span class="material-symbols-outlined text-[20px]">notifications</span>
          </span>
          <div class="flex-1">
            <h3 class="font-headline-sm text-headline-sm font-semibold">Open tasks</h3>
            <p class="font-body-sm text-body-sm text-on-surface-variant mt-1">${open.length} item(s) still in the queue.</p>
          </div>
          <button type="button" data-close="1" class="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors">
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        <div class="px-6 py-4 flex flex-col gap-1.5 max-h-[52vh] overflow-y-auto">
          ${
            open.length
              ? open
                  .map((t) => {
                    const { namespace, label } = API.Namespace.parse(t.text);
                    return `<div class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-surface-container-low">
                      <span class="w-1.5 h-1.5 rounded-full bg-secondary shrink-0"></span>
                      <span class="flex-1 min-w-0">
                        <span class="font-body-sm text-body-sm text-on-surface block truncate">${escapeHtml(label)}</span>
                        <span class="font-label-sm text-label-sm text-on-surface-variant">${escapeHtml(namespace || 'General')}</span>
                      </span>
                      <span class="font-code-num text-code-num text-on-surface-variant">#${t.id}</span>
                    </div>`;
                  })
                  .join('')
              : '<p class="font-body-sm text-body-sm text-on-surface-variant px-1 py-3">Nothing is pending. Enjoy the quiet.</p>'
          }
        </div>
        <div class="px-6 py-4 border-t border-outline-variant/40 flex justify-end">
          <button type="button" data-close="1" class="px-4 py-2.5 rounded-xl font-label-md text-label-md font-semibold text-on-surface-variant hover:bg-surface-container transition-colors">Close</button>
        </div>`);
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  /* ------------------------------------------------------------------ *
   * Pagination
   * ------------------------------------------------------------------ */

  let page = 1;
  const PAGE_SIZE = 6;

  function paginate(icon) {
    const rows = dataRows();
    const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

    if (icon === 'first_page') page = 1;
    else if (icon === 'last_page') page = pages;
    else if (icon === 'chevron_left') page = Math.max(1, page - 1);
    else if (icon === 'chevron_right') page = Math.min(pages, page + 1);

    rows.forEach((row, index) => {
      const start = (page - 1) * PAGE_SIZE;
      row.style.display = index >= start && index < start + PAGE_SIZE ? '' : 'none';
    });

    toast('Page ' + page + ' of ' + pages, 'info');
  }

  /* ------------------------------------------------------------------ *
   * Bootstrap
   * ------------------------------------------------------------------ */

  function wire() {
    // Every button on the page goes through the dispatcher - except the
    // Live Task Desk panel, which owns its own handlers.
    $$('button').forEach((button) => {
      if (button.dataset.tfWired === '1') return;
      if (button.closest('#taskflow-desk')) return;
      button.dataset.tfWired = '1';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        handle(button).catch((error) => toast(error.message, 'error'));
      });
    });

    // Tag the view-mode buttons so setView can highlight the active one.
    $$('button').forEach((button) => {
      const icon = iconOf(button);
      if (icon === 'table_rows') button.dataset.tfView = 'table';
      if (icon === 'grid_view') button.dataset.tfView = 'grid';
      if (icon === 'view_column') button.dataset.tfView = 'columns';
    });

    // Keyboard: Ctrl+K focus search, Escape closes any overlay.
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeModal();
    });
  }

  const start = () => {
    wire();
    // Re-wire after the live-data layer has injected its own controls.
    setTimeout(wire, 400);
    setTimeout(wire, 1500);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  global.TaskFlowActions = {
    toast,
    openCommand,
    openDrawer,
    openFilterMenu,
    exportCsv,
    applyFilters,
    clearFilters,
    setView,
    paginate,
    handle,
    wire,
  };
})(window);
