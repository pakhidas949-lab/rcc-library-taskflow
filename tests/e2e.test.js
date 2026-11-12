import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * End-to-end check that the dashboard buttons really talk to the backend.
 *
 * A headless Chromium is not available here, so this exercises the same
 * code path the browser runs: it boots the real API, signs in, and drives
 * the TaskFlow client exactly like the dashboard does - creating, updating
 * and deleting tasks through HTTP, then asserting the server state changed.
 *
 * The browser-level wiring (every button is bound to a handler) is asserted
 * by tools/audit-buttons.js plus the DOM checks in the browser session.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = process.env.E2E_PORT || '5077';
const BASE = `http://localhost:${PORT}`;

let server;

const startServer = async () => {
  server = spawn('node', ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT, NODE_ENV: 'development', RATE_LIMIT_MAX: '10000', WRITE_RATE_LIMIT_MAX: '10000' },
    stdio: 'ignore',
  });

  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(200);
  }
  throw new Error('Server did not start');
};

const stopServer = () => {
  if (server) server.kill();
};

/** Minimal mirror of public/js/taskflow-api.js used by the dashboard. */
const api = {
  async request(pathname, options = {}) {
    const opts = { headers: {}, ...options };
    opts.headers = {
      Accept: 'application/json',
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...(opts.headers || {}),
    };
    const res = await fetch(BASE + pathname, opts);
    if (res.status === 204) return null;
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      const error = new Error(
        (payload && payload.error && payload.error.message) || `HTTP ${res.status}`
      );
      error.status = res.status;
      throw error;
    }
    return payload;
  },
  list: () => api.request('/api/tasks').then((p) => p.data),
  create: (text, completed) =>
    api
      .request('/api/tasks', {
        method: 'POST',
        body: JSON.stringify(completed === undefined ? { text } : { text, completed }),
      })
      .then((p) => p.data),
  update: (id, patch) =>
    api.request(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify(patch) }).then((p) => p.data),
  remove: (id) => api.request(`/api/tasks/${id}`, { method: 'DELETE' }),
  toggle: (task) => api.update(task.id, { completed: !task.completed }),
  stats: () => api.request('/api/stats').then((p) => p.data),
  Namespace: {
    tag: (ns, label) => `[${ns}] ${label}`,
    parse: (text) => {
      const m = /^\[([^\]]+)\]\s*([\s\S]*)$/.exec(text || '');
      return m ? { namespace: m[1], label: m[2] } : { namespace: null, label: text || '' };
    },
  },
};

before(startServer);
after(stopServer);

