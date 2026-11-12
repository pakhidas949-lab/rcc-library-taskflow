import * as authService from '../services/authService.js';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from '../middleware/auth.js';

/**
 * HTTP layer for authentication.
 */

/**
 * POST /api/auth/login
 * Body: { username | email, password }
 */
export const login = (req, res, next) => {
  try {
    const { username, email, password } = req.body || {};
    const identifier = username || email;

    if (!identifier || !password) {
      throw ApiError.badRequest('Username and password are required');
    }

    const { user, session } = authService.login(identifier, password, {
      userAgent: req.headers['user-agent'],
      ttlMs: env.SESSION_TTL_MS,
    });

    res.cookie(SESSION_COOKIE, session.id, {
      ...SESSION_COOKIE_OPTIONS,
      maxAge: session.expiresAt - Date.now(),
    });

    res.status(200).json({
      success: true,
      message: `Welcome back, ${user.name.split(' ')[0]}`,
      data: { user, expiresAt: new Date(session.expiresAt).toISOString() },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/logout
 */
export const logout = (req, res, next) => {
  try {
    if (req.sessionId) authService.logout(req.sessionId);
    res.clearCookie(SESSION_COOKIE, { ...SESSION_COOKIE_OPTIONS });
    res.status(200).json({ success: true, message: 'Signed out' });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/session - who am I?
 */
export const session = (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(200).json({
        success: true,
        data: { authenticated: false, user: null },
      });
    }
    return res.status(200).json({
      success: true,
      data: {
        authenticated: true,
        user: req.user,
        expiresAt: req.session ? new Date(req.session.expiresAt).toISOString() : null,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export default { login, logout, session };
