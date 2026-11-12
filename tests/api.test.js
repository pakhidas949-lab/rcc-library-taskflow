import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import { createApp } from '../src/app.js';
import { taskStore } from '../src/store/taskStore.js';

/**
 * Automated endpoint validation for the TaskFlow API.
 *
 * Run with:  npm test
 *
 * The app is mounted in-memory (no TCP port) and the rate limiters are
 * disabled so that the suite is not throttled by its own traffic.
 */
const app = createApp({ rateLimit: false, logging: false });

const BASE = '/api/tasks';

/**
 * Create a supertest agent that is already signed in.
 * The agent keeps the session cookie between requests.
 */
const loginAgent = async (username = 'priyanka', password = 'rccit@2026') => {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username, password });
  return agent;
};

beforeEach(() => {
  taskStore.clear();
});

describe('GET /api/health', () => {
  it('returns 200 with service status', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.service, 'taskflow-api');
    assert.ok(res.body.timestamp);
  });
});

describe('POST /api/tasks - Task Creation', () => {
  it('creates a task and returns 201 with the new task', async () => {
    const res = await request(app).post(BASE).send({ text: 'Buy groceries' });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.message, 'Task created');
    assert.equal(res.body.data.text, 'Buy groceries');
    assert.equal(res.body.data.completed, false);
    assert.equal(typeof res.body.data.id, 'number');
    assert.ok(res.body.data.createdAt);
    assert.ok(res.body.data.updatedAt);
  });

  it('sets the Location header on creation', async () => {
    const res = await request(app).post(BASE).send({ text: 'Check location header' });
    assert.equal(res.status, 201);
    assert.match(res.headers.location, /^\/api\/tasks\/\d+$/);
  });

  it('accepts an optional completed flag', async () => {
    const res = await request(app).post(BASE).send({ text: 'Already done', completed: true });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.completed, true);
  });

  it('trims surrounding whitespace from the text', async () => {
    const res = await request(app).post(BASE).send({ text: '   Padded task   ' });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.text, 'Padded task');
  });

  it('returns 400 when text is missing', async () => {
    const res = await request(app).post(BASE).send({});
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.message, 'Validation failed');
    assert.ok(Array.isArray(res.body.error.details));
  });

  it('returns 400 when text is only whitespace', async () => {
    const res = await request(app).post(BASE).send({ text: '     ' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.message, 'Validation failed');
  });

  it('returns 400 when text is not a string', async () => {
    const res = await request(app).post(BASE).send({ text: 12345 });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.message, 'Validation failed');
  });

  it('returns 400 when text exceeds 255 characters', async () => {
    const res = await request(app).post(BASE).send({ text: 'a'.repeat(256) });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.message, 'Validation failed');
  });

  it('accepts text of exactly 255 characters', async () => {
    const res = await request(app).post(BASE).send({ text: 'a'.repeat(255) });
    assert.equal(res.status, 201);
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await request(app)
      .post(BASE)
      .set('Content-Type', 'application/json')
      .send('{"text": "unterminated');
    assert.equal(res.status, 400);
    assert.equal(res.body.error.message, 'Malformed JSON body');
  });

  it('strips HTML tags to prevent stored XSS', async () => {
    const res = await request(app)
      .post(BASE)
      .send({ text: '<script>alert("xss")</script>Buy milk' });
    assert.equal(res.status, 201);
    assert.ok(!res.body.data.text.includes('<script>'));
    assert.equal(res.body.data.text, 'alert("xss")Buy milk');
  });

  it('returns 400 when completed is not a boolean', async () => {
    const res = await request(app).post(BASE).send({ text: 'Bad flag', completed: 'yes' });
    assert.equal(res.status, 400);
  });
});

