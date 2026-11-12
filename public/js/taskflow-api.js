/**
 * TaskFlow API client
 * -------------------
 * A tiny, dependency-free wrapper around the TaskFlow REST API.
 *
 * The API speaks the envelope `{ success, data }` (and `{ success, count, data }`
 * for collections), so every helper below resolves with the `data` payload and
 * throws a normalised Error for anything that is not a 2xx.
 *
 * Every page of the Athenaeum ILS is served by the same Express process that
 * hosts the API, so requests are same-origin - no CORS preflight required.
 */
(function (global) {
  'use strict';

  const BASE_URL = '/api/tasks';

  /**
   * Core request helper.
   */
  async function request(path, options) {
    const opts = Object.assign({ headers: {} }, options || {});
    opts.headers = Object.assign(
      { Accept: 'application/json' },
      opts.body ? { 'Content-Type': 'application/json' } : {},
      opts.headers
    );

    let response;
    try {
      response = await fetch(path, opts);
    } catch (networkError) {
      const error = new Error('Cannot reach the TaskFlow API - is the server running?');
      error.status = 0;
      error.isNetworkError = true;
      throw error;
    }

    // 204 No Content - no body to parse.
    if (response.status === 204) return null;

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const error = new Error(
        (payload && payload.error && payload.error.message) ||
          'Request failed with status ' + response.status
      );
      error.status = response.status;
      error.details = (payload && payload.error && payload.error.details) || [];
      error.requestId = payload && payload.requestId;
      throw error;
    }

    return payload;
  }

  /**
   * Namespace helpers.
   *
   * Tasks are shared by every page, so each one is prefixed with a
   * `[Namespace]` tag. That keeps the flat task list separable per dashboard
   * and lets us filter server-side with the `search` query parameter.
   */
  const Namespace = {
    tag(namespace, label) {
      return '[' + namespace + '] ' + label;
    },
    parse(text) {
      const match = /^\[([^\]]+)\]\s*([\s\S]*)$/.exec(text || '');
      if (!match) return { namespace: null, label: text || '' };
      return { namespace: match[1], label: match[2] };
    },
  };

  const TaskFlowAPI = {
    Namespace,

    /** GET /api/tasks - every task, newest first. */
    async list() {
      const payload = await request(BASE_URL);
      return (payload && payload.data) || [];
    },

    /** GET /api/tasks?search=... - filtered list. */
    async search(term) {
      const payload = await request(BASE_URL + '?search=' + encodeURIComponent(term));
      return (payload && payload.data) || [];
    },

    /** GET /api/tasks/:id */
    async get(id) {
      const payload = await request(BASE_URL + '/' + encodeURIComponent(id));
      return payload && payload.data;
    },

    /** POST /api/tasks */
    async create(text, completed) {
      const body = { text: text };
      if (typeof completed === 'boolean') body.completed = completed;
      const payload = await request(BASE_URL, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return payload && payload.data;
    },

    /** PUT /api/tasks/:id - partial update. */
    async update(id, patch) {
      const payload = await request(BASE_URL + '/' + encodeURIComponent(id), {
        method: 'PUT',
        body: JSON.stringify(patch || {}),
      });
      return payload && payload.data;
    },

    /** DELETE /api/tasks/:id */
    async remove(id) {
      await request(BASE_URL + '/' + encodeURIComponent(id), { method: 'DELETE' });
      return true;
    },

    /** Flip a task between completed and pending. */
    async toggle(task) {
      return this.update(task.id, { completed: !task.completed });
    },

    /** GET /api/stats - aggregate counters for the dashboard KPIs. */
    async stats() {
      const payload = await request('/api/stats');
      return (payload && payload.data) || {};
    },

    /** GET /api/health - service liveness. */
    async health() {
      const payload = await request('/api/health');
      return payload && payload.data;
    },
  };

  global.TaskFlowAPI = TaskFlowAPI;
})(window);
