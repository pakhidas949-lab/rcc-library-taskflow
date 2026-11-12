import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { login, logout, session } from '../controllers/authController.js';

const router = Router();

/**
 * Brute-force protection for the login endpoint.
 * The auth service also locks an account after 5 failed attempts.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    error: { message: 'Too many sign-in attempts. Please try again later.' },
  },
});

router.post('/login', loginLimiter, login);
router.post('/logout', logout);
router.get('/session', session);

export default router;
