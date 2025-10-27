const { generateToken } = require('../utils/secureId');

// Simple CSRF protection middleware
// In production, consider using a more robust solution like csurf

const csrfTokens = new Map();

// Clean up old tokens periodically
setInterval(() => {
  const now = Date.now();
  const maxAge = 60 * 60 * 1000; // 1 hour

  for (const [token, timestamp] of csrfTokens.entries()) {
    if (now - timestamp > maxAge) {
      csrfTokens.delete(token);
    }
  }
}, 5 * 60 * 1000); // Clean every 5 minutes

/**
 * Generate a CSRF token and store it
 * @returns {string} - CSRF token
 */
const generateCSRFToken = () => {
  const token = generateToken();
  csrfTokens.set(token, Date.now());
  return token;
};

/**
 * Validate a CSRF token
 * @param {string} token - Token to validate
 * @returns {boolean} - True if valid
 */
const validateCSRFToken = (token) => {
  if (!token || typeof token !== 'string') {
    return false;
  }

  const timestamp = csrfTokens.get(token);
  if (!timestamp) {
    return false;
  }

  // Check if token is not too old (1 hour)
  const maxAge = 60 * 60 * 1000;
  const isValid = Date.now() - timestamp < maxAge;

  if (isValid) {
    // Remove token after use (single-use)
    csrfTokens.delete(token);
  }

  return isValid;
};

/**
 * Middleware to generate CSRF token endpoint
 */
const csrfTokenEndpoint = (req, res) => {
  const token = generateCSRFToken();
  res.json({ csrfToken: token });
};

/**
 * Middleware to validate CSRF token on state-changing requests
 */
const validateCSRF = (req, res, next) => {
  // Skip CSRF for GET requests (read-only)
  if (req.method === 'GET') {
    return next();
  }

  // Skip CSRF in development if explicitly disabled
  if (process.env.NODE_ENV === 'development' && process.env.DISABLE_CSRF === 'true') {
    return next();
  }

  const token = req.headers['x-csrf-token'] || req.body.csrfToken;

  if (!validateCSRFToken(token)) {
    return res.status(403).json({
      error: 'CSRF token validation failed. Please refresh and try again.'
    });
  }

  next();
};

/**
 * Optional CSRF validation (logs but doesn't block)
 */
const optionalCSRF = (req, res, next) => {
  // Skip for GET requests
  if (req.method === 'GET') {
    return next();
  }

  const token = req.headers['x-csrf-token'] || req.body.csrfToken;

  if (!validateCSRFToken(token)) {
    console.warn(`CSRF validation failed for ${req.method} ${req.path} from ${req.ip}`);
  }

  next();
};

/**
 * Set security headers
 */
const setSecurityHeaders = (req, res, next) => {
  // Set SameSite cookie attributes for session security
  res.setHeader('Set-Cookie', [
    'SameSite=Strict',
    'Secure',
    'HttpOnly'
  ]);

  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  next();
};

module.exports = {
  generateCSRFToken,
  validateCSRFToken,
  csrfTokenEndpoint,
  validateCSRF,
  optionalCSRF,
  setSecurityHeaders
};