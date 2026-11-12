import 'dotenv/config';

/**
 * Centralised, validated environment configuration.
 * Everything the app needs is resolved once, at import time.
 */

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const toBool = (value, fallback = false) => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: toInt(process.env.PORT, 5000),
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  RATE_LIMIT_WINDOW_MS: toInt(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  RATE_LIMIT_MAX: toInt(process.env.RATE_LIMIT_MAX, 100),
  WRITE_RATE_LIMIT_MAX: toInt(process.env.WRITE_RATE_LIMIT_MAX, 120),
  LOG_FORMAT: process.env.LOG_FORMAT || 'dev',
  BODY_LIMIT: process.env.BODY_LIMIT || '100kb',
  SEED_DATA: toBool(process.env.SEED_DATA, false),
  SESSION_TTL_MS: toInt(process.env.SESSION_TTL_MS, 8 * 60 * 60 * 1000),
  MAX_UPLOAD_MB: toInt(process.env.MAX_UPLOAD_MB, 200),
};

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

export default env;