describe('GET /api/tasks - Task Retrieval', () => {
  it('returns 200 with an empty array when no tasks exist', async () => {
    const res = await request(app).get(BASE);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.count, 0);
    assert.deepEqual(res.body.data, []);
  });

  it('returns 200 with all tasks', async () => {
    await request(app).post(BASE).send({ text: 'Task one' });
    await request(app).post(BASE).send({ text: 'Task two' });

    const res = await request(app).get(BASE);
    assert.equal(res.status, 200);
    assert.equal(res.body.count, 2);
    assert.equal(res.body.data.length, 2);
    assert.ok(Array.isArray(res.body.data));
  });

  it('returns tasks newest first', async () => {
    await request(app).post(BASE).send({ text: 'Older' });
    await request(app).post(BASE).send({ text: 'Newer' });

    const res = await request(app).get(BASE);
    assert.equal(res.body.data[0].text, 'Newer');
  });

  it('filters by completed=true', async () => {
    await request(app).post(BASE).send({ text: 'Done', completed: true });
    await request(app).post(BASE).send({ text: 'Pending' });

    const res = await request(app).get(`${BASE}?completed=true`);
    assert.equal(res.status, 200);
    assert.equal(res.body.count, 1);
    assert.equal(res.body.data[0].text, 'Done');
  });

  it('filters by completed=false', async () => {
    await request(app).post(BASE).send({ text: 'Done', completed: true });
    await request(app).post(BASE).send({ text: 'Pending' });

    const res = await request(app).get(`${BASE}?completed=false`);
    assert.equal(res.body.count, 1);
    assert.equal(res.body.data[0].text, 'Pending');
  });

  it('searches by text', async () => {
    await request(app).post(BASE).send({ text: 'Write documentation' });
    await request(app).post(BASE).send({ text: 'Buy milk' });

    const res = await request(app).get(`${BASE}?search=doc`);
    assert.equal(res.body.count, 1);
    assert.equal(res.body.data[0].text, 'Write documentation');
  });

  it('responds with a JSON content type', async () => {
    const res = await request(app).get(BASE);
    assert.match(res.headers['content-type'], /application\/json/);
  });
});

