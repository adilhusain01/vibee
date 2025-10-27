const express = require("express");
const connectDB = require("./config/db");
const cors = require("cors");
const helmet = require('helmet');
const compression = require('compression');
const { logger } = require("./middleware/logEvents");
const { validateRequestSize } = require("./middleware/validation");
const rateLimiters = require("./middleware/rateLimiter");
const { getCacheStats } = require("./middleware/cache");
const { getCircuitBreakerStats } = require("./middleware/circuitBreaker");
require("dotenv").config();

const quizRoutes = require("./routes/quizRoutes");
const userRoutes = require("./routes/userRoutes");

const app = express();

// Initialize database connection
connectDB();

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for API
    crossOriginEmbedderPolicy: false
}));

// Import and apply additional security middleware
const { setSecurityHeaders, csrfTokenEndpoint, optionalCSRF } = require('./middleware/csrf');
app.use(setSecurityHeaders);

// Enable compression for responses
app.use(compression());

// CORS configuration
app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? ['https://vibe-games.vercel.app', 'http://localhost:5173', 'https://vibe-gamez.vercel.app']
        : ['http://localhost:5173', 'https://www.vibe-games.vercel.app', 'https://vibe-gamez.vercel.app'],
    credentials: true,
    optionsSuccessStatus: 200
}));

// Request size validation
app.use(validateRequestSize);

// Body parsing middleware
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: false, limit: '15mb' }));

// Logging middleware
app.use(logger);

// Apply general rate limiting to all routes
app.use(rateLimiters.general);

// CSRF token endpoint
app.get('/api/csrf-token', csrfTokenEndpoint);

// Health check endpoint
app.get('/health', (_req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// System stats endpoint (for monitoring)
app.get('/api/stats', (_req, res) => {
    res.json({
        cache: getCacheStats(),
        circuitBreakers: getCircuitBreakerStats(),
        memory: process.memoryUsage(),
        uptime: process.uptime()
    });
});

// API routes with appropriate rate limiting and optional CSRF
app.use("/api/quiz", optionalCSRF, quizRoutes);
app.use("/api/fact-check", optionalCSRF, require("./routes/factCheckingRoutes"));
app.use("/api/users", optionalCSRF, userRoutes);

// 404 handler
app.use('*', (_req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((error, _req, res, _next) => {
    console.error('Unhandled error:', error);

    // Don't leak error details in production
    const isDevelopment = process.env.NODE_ENV !== 'production';

    res.status(error.status || 500).json({
        error: isDevelopment ? error.message : 'Internal server error',
        ...(isDevelopment && { stack: error.stack })
    });
});

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
    console.log(`Received ${signal}, shutting down gracefully...`);

    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
        console.error('Forced shutdown due to timeout');
        process.exit(1);
    }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`📈 Stats endpoint: http://localhost:${PORT}/api/stats`);
    console.log(`🛡️  Security: Helmet, CORS, Rate limiting enabled`);
    console.log(`⚡ Performance: Compression, Caching, Circuit breakers enabled`);
});
