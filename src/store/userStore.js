import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * In-memory user directory.
 *
 * Passwords are never stored in plain text: each user gets a random salt and
 * a scrypt hash. Swap this file for a real database in Task 4 and nothing
 * else has to change.
 */

const SCRYPT_KEYLEN = 64;

/**
 * Hash a password with a salt.
 * @param {string} password
 * @param {string} salt hex string
 * @returns {string} hex hash
 */
export const hashPassword = (password, salt) =>
  scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');

/**
 * Constant-time password comparison.
 * @param {string} password
 * @param {string} salt
 * @param {string} expectedHash
 * @returns {boolean}
 */
export const verifyPassword = (password, salt, expectedHash) => {
  const actual = Buffer.from(hashPassword(password, salt), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
};

/**
 * Seed accounts. The password is hashed once at module load.
 */
const SEED_USERS = [
  {
    id: 1,
    username: 'priyanka',
    email: 'p.das@rccit.edu',
    name: 'Priyanka Das',
    role: 'Head Librarian',
    department: 'Central Library Services',
    initials: 'PD',
    password: 'rccit@2026',
  },
  {
    id: 2,
    username: 'rccit.desk',
    email: 'desk@rccit.edu',
    name: 'Circulation Desk',
    role: 'Desk Assistant',
    department: 'Reader Services',
    initials: 'CD',
    password: 'desk@2026',
  },
];

class UserStore {
  constructor() {
    /** @type {Array<object>} */
    this.users = SEED_USERS.map((user) => {
      const salt = randomBytes(16).toString('hex');
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
        department: user.department,
        initials: user.initials,
        salt,
        passwordHash: hashPassword(user.password, salt),
      };
    });
  }

  /** Find a user by username or email (case-insensitive). */
  find(identifier) {
    if (!identifier) return undefined;
    const needle = String(identifier).trim().toLowerCase();
    return this.users.find(
      (user) =>
        user.username.toLowerCase() === needle || user.email.toLowerCase() === needle
    );
  }

  findById(id) {
    return this.users.find((user) => user.id === id);
  }

  /** Strip sensitive fields before sending a user to the client. */
  static toPublic(user) {
    if (!user) return null;
    const { salt, passwordHash, ...safe } = user;
    return safe;
  }
}

export const userStore = new UserStore();
export { UserStore };
export default userStore;
