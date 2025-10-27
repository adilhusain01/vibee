// Circuit breaker pattern to handle external API failures gracefully

class CircuitBreaker {
    constructor(options = {}) {
        this.name = options.name || 'Default';
        this.failureThreshold = options.failureThreshold || 5; // Number of failures before opening
        this.timeout = options.timeout || 60000; // 1 minute timeout when open
        this.monitoringPeriod = options.monitoringPeriod || 10000; // 10 seconds monitoring window

        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
        this.failureCount = 0;
        this.lastFailureTime = null;
        this.nextAttemptTime = null;

        // Statistics
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            timeouts: 0,
            circuitOpened: 0
        };
    }

    async execute(fn) {
        this.stats.totalRequests++;

        if (this.state === 'OPEN') {
            if (Date.now() < this.nextAttemptTime) {
                throw new Error(`Circuit breaker is OPEN for ${this.name}. Try again later.`);
            } else {
                // Try to transition to HALF_OPEN
                this.state = 'HALF_OPEN';
                console.log(`Circuit breaker ${this.name} transitioning to HALF_OPEN`);
            }
        }

        try {
            const result = await this.callWithTimeout(fn);
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    async callWithTimeout(fn) {
        return new Promise(async (resolve, reject) => {
            const timer = setTimeout(() => {
                this.stats.timeouts++;
                reject(new Error(`Request timeout for ${this.name}`));
            }, this.timeout);

            try {
                const result = await fn();
                clearTimeout(timer);
                resolve(result);
            } catch (error) {
                clearTimeout(timer);
                reject(error);
            }
        });
    }

    onSuccess() {
        this.stats.successfulRequests++;
        this.failureCount = 0;

        if (this.state === 'HALF_OPEN') {
            this.state = 'CLOSED';
            console.log(`Circuit breaker ${this.name} closed after successful request`);
        }
    }

    onFailure() {
        this.stats.failedRequests++;
        this.failureCount++;
        this.lastFailureTime = Date.now();

        if (this.failureCount >= this.failureThreshold) {
            this.state = 'OPEN';
            this.nextAttemptTime = Date.now() + this.timeout;
            this.stats.circuitOpened++;
            console.error(`Circuit breaker ${this.name} opened after ${this.failureCount} failures`);
        }
    }

    getState() {
        return {
            name: this.name,
            state: this.state,
            failureCount: this.failureCount,
            stats: this.stats
        };
    }

    reset() {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.lastFailureTime = null;
        this.nextAttemptTime = null;
        console.log(`Circuit breaker ${this.name} manually reset`);
    }
}

// Create circuit breakers for different external services
const circuitBreakers = {
    gemini: new CircuitBreaker({
        name: 'Gemini AI',
        failureThreshold: 3,
        timeout: 30000, // 30 seconds
        monitoringPeriod: 60000
    }),

    youtube: new CircuitBreaker({
        name: 'YouTube API',
        failureThreshold: 5,
        timeout: 15000, // 15 seconds
        monitoringPeriod: 30000
    }),

    firecrawl: new CircuitBreaker({
        name: 'Firecrawl API',
        failureThreshold: 3,
        timeout: 45000, // 45 seconds
        monitoringPeriod: 60000
    }),

    supadata: new CircuitBreaker({
        name: 'Supadata API',
        failureThreshold: 3,
        timeout: 20000, // 20 seconds
        monitoringPeriod: 30000
    })
};

// Wrapper functions for external API calls
const withCircuitBreaker = {
    gemini: async (fn) => {
        try {
            return await circuitBreakers.gemini.execute(fn);
        } catch (error) {
            console.error('Gemini API error:', error.message);
            // Fallback: Return empty array or throw descriptive error
            throw new Error('AI service temporarily unavailable. Please try again later.');
        }
    },

    youtube: async (fn) => {
        try {
            return await circuitBreakers.youtube.execute(fn);
        } catch (error) {
            console.error('YouTube API error:', error.message);
            throw new Error('YouTube service temporarily unavailable. Please try again later.');
        }
    },

    firecrawl: async (fn) => {
        try {
            return await circuitBreakers.firecrawl.execute(fn);
        } catch (error) {
            console.error('Firecrawl API error:', error.message);
            throw new Error('Web scraping service temporarily unavailable. Please try again later.');
        }
    },

    supadata: async (fn) => {
        try {
            return await circuitBreakers.supadata.execute(fn);
        } catch (error) {
            console.error('Supadata API error:', error.message);
            throw new Error('Transcript service temporarily unavailable. Please try again later.');
        }
    }
};

// Get all circuit breaker states
const getCircuitBreakerStats = () => {
    return Object.keys(circuitBreakers).map(key =>
        circuitBreakers[key].getState()
    );
};

// Reset all circuit breakers
const resetAllCircuitBreakers = () => {
    Object.values(circuitBreakers).forEach(cb => cb.reset());
    console.log('All circuit breakers reset');
};

module.exports = {
    circuitBreakers,
    withCircuitBreaker,
    getCircuitBreakerStats,
    resetAllCircuitBreakers
};