/**
 * Custom security headers middleware.
 *
 * helmet() covers the modern header set (CSP, HSTS, X-Frame-Options, ...).
 * This middleware adds the explicit, task-relevant headers on top so the
 * behaviour is visible and auditable in the source.
 */
export const securityHeaders = (req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-XSS-Protection': '0',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    'X-Powered-By': 'TaskFlow',
  });
  next();
};

export default securityHeaders;