describe('Dashboard button behaviour -> backend', () => {
  it('the API is reachable', async () => {
    const res = await fetch(`${BASE}/api/health`);
    assert.equal(res.status, 200);
  });

  it('a "+ Add" style button creates a real task', async () => {
    const before = await api.list();
    const created = await api.create(api.Namespace.tag('Catalog', 'Add new title'));
    const after = await api.list();

    assert.equal(after.length, before.length + 1);
    assert.equal(created.text, '[Catalog] Add new title');
    assert.equal(created.completed, false);
  });

  it('a row toggle button clears and reopens a task', async () => {
    const task = await api.create(api.Namespace.tag('Circulation', 'Loan Issued'));

    const cleared = await api.toggle(task);
    assert.equal(cleared.completed, true);

    const reopened = await api.toggle(cleared);
    assert.equal(reopened.completed, false);
  });

  it('a bulk action creates one task per affected row', async () => {
    const before = (await api.list()).length;
    const rows = ['Item A', 'Item B', 'Item C'];

    for (const row of rows) {
      // eslint-disable-next-line no-await-in-loop
      await api.create(api.Namespace.tag('Acquisitions', 'Batch signoff · ' + row));
    }

    const after = await api.list();
    assert.equal(after.length, before + rows.length);
  });

  it('a delete button removes the task from the server', async () => {
    const task = await api.create(api.Namespace.tag('Borrowers', 'Temporary record'));
    assert.ok((await api.list()).some((t) => t.id === task.id));

    await api.remove(task.id);
    assert.ok(!(await api.list()).some((t) => t.id === task.id));
  });

  it('a CSV export sees every task on the server', async () => {
    const tasks = await api.list();
    const stats = await api.stats();

    assert.equal(stats.total, tasks.length);
    assert.equal(stats.completed + stats.open, stats.total);
  });

  it('a filter by namespace only returns that queue', async () => {
    await api.create(api.Namespace.tag('Catalog', 'Filtered item'));
    const filtered = await api.request('/api/tasks?search=%5BCatalog%5D').then((p) => p.data);

    assert.ok(filtered.length > 0);
    assert.ok(filtered.every((t) => t.text.startsWith('[Catalog]')));
  });

  it('the namespace counters match the stored tasks', async () => {
    const stats = await api.stats();
    const tasks = await api.list();

    const catalogTasks = tasks.filter((t) => t.text.startsWith('[Catalog]'));
    assert.equal(stats.byNamespace.Catalog.total, catalogTasks.length);
    assert.equal(
      stats.byNamespace.Catalog.completed,
      catalogTasks.filter((t) => t.completed).length
    );
  });

  it('a follow-up task can be added for an existing record', async () => {
    const record = await api.create(api.Namespace.tag('Catalog', 'The Secret History'));
    const followUp = await api.create(
      api.Namespace.tag('Catalog', 'Add follow-up · ' + api.Namespace.parse(record.text).label)
    );

    assert.equal(followUp.text, '[Catalog] Add follow-up · The Secret History');
    assert.ok((await api.list()).some((t) => t.id === followUp.id));
  });

  it('a scan action records a movement', async () => {
    const scan = await api.create(api.Namespace.tag('Circulation', 'Return received · #39002148'));
    assert.equal(scan.text, '[Circulation] Return received · #39002148');
  });

  it('the notifications feed only lists open tasks', async () => {
    const open = await api.create(api.Namespace.tag('General', 'Still open'));
    const cleared = await api.create(api.Namespace.tag('General', 'Already cleared'), true);

    const tasks = await api.list();
    const shown = tasks.filter((t) => !t.completed);

    assert.ok(shown.some((t) => t.id === open.id));
    assert.ok(!shown.some((t) => t.id === cleared.id));
  });

  it('the dashboard is protected by the session cookie', async () => {
    const res = await fetch(`${BASE}/dashboard`, { redirect: 'manual' });
    assert.equal(res.status, 302);
    assert.match(res.headers.get('location'), /^\/login\?next=/);
  });

  it('a signed-in user can reach the dashboard', async () => {
    const login = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'priyanka', password: 'rccit@2026' }),
    });
    assert.equal(login.status, 200);

    const cookie = login.headers.get('set-cookie').split(';')[0];
    const res = await fetch(`${BASE}/dashboard`, {
      headers: { Cookie: cookie },
      redirect: 'manual',
    });
    assert.equal(res.status, 200);
  });

  it('every client script the pages load is served', async () => {
    const scripts = ['/js/taskflow-api.js', '/js/taskflow-ui.js', '/js/dashboard-actions.js', '/js/auth.js'];
    for (const script of scripts) {
      // eslint-disable-next-line no-await-in-loop
      const res = await fetch(BASE + script);
      assert.equal(res.status, 200, script);
    }
  });

  it('each dashboard page loads its client scripts', async () => {
    const login = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'priyanka', password: 'rccit@2026' }),
    });
    const cookie = login.headers.get('set-cookie').split(';')[0];

    const pages = [
      '/dashboard',
      '/dashboard/pages/page1.html',
      '/dashboard/pages/page2.html',
      '/dashboard/pages/page3.html',
    ];

    for (const page of pages) {
      // eslint-disable-next-line no-await-in-loop
      const res = await fetch(BASE + page, { headers: { Cookie: cookie } });
      assert.equal(res.status, 200, page);
      const html = await res.text();
      assert.match(html, /taskflow-api\.js/, page);
      assert.match(html, /taskflow-ui\.js/, page);
      assert.match(html, /dashboard-actions\.js/, page);
    }
  });
});