describe('GET /api/tasks/:id - Single Task Retrieval', () => {
  it('returns 200 and the requested task', async () => {
    const created = await request(app).post(BASE).send({ text: 'Findable' });

    const res = await request(app).get(`${BASE}/${created.body.data.id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.id, created.body.data.id);
    assert.equal(res.body.data.text, 'Findable');
  });

  it('returns 404 for a task that does not exist', async () => {
    const res = await request(app).get(`${BASE}/9999`);
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.message, 'Task not found');
  });

  it('returns 404 for a non-numeric id', async () => {
    const res = await request(app).get(`${BASE}/not-a-number`);
    assert.equal(res.status, 404);
    assert.equal(res.body.error.message, 'Task not found');
  });

  it('returns 404 for a negative id', async () => {
    const res = await request(app).get(`${BASE}/-5`);
    assert.equal(res.status, 404);
  });
});

describe('PUT /api/tasks/:id - Task Update', () => {
  it('updates only the text and leaves completed untouched', async () => {
    const created = await request(app).post(BASE).send({ text: 'Original' });

    const res = await request(app)
      .put(`${BASE}/${created.body.data.id}`)
      .send({ text: 'Updated text' });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.text, 'Updated text');
    assert.equal(res.body.data.completed, false);
  });

  it('updates only completed and leaves text untouched', async () => {
    const created = await request(app).post(BASE).send({ text: 'Keep me' });

    const res = await request(app)
      .put(`${BASE}/${created.body.data.id}`)
      .send({ completed: true });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.text, 'Keep me');
    assert.equal(res.body.data.completed, true);
  });

  it('updates both fields at once', async () => {
    const created = await request(app).post(BASE).send({ text: 'Both' });

    const res = await request(app)
      .put(`${BASE}/${created.body.data.id}`)
      .send({ text: 'Both updated', completed: true });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.text, 'Both updated');
    assert.equal(res.body.data.completed, true);
  });

  it('keeps the id and original createdAt stable', async () => {
    const created = await request(app).post(BASE).send({ text: 'Stable' });

    const res = await request(app)
      .put(`${BASE}/${created.body.data.id}`)
      .send({ text: 'Stable updated' });

    assert.equal(res.body.data.id, created.body.data.id);
    assert.equal(res.body.data.createdAt, created.body.data.createdAt);
    assert.ok(res.body.data.updatedAt);
  });

  it('returns 404 for a task that does not exist', async () => {
    const res = await request(app).put(`${BASE}/9999`).send({ text: 'Ghost' });
    assert.equal(res.status, 404);
    assert.equal(res.body.error.message, 'Task not found');
  });

  it('returns 400 for an empty payload', async () => {
    const created = await request(app).post(BASE).send({ text: 'Something' });
    const res = await request(app).put(`${BASE}/${created.body.data.id}`).send({});
    assert.equal(res.status, 400);
    assert.equal(res.body.error.message, 'Validation failed');
  });

  it('returns 400 when text is an empty string', async () => {
    const created = await request(app).post(BASE).send({ text: 'Something' });
    const res = await request(app).put(`${BASE}/${created.body.data.id}`).send({ text: '' });
    assert.equal(res.status, 400);
  });

  it('supports PATCH as an alias', async () => {
    const created = await request(app).post(BASE).send({ text: 'Patchable' });
    const res = await request(app)
      .patch(`${BASE}/${created.body.data.id}`)
      .send({ completed: true });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.completed, true);
  });
});

describe('DELETE /api/tasks/:id - Task Deletion', () => {
  it('returns 204 with an empty body', async () => {
    const created = await request(app).post(BASE).send({ text: 'Deletable' });

    const res = await request(app).delete(`${BASE}/${created.body.data.id}`);
    assert.equal(res.status, 204);
    assert.equal(res.text, '');
    assert.ok(!res.headers['content-type'] || !res.headers['content-type'].includes('json'));
  });

  it('removes the task from the store', async () => {
    const created = await request(app).post(BASE).send({ text: 'Gone soon' });
    await request(app).delete(`${BASE}/${created.body.data.id}`);

    const res = await request(app).get(`${BASE}/${created.body.data.id}`);
    assert.equal(res.status, 404);
  });

  it('returns 404 for a task that does not exist', async () => {
    const res = await request(app).delete(`${BASE}/9999`);
    assert.equal(res.status, 404);
    assert.equal(res.body.error.message, 'Task not found');
  });

  it('returns 404 when deleting the same task twice', async () => {
    const created = await request(app).post(BASE).send({ text: 'Delete twice' });
    const id = created.body.data.id;

    const first = await request(app).delete(`${BASE}/${id}`);
    const second = await request(app).delete(`${BASE}/${id}`);

    assert.equal(first.status, 204);
    assert.equal(second.status, 404);
  });
});

describe('Versioned routes', () => {
  it('serves the same endpoints under /api/v1/tasks', async () => {
    const created = await request(app).post('/api/v1/tasks').send({ text: 'Versioned' });
    assert.equal(created.status, 201);

    const res = await request(app).get('/api/v1/tasks');
    assert.equal(res.status, 200);
    assert.equal(res.body.count, 1);
  });
});

describe('Error handling', () => {
  it('returns 404 for an unknown route', async () => {
    const res = await request(app).get('/api/does-not-exist');
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
    assert.match(res.body.error.message, /Route not found/);
  });

  it('returns 500 with a JSON body for an unexpected error', async () => {
    const res = await request(app).get('/api/_debug/error');
    assert.equal(res.status, 500);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.message, 'Intentional error triggered by the debug endpoint');
    assert.ok(res.body.requestId);
  });

  it('includes a requestId in every error response', async () => {
    const res = await request(app).get(`${BASE}/9999`);
    assert.ok(res.body.requestId);
    assert.equal(res.body.requestId, res.headers['x-request-id']);
  });
});

describe('Middleware - security headers, CORS and logging', () => {
  it('sets the helmet security headers', async () => {
    const res = await request(app).get(BASE);
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['x-frame-options'], 'DENY');
    assert.match(res.headers['strict-transport-security'], /max-age=31536000/);
    assert.ok(res.headers['content-security-policy']);
  });

  it('sets the CORS headers for cross-origin requests', async () => {
    const res = await request(app).get(BASE).set('Origin', 'http://localhost:5173');
    assert.equal(res.headers['access-control-allow-origin'], '*');
  });

  it('answers CORS preflight requests', async () => {
    const res = await request(app)
      .options(BASE)
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST');

    assert.equal(res.status, 204);
    assert.ok(res.headers['access-control-allow-methods']);
    assert.ok(res.headers['access-control-allow-headers']);
  });

  it('assigns a unique X-Request-Id header', async () => {
    const first = await request(app).get(BASE);
    const second = await request(app).get(BASE);
    assert.ok(first.headers['x-request-id']);
    assert.ok(second.headers['x-request-id']);
    assert.notEqual(first.headers['x-request-id'], second.headers['x-request-id']);
  });

  it('does not leak the Express fingerprint header', async () => {
    const res = await request(app).get(BASE);
    assert.notEqual(res.headers['x-powered-by'], 'Express');
  });
});

describe('Rate limiting', () => {
  it('returns 429 once the limit is exceeded', async () => {
    const limitedApp = createApp({
      rateLimit: true,
      rateLimitMax: 5,
      writeRateLimitMax: 5,
      logging: false,
    });
    let limited = false;

    for (let i = 0; i < 20; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const res = await request(limitedApp).get(BASE);
      if (res.status === 429) {
        limited = true;
        assert.equal(res.body.success, false);
        assert.match(res.body.error.message, /Too many requests/);
        break;
      }
    }

    assert.ok(limited, 'Expected a 429 response after exceeding the rate limit');
  });

  it('does not rate limit when the limiter is disabled', async () => {
    const openApp = createApp({ rateLimit: false, logging: false });
    for (let i = 0; i < 15; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const res = await request(openApp).get(BASE);
      assert.equal(res.status, 200);
    }
  });
});

describe('API documentation', () => {
  it('serves the raw OpenAPI specification', async () => {
    const res = await request(app).get('/api/openapi.yaml');
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /yaml/);
    assert.match(res.text, /openapi: 3\.0\.3/);
    assert.match(res.text, /\/api\/tasks/);
  });

  it('serves the Swagger UI page', async () => {
    const res = await request(app).get('/api/docs');
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /text\/html/);
    assert.match(res.text, /swagger-ui/);
  });
});

describe('GET /api/stats - Dashboard aggregates', () => {
  it('returns zeroed counters when there are no tasks', async () => {
    const res = await request(app).get('/api/stats');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.total, 0);
    assert.equal(res.body.data.completed, 0);
    assert.equal(res.body.data.open, 0);
  });

  it('counts open and completed tasks', async () => {
    await request(app).post(BASE).send({ text: 'Open task' });
    await request(app).post(BASE).send({ text: 'Done task', completed: true });

    const res = await request(app).get('/api/stats');
    assert.equal(res.body.data.total, 2);
    assert.equal(res.body.data.completed, 1);
    assert.equal(res.body.data.open, 1);
  });

  it('groups counters by namespace tag', async () => {
    await request(app).post(BASE).send({ text: '[Catalog] The Secret History' });
    await request(app).post(BASE).send({ text: '[Catalog] Infinite Jest', completed: true });
    await request(app).post(BASE).send({ text: '[Borrowers] Dr. Julian Thorne' });

    const res = await request(app).get('/api/stats');
    const catalog = res.body.data.byNamespace.Catalog;
    assert.equal(catalog.total, 2);
    assert.equal(catalog.completed, 1);
    assert.equal(catalog.open, 1);
    assert.equal(res.body.data.byNamespace.Borrowers.total, 1);
  });
});

describe('Static dashboard frontend', () => {
  it('serves the landing page at the root', async () => {
    const res = await request(app).get('/');
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /text\/html/);
    assert.match(res.text, /The intellectual heart/);
    assert.match(res.text, /RCC IIT Library/);
  });

  it('serves the login page', async () => {
    const res = await request(app).get('/login');
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /text\/html/);
    assert.match(res.text, /Welcome back/);
    assert.match(res.text, /login-form/);
  });

  it('serves the shared client scripts', async () => {
    const api = await request(app).get('/js/taskflow-api.js');
    assert.equal(api.status, 200);
    assert.match(api.headers['content-type'], /javascript/);
    assert.match(api.text, /TaskFlowAPI/);

    const ui = await request(app).get('/js/taskflow-ui.js');
    assert.equal(ui.status, 200);
    assert.match(ui.text, /Live Task Desk/);

    const auth = await request(app).get('/js/auth.js');
    assert.equal(auth.status, 200);
    assert.match(auth.text, /AuthUI/);
  });

  it('injects the client scripts into every dashboard page', async () => {
    const agent = await loginAgent();
    const pages = [
      '/dashboard',
      '/dashboard/pages/page1.html',
      '/dashboard/pages/page2.html',
      '/dashboard/pages/page3.html',
    ];
    for (const page of pages) {
      // eslint-disable-next-line no-await-in-loop
      const res = await agent.get(page);
      assert.equal(res.status, 200, page);
      assert.match(res.text, /taskflow-api\.js/, page);
      assert.match(res.text, /taskflow-ui\.js/, page);
    }
  });

  it('keeps the strict CSP on API responses', async () => {
    const res = await request(app).get(BASE);
    assert.match(res.headers['content-security-policy'], /script-src 'self' https:\/\/unpkg\.com/);
    assert.ok(!res.headers['content-security-policy'].includes("script-src 'self' 'unsafe-inline'"));
  });

  it('applies the relaxed page CSP to HTML responses', async () => {
    const res = await request(app).get('/');
    assert.match(res.headers['content-security-policy'], /cdn\.tailwindcss\.com/);
  });
});

describe('Authentication', () => {
  it('reports an anonymous visitor as signed out', async () => {
    const res = await request(app).get('/api/auth/session');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.authenticated, false);
    assert.equal(res.body.data.user, null);
  });

  it('signs in with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'priyanka', password: 'rccit@2026' });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.user.name, 'Priyanka Das');
    assert.equal(res.body.data.user.role, 'Head Librarian');
    assert.match(res.headers['set-cookie'].join(';'), /HttpOnly/);
    assert.match(res.headers['set-cookie'].join(';'), /SameSite=Lax/);
  });

  it('never leaks the password hash to the client', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'priyanka', password: 'rccit@2026' });
    assert.equal(res.body.data.user.passwordHash, undefined);
    assert.equal(res.body.data.user.salt, undefined);
    assert.equal(res.body.data.user.password, undefined);
  });

  it('rejects a wrong password with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'priyanka', password: 'wrong-password' });
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
    assert.match(res.body.error.message, /Invalid username or password/);
  });

  it('rejects an unknown user with 401 and no hint', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nobody', password: 'whatever' });
    assert.equal(res.status, 401);
    assert.match(res.body.error.message, /Invalid username or password/);
  });

  it('rejects a missing password with 400', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'priyanka' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.message, 'Username and password are required');
  });

  it('accepts the e-mail as the identifier', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'p.das@rccit.edu', password: 'rccit@2026' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.username, 'priyanka');
  });

  it('resolves the session from the cookie', async () => {
    const agent = await loginAgent();
    const res = await agent.get('/api/auth/session');
    assert.equal(res.body.data.authenticated, true);
    assert.equal(res.body.data.user.name, 'Priyanka Das');
  });

  it('signs out and clears the session', async () => {
    const agent = await loginAgent();
    const logout = await agent.post('/api/auth/logout');
    assert.equal(logout.status, 200);

    const res = await agent.get('/api/auth/session');
    assert.equal(res.body.data.authenticated, false);
  });

  it('redirects anonymous visitors from the dashboard to the login page', async () => {
    const res = await request(app).get('/dashboard');
    assert.equal(res.status, 302);
    assert.match(res.headers.location, /^\/login\?next=/);
    assert.match(decodeURIComponent(res.headers.location), /\/dashboard$/);
  });

  it('remembers where the visitor was heading', async () => {
    const res = await request(app).get('/dashboard/pages/page2.html');
    assert.equal(res.status, 302);
    assert.match(
      decodeURIComponent(res.headers.location),
      /next=\/dashboard\/pages\/page2\.html/
    );
  });

  it('lets a signed-in user reach the dashboard', async () => {
    const agent = await loginAgent();
    const res = await agent.get('/dashboard');
    assert.equal(res.status, 200);
    assert.match(res.text, /Catalog &amp; Resource Inventory/);
  });

  it('redirects a signed-in user away from the login page', async () => {
    const agent = await loginAgent();
    const res = await agent.get('/login');
    assert.equal(res.status, 302);
    assert.equal(res.headers.location, '/dashboard');
  });
});

describe('Data integrity', () => {
  it('keeps ids unique and monotonically increasing', async () => {
    const a = await request(app).post(BASE).send({ text: 'First' });
    const b = await request(app).post(BASE).send({ text: 'Second' });

    assert.notEqual(a.body.data.id, b.body.data.id);
    assert.ok(b.body.data.id > a.body.data.id);
  });

  it('does not leak internal store references to the client', async () => {
    const created = await request(app).post(BASE).send({ text: 'Immutable' });
    created.body.data.text = 'Mutated by client';

    const res = await request(app).get(`${BASE}/${created.body.data.id}`);
    assert.equal(res.body.data.text, 'Immutable');
  });
});
