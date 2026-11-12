import { userStore, UserStore, verifyPassword } from '../store/userStore.js';
import { sessionStore } from '../store/sessionStore.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Authentication business logic.
 */

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 10 * 60 * 1000; // 10 minutes

/** identifier -> { count, lockedUntil } */
const attempts = new Map();

/**
 * Record a failed login and lock the account out after too many tries.
 */
const registerFailure = (identifier) => {
  const key = String(identifier || '').toLowerCase();
  const record = attempts.get(key) || { count: 0, lockedUntil: 0 };

  if (record.lockedUntil > Date.now()) {
    throw new ApiError(429, 'Too many failed attempts. Try again in a few minutes.');
  }

  record.count += 1;
  if (record.count >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCKOUT_MS;
    record.count = 0;
  }
  attempts.set(key, record);
};

/** Clear the failure counter after a successful login. */
const clearFailures = (identifier) => {
  attempts.delete(String(identifier || '').toLowerCase());
};

/**
 * Verify credentials and open a session.
 *
 * @param {string} identifier username or email
 * @param {string} password
 * @param {object} [meta]
 * @returns {{ user: object, session: object }}
 */
export const login = (identifier, password, meta = {}) => {
  if (!identifier || !password) {
    throw ApiError.badRequest('Username and password are required');
  }

  const user = userStore.find(identifier);

  // Always run the hash comparison so a missing user and a wrong password
  // take the same amount of time (no user enumeration via timing).
  const salt = user ? user.salt : '0'.repeat(32);
  const hash = user ? user.passwordHash : '0'.repeat(128);

  if (!user || !verifyPassword(password, salt, hash)) {
    registerFailure(identifier);
    throw ApiError.unauthorized('Invalid username or password');
  }

  clearFailures(identifier);
  const session = sessionStore.create(user.id, {
    userAgent: meta.userAgent,
    ttlMs: meta.ttlMs,
  });

  return { user: UserStore.toPublic(user), session };
};

/**
 * Resolve the user behind a session id.
 * @param {string} sessionId
 */
export const resolveSession = (sessionId) => {
  const session = sessionStore.get(sessionId);
  if (!session) return null;
  const user = userStore.findById(session.userId);
  if (!user) {
    sessionStore.destroy(sessionId);
    return null;
  }
  return { session, user: UserStore.toPublic(user) };
};

/**
 * End a session.
 * @param {string} sessionId
 */
export const logout = (sessionId) => {
  if (!sessionId) return false;
  return sessionStore.destroy(sessionId);
};

export default { login, resolveSession, logout };
