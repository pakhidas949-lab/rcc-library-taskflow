import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COLLECTION = path.resolve(__dirname, '..', 'tests', 'postman', 'TaskFlow.postman_collection.json');

const collection = JSON.parse(fs.readFileSync(COLLECTION, 'utf8'));

const authFolder = {
  name: '0. Authentication',
  item: [
    {
      name: 'Session - Anonymous',
      request: {
        method: 'GET',
        header: [],
        url: {
          raw: '{{baseUrl}}/api/auth/session',
          host: ['{{baseUrl}}'],
          path: ['api', 'auth', 'session'],
        },
        description: 'Before signing in this should report authenticated=false.',
      },
      event: [
        {
          listen: 'test',
          script: {
            type: 'text/javascript',
            exec: [
              "pm.test('Status code is 200', function () {",
              "    pm.response.to.have.status(200);",
              "});",
              "",
              "pm.test('Visitor is not authenticated yet', function () {",
              "    const jsonData = pm.response.json();",
              "    pm.expect(jsonData.data.authenticated).to.be.false;",
              "});",
            ],
          },
        },
      ],
    },
    {
      name: 'Login - Invalid Password (401)',
      request: {
        method: 'POST',
        header: [{ key: 'Content-Type', value: 'application/json' }],
        body: { mode: 'raw', raw: '{\n    "username": "priyanka",\n    "password": "definitely-wrong"\n}' },
        url: {
          raw: '{{baseUrl}}/api/auth/login',
          host: ['{{baseUrl}}'],
          path: ['api', 'auth', 'login'],
        },
      },
      event: [
        {
          listen: 'test',
          script: {
            type: 'text/javascript',
            exec: [
              "pm.test('Status code is 401', function () {",
              "    pm.response.to.have.status(401);",
              "});",
              "",
              "pm.test('Error does not reveal whether the user exists', function () {",
              "    const jsonData = pm.response.json();",
              "    pm.expect(jsonData.error.message).to.eql('Invalid username or password');",
              "});",
            ],
          },
        },
      ],
    },
    {
      name: 'Login - Valid Credentials (200)',
      request: {
        method: 'POST',
        header: [{ key: 'Content-Type', value: 'application/json' }],
        body: {
          mode: 'raw',
          raw: '{\n    "username": "priyanka",\n    "password": "rccit@2026"\n}',
        },
        url: {
          raw: '{{baseUrl}}/api/auth/login',
          host: ['{{baseUrl}}'],
          path: ['api', 'auth', 'login'],
        },
        description: 'Sets the HttpOnly session cookie used by the rest of the collection.',
      },
      event: [
        {
          listen: 'test',
          script: {
            type: 'text/javascript',
            exec: [
              "pm.test('Status code is 200', function () {",
              "    pm.response.to.have.status(200);",
              "});",
              "",
              "pm.test('The librarian is returned', function () {",
              "    const jsonData = pm.response.json();",
              "    pm.expect(jsonData.success).to.be.true;",
              "    pm.expect(jsonData.data.user.name).to.eql('Priyanka Das');",
              "    pm.expect(jsonData.data.user.role).to.eql('Head Librarian');",
              "});",
              "",
              "pm.test('No password material is exposed', function () {",
              "    const jsonData = pm.response.json();",
              "    pm.expect(jsonData.data.user.passwordHash).to.be.undefined;",
              "    pm.expect(jsonData.data.user.salt).to.be.undefined;",
              "});",
              "",
              "pm.test('A session cookie is issued', function () {",
              "    const cookie = pm.response.headers.get('Set-Cookie');",
              "    pm.expect(cookie).to.include('tf_session');",
              "    pm.expect(cookie).to.include('HttpOnly');",
              "});",
            ],
          },
        },
      ],
    },
    {
      name: 'Session - Authenticated',
      request: {
        method: 'GET',
        header: [],
        url: {
          raw: '{{baseUrl}}/api/auth/session',
          host: ['{{baseUrl}}'],
          path: ['api', 'auth', 'session'],
        },
      },
      event: [
        {
          listen: 'test',
          script: {
            type: 'text/javascript',
            exec: [
              "pm.test('Status code is 200', function () {",
              "    pm.response.to.have.status(200);",
              "});",
              "",
              "pm.test('The session is recognised', function () {",
              "    const jsonData = pm.response.json();",
              "    pm.expect(jsonData.data.authenticated).to.be.true;",
              "    pm.expect(jsonData.data.user.username).to.eql('priyanka');",
              "});",
            ],
          },
        },
      ],
    },
    {
      name: 'Dashboard - Protected (302 to login)',
      request: {
        method: 'GET',
        header: [],
        url: {
          raw: '{{baseUrl}}/dashboard',
          host: ['{{baseUrl}}'],
          path: ['dashboard'],
        },
        description: 'The dashboard is behind the login. Signed in it returns 200; signed out it redirects to /login.',
      },
      event: [
        {
          listen: 'test',
          script: {
            type: 'text/javascript',
            exec: [
              "pm.test('The dashboard is reachable for a signed-in staff member', function () {",
              "    pm.expect(pm.response.code).to.be.oneOf([200, 302]);",
              "});",
              "",
              "pm.test('A signed-in request is not redirected to the login page', function () {",
              "    pm.expect(pm.response.code).to.eql(200);",
              "});",
            ],
          },
        },
      ],
    },
    {
      name: 'Logout',
      request: {
        method: 'POST',
        header: [],
        url: {
          raw: '{{baseUrl}}/api/auth/logout',
          host: ['{{baseUrl}}'],
          path: ['api', 'auth', 'logout'],
        },
      },
      event: [
        {
          listen: 'test',
          script: {
            type: 'text/javascript',
            exec: [
              "pm.test('Status code is 200', function () {",
              "    pm.response.to.have.status(200);",
              "});",
              "",
              "pm.test('The session is closed', function () {",
              "    const jsonData = pm.response.json();",
              "    pm.expect(jsonData.success).to.be.true;",
              "});",
            ],
          },
        },
      ],
    },
  ],
};

// Insert the auth folder first so the session exists before the task tests.
collection.item.unshift(authFolder);

fs.writeFileSync(COLLECTION, JSON.stringify(collection, null, 2), 'utf8');
console.log(`Added "${authFolder.name}" with ${authFolder.item.length} requests.`);
