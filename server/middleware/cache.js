// Simple in-memory cache with TTL (Time To Live)
// For production, use Redis for distributed caching

class SimpleCache {
    constructor() {
        this.cache = new Map();
        this.timers = new Map();
    }

    set(key, value, ttlSeconds = 300) { // Default 5 minutes TTL
        // Clear existing timer if key exists
        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
        }

        // Set the value
        this.cache.set(key, value);

        // Set expiration timer
        const timer = setTimeout(() => {
            this.delete(key);
        }, ttlSeconds * 1000);

        this.timers.set(key, timer);
    }

    get(key) {
        return this.cache.get(key);
    }

    has(key) {
        return this.cache.has(key);
    }

    delete(key) {
        // Clear timer
        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
            this.timers.delete(key);
        }

        // Delete from cache
        return this.cache.delete(key);
    }

    clear() {
        // Clear all timers
        for (const timer of this.timers.values()) {
            clearTimeout(timer);
        }
        this.timers.clear();
        this.cache.clear();
    }

    size() {
        return this.cache.size;
    }

    // Get cache statistics
    stats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
}

// Create cache instances for different data types
const quizCache = new SimpleCache();
const factCheckCache = new SimpleCache();
const userCache = new SimpleCache();
const leaderboardCache = new SimpleCache();

// Cache middleware for quiz data
const cacheQuiz = (ttlSeconds = 300) => {
    return (req, res, next) => {
        const { quizId } = req.params;
        const cacheKey = `quiz:${quizId}`;

        if (quizCache.has(cacheKey)) {
            console.log(`Cache HIT for quiz: ${quizId}`);
            return res.json(quizCache.get(cacheKey));
        }

        console.log(`Cache MISS for quiz: ${quizId}`);

        // Store original res.json
        const originalJson = res.json.bind(res);

        // Override res.json to cache the response
        res.json = function(data) {
            if (res.statusCode === 200 && data) {
                quizCache.set(cacheKey, data, ttlSeconds);
                console.log(`Cached quiz: ${quizId}`);
            }
            return originalJson(data);
        };

        next();
    };
};

// Cache middleware for fact check data
const cacheFactCheck = (ttlSeconds = 300) => {
    return (req, res, next) => {
        const { factCheckId, id } = req.params;
        const checkId = factCheckId || id;
        const cacheKey = `factcheck:${checkId}`;

        if (factCheckCache.has(cacheKey)) {
            console.log(`Cache HIT for fact check: ${checkId}`);
            return res.json(factCheckCache.get(cacheKey));
        }

        console.log(`Cache MISS for fact check: ${checkId}`);

        const originalJson = res.json.bind(res);
        res.json = function(data) {
            if (res.statusCode === 200 && data) {
                factCheckCache.set(cacheKey, data, ttlSeconds);
                console.log(`Cached fact check: ${checkId}`);
            }
            return originalJson(data);
        };

        next();
    };
};

// Cache middleware for leaderboard data
const cacheLeaderboard = (ttlSeconds = 60) => { // Shorter TTL for dynamic data
    return (req, res, next) => {
        const { quizId, id, factCheckId } = req.params;
        const gameId = quizId || id || factCheckId;
        const cacheKey = `leaderboard:${gameId}`;

        if (leaderboardCache.has(cacheKey)) {
            console.log(`Cache HIT for leaderboard: ${gameId}`);
            return res.json(leaderboardCache.get(cacheKey));
        }

        console.log(`Cache MISS for leaderboard: ${gameId}`);

        const originalJson = res.json.bind(res);
        res.json = function(data) {
            if (res.statusCode === 200 && data) {
                leaderboardCache.set(cacheKey, data, ttlSeconds);
                console.log(`Cached leaderboard: ${gameId}`);
            }
            return originalJson(data);
        };

        next();
    };
};

// Cache middleware for user data
const cacheUser = (ttlSeconds = 600) => { // 10 minutes for user data
    return (req, res, next) => {
        const { walletAddress } = req.body || req.params;
        if (!walletAddress) return next();

        const cacheKey = `user:${walletAddress}`;

        if (userCache.has(cacheKey)) {
            req.cachedUser = userCache.get(cacheKey);
            console.log(`Cache HIT for user: ${walletAddress}`);
        }

        next();
    };
};

// Function to invalidate cache when data changes
const invalidateCache = {
    quiz: (quizId) => {
        quizCache.delete(`quiz:${quizId}`);
        leaderboardCache.delete(`leaderboard:${quizId}`);
        console.log(`Invalidated cache for quiz: ${quizId}`);
    },

    factCheck: (factCheckId) => {
        factCheckCache.delete(`factcheck:${factCheckId}`);
        leaderboardCache.delete(`leaderboard:${factCheckId}`);
        console.log(`Invalidated cache for fact check: ${factCheckId}`);
    },

    user: (walletAddress) => {
        userCache.delete(`user:${walletAddress}`);
        console.log(`Invalidated cache for user: ${walletAddress}`);
    },

    leaderboard: (gameId) => {
        leaderboardCache.delete(`leaderboard:${gameId}`);
        console.log(`Invalidated cache for leaderboard: ${gameId}`);
    },

    clearAll: () => {
        quizCache.clear();
        factCheckCache.clear();
        userCache.clear();
        leaderboardCache.clear();
        console.log('Cleared all caches');
    }
};

// Cache statistics endpoint data
const getCacheStats = () => {
    return {
        quiz: quizCache.stats(),
        factCheck: factCheckCache.stats(),
        user: userCache.stats(),
        leaderboard: leaderboardCache.stats(),
        total: quizCache.size() + factCheckCache.size() + userCache.size() + leaderboardCache.size()
    };
};

module.exports = {
    cacheQuiz,
    cacheFactCheck,
    cacheLeaderboard,
    cacheUser,
    invalidateCache,
    getCacheStats
};