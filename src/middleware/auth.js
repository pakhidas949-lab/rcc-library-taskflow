import * as authService from '../services/authService.js';

/**
 * Session cookie name.
 */
export const SESSION_COOKIE = 'tf_session';

/**
 * Options used when setting the session cookie.
 */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

/**
 * Read the session id from the request cookies.
 * (Written by hand so the project stays dependency-free.)
 */
export const readCookie = (req, name) => {
  const header = req.headers.cookie;
  if (!header) return null;

  const parts = header.split(';');
  for (const part of parts) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    if (part.slice(0, index).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      return part.slice(index + 1).trim();
    }
  }
  return null;
};

/**
 * Attach `req.session` and `req.user` to every request (never rejects).
 */
export const attachSession = (req, res, next) => {
  const sessionId = readCookie(req, SESSION_COOKIE);
  const resolved = sessionId ? authService.resolveSession(sessionId) : null;

  req.sessionId = sessionId;
  req.session = resolved ? resolved.session : null;
  req.user = resolved ? resolved.user : null;
  next();
};

/**
 * Guard for HTML pages: unauthenticated visitors are redirected to the
 * login screen, remembering where they were heading.
 */
export const requireAuthPage = (req, res, next) => {
  if (req.user) return next();

  const target = encodeURIComponent(req.originalUrl || '/dashboard');
  return res.redirect(302, `/login?next=${target}`);
};

/**
 * Guard for JSON APIs: unauthenticated callers get a 401.
 */
export const requireAuthApi = (req, res, next) => {
  if (req.user) return next();
  return res.status(401).json({
    success: false,
    error: { message: 'Authentication required' },
  });
};

/**
 * Guard that only lets signed-in staff reach the landing page's
 * "already signed in" redirect.
 */
export const redirectIfAuthenticated = (req, res, next) => {
  if (req.user) return res.redirect(302, '/dashboard');
  return next();
};

export default { attachSession, requireAuthPage, requireAuthApi, redirectIfAuthenticated };
