const rateLimit = require('express-rate-limit');

// Rate limiting configurations for different endpoints
const createLimiter = (windowMs, max, message) => {
    return rateLimit({
        windowMs,
        max,
        message: { error: message },
        standardHeaders: true,
        legacyHeaders: false,
        // Skip successful requests to only count failed attempts
        skipSuccessfulRequests: false,
        // Skip failed requests (errors, 4xx responses)
        skipFailedRequests: false,
    });
};

// Different rate limits for different operations
const rateLimiters = {
    // Quiz/FactCheck creation - most expensive operations
    creation: createLimiter(
        15 * 60 * 1000, // 15 minutes
        10, // 10 creations per 15 minutes per IP
        'Too many quiz/fact-check creation attempts. Please try again in 15 minutes.'
    ),

    // API calls that hit external services
    externalAPI: createLimiter(
        5 * 60 * 1000, // 5 minutes
        20, // 20 external API calls per 5 minutes per IP
        'Too many external API requests. Please try again in 5 minutes.'
    ),

    // General API access
    general: createLimiter(
        1 * 60 * 1000, // 1 minute
        100, // 100 requests per minute per IP
        'Too many requests. Please try again in 1 minute.'
    ),

    // Authentication related endpoints
    auth: createLimiter(
        15 * 60 * 1000, // 15 minutes
        5, // 5 attempts per 15 minutes per IP
        'Too many authentication attempts. Please try again in 15 minutes.'
    ),

    // File upload endpoints
    upload: createLimiter(
        10 * 60 * 1000, // 10 minutes
        5, // 5 uploads per 10 minutes per IP
        'Too many file uploads. Please try again in 10 minutes.'
    )
};

module.exports = rateLimiters;