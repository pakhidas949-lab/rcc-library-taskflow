import { randomBytes } from 'node:crypto';

/**
 * Server-side session store.
 *
 * A session id is 32 bytes of CSPRNG output - unguessable and opaque, so it
 * does not even need to be signed. The cookie only carries this id; every
 * other detail lives on the server.
 *
 * Sessions are in-memory (they vanish on restart), matching the in-memory
 * task store. Task 4 swaps this for Redis or a session table.
 */

const DEFAULT_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

class SessionStore {
  constructor() {
    /** @type {Map<string, {id:string,userId:number,createdAt:number,expiresAt:number,userAgent?:string}>} */
    this.sessions = new Map();
  }

  /**
   * Create a session for a user.
   * @param {number} userId
   * @param {object} [meta]
   */
  create(userId, meta = {}) {
    const id = randomBytes(32).toString('hex');
    const now = Date.now();
    const session = {
      id,
      userId,
      createdAt: now,
      expiresAt: now + (meta.ttlMs || DEFAULT_TTL_MS),
      userAgent: meta.userAgent,
    };
    this.sessions.set(id, session);
    return session;
  }

  /**
   * Fetch a live session (expired sessions are treated as missing).
   * @param {string} id
   */
  get(id) {
    if (!id) return undefined;
    const session = this.sessions.get(id);
    if (!session) return undefined;
    if (session.expiresAt < Date.now()) {
      this.sessions.delete(id);
      return undefined;
    }
    return session;
  }

  /** Destroy a session. */
  destroy(id) {
    if (!id) return false;
    return this.sessions.delete(id);
  }

  /** Remove every session belonging to a user (e.g. after a password change). */
  destroyForUser(userId) {
    let removed = 0;
    for (const [id, session] of this.sessions.entries()) {
      if (session.userId === userId) {
        this.sessions.delete(id);
        removed += 1;
      }
    }
    return removed;
  }

  /** Drop expired sessions. */
  prune() {
    const now = Date.now();
    let removed = 0;
    for (const [id, session] of this.sessions.entries()) {
      if (session.expiresAt < now) {
        this.sessions.delete(id);
        removed += 1;
      }
    }
    return removed;
  }

  get size() {
    return this.sessions.size;
  }
}

export const sessionStore = new SessionStore();
export { SessionStore, DEFAULT_TTL_MS };
export default sessionStore;
