import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Runs the Postman collection with Newman against a freshly started server.
 *
 *   npm run test:postman
 *
 * The script boots the API on a free port, waits for the health check to
 * go green, executes the collection and shuts the server down again.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..');

const PORT = process.env.PORT || 5055;
const BASE_URL = `http://localhost:${PORT}`;
const COLLECTION = path.join(__dirname, 'TaskFlow.postman_collection.json');
const ENVIRONMENT = path.join(__dirname, 'TaskFlow.postman_environment.json');

const waitForServer = async (timeoutMs = 20_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) return true;
    } catch {
      /* server not up yet */
    }
    await sleep(250);
  }
  return false;
};

const run = (cmd, args, opts = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: projectRoot, ...opts });
    child.stdout?.on('data', (d) => process.stdout.write(d));
    child.stderr?.on('data', (d) => process.stderr.write(d));
    child.on('error', reject);
    child.on('close', (code) => resolve(code));
  });

const NEWMAN_BIN = path.join(projectRoot, 'node_modules', 'newman', 'bin', 'newman.js');

const server = spawn('node', ['server.js'], {
  cwd: projectRoot,
  env: { ...process.env, PORT: String(PORT), NODE_ENV: 'development', RATE_LIMIT_MAX: '10000' },
});

let exitCode = 1;
try {
  const ready = await waitForServer();
  if (!ready) throw new Error('Server did not become ready in time');

  const args = [
    NEWMAN_BIN,
    'run',
    COLLECTION,
    '-e',
    ENVIRONMENT,
    '--env-var',
    `baseUrl=${BASE_URL}`,
    '--reporters',
    'cli',
  ];
  exitCode = await run(process.execPath, args);
} catch (error) {
  console.error('\n[TaskFlow] Postman run failed:', error.message);
  exitCode = 1;
} finally {
  server.kill();
}

process.exit(exitCode);
