const multer = require('multer');
const { ethers } = require('ethers');

// File size limits (in bytes)
const FILE_SIZE_LIMITS = {
    PDF: 10 * 1024 * 1024, // 10MB for PDFs
    IMAGE: 5 * 1024 * 1024, // 5MB for images
    VIDEO: 50 * 1024 * 1024, // 50MB for videos (if ever needed)
};

// Content length limits
const CONTENT_LIMITS = {
    PROMPT: 8000, // 8KB for prompts
    URL_CONTENT: 100000, // 100KB for scraped content
    TRANSCRIPT: 200000, // 200KB for video transcripts
};

// Validate request size middleware
const validateRequestSize = (req, res, next) => {
    const contentLength = parseInt(req.get('content-length') || '0');
    const maxSize = 15 * 1024 * 1024; // 15MB max request size

    if (contentLength > maxSize) {
        return res.status(413).json({
            error: `Request too large. Maximum size is ${maxSize / (1024 * 1024)}MB`
        });
    }

    next();
};

// Validate file uploads
const validateFileUpload = (fileType) => {
    return (req, res, next) => {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const file = req.file;
        const maxSize = FILE_SIZE_LIMITS[fileType.toUpperCase()];

        if (file.size > maxSize) {
            return res.status(413).json({
                error: `File too large. Maximum size for ${fileType} is ${maxSize / (1024 * 1024)}MB`
            });
        }

        // Validate file types
        const allowedTypes = {
            PDF: ['application/pdf'],
            IMAGE: ['image/jpeg', 'image/png', 'image/gif'],
            VIDEO: ['video/mp4', 'video/avi', 'video/mov']
        };

        const allowed = allowedTypes[fileType.toUpperCase()];
        if (allowed && !allowed.includes(file.mimetype)) {
            return res.status(400).json({
                error: `Invalid file type. Allowed types: ${allowed.join(', ')}`
            });
        }

        next();
    };
};

// Validate text content length
const validateContentLength = (field, limit) => {
    return (req, res, next) => {
        const content = req.body[field];

        if (!content) {
            return res.status(400).json({ error: `${field} is required` });
        }

        if (typeof content !== 'string') {
            return res.status(400).json({ error: `${field} must be a string` });
        }

        if (content.length > limit) {
            return res.status(413).json({
                error: `${field} too long. Maximum length is ${limit} characters`
            });
        }

        next();
    };
};

// Validate numeric parameters
const validateNumbers = (fields) => {
    return (req, res, next) => {
        for (const field of fields) {
            const value = req.body[field];

            if (value === undefined || value === null) {
                return res.status(400).json({ error: `${field} is required` });
            }

            const num = Number(value);
            if (isNaN(num) || num < 0) {
                return res.status(400).json({ error: `${field} must be a positive number` });
            }

            // Set reasonable limits
            const limits = {
                numParticipants: 1000,
                questionCount: 50,
                factsCount: 50,
                rewardPerScore: 1e30, // Very high limit - essentially unlimited (1 billion tokens)
                totalCost: 1e33, // Very high limit - essentially unlimited (1 trillion tokens)
            };

            if (limits[field] && num > limits[field]) {
                return res.status(400).json({
                    error: `${field} exceeds maximum allowed value of ${limits[field]}`
                });
            }

            req.body[field] = num;
        }
        next();
    };
};

// Validate wallet address format
const validateWalletAddress = (req, res, next) => {
    const { creatorWallet, walletAddress } = req.body;
    const wallet = creatorWallet || walletAddress;

    if (!wallet) {
        return res.status(400).json({ error: 'Wallet address is required' });
    }

    // Basic Ethereum address validation
    const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!ethAddressRegex.test(wallet)) {
        return res.status(400).json({ error: 'Invalid wallet address format' });
    }

    next();
};

// Validate URL format
const validateURL = (req, res, next) => {
    const { websiteUrl, ytVideoUrl } = req.body;
    const url = websiteUrl || ytVideoUrl;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        const urlObj = new URL(url);

        // For YouTube URLs, validate format
        if (ytVideoUrl) {
            const isValidYouTube = urlObj.hostname.includes('youtube.com') ||
                                  urlObj.hostname.includes('youtu.be');
            if (!isValidYouTube) {
                return res.status(400).json({ error: 'Invalid YouTube URL' });
            }
        }

        // Check for suspicious URLs
        const suspiciousPatterns = [
            'localhost',
            '127.0.0.1',
            '0.0.0.0',
            '10.',
            '192.168.',
            '172.16.',
            'file://',
            'ftp://'
        ];

        if (suspiciousPatterns.some(pattern => url.includes(pattern))) {
            return res.status(400).json({ error: 'Invalid or unsafe URL' });
        }

    } catch (error) {
        return res.status(400).json({ error: 'Invalid URL format' });
    }

    next();
};

// Sanitize HTML/XSS content
const sanitizeInput = (fields = []) => {
    return (req, res, next) => {
        try {
            for (const field of fields) {
                if (req.body[field]) {
                    let value = req.body[field];

                    if (typeof value === 'string') {
                        // Remove HTML tags and potential XSS vectors
                        value = value
                            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                            .replace(/<[^>]*>/g, '')
                            .replace(/javascript:/gi, '')
                            .replace(/on\w+\s*=/gi, '')
                            .replace(/&lt;script/gi, '')
                            .replace(/&gt;/gi, '')
                            .trim();

                        // Additional sanitization for specific patterns
                        value = value
                            .replace(/eval\s*\(/gi, '')
                            .replace(/expression\s*\(/gi, '')
                            .replace(/vbscript:/gi, '')
                            .replace(/data:text\/html/gi, '');

                        req.body[field] = value;
                    }
                }
            }
            next();
        } catch (error) {
            console.error('Sanitization error:', error);
            return res.status(400).json({ error: 'Invalid input format' });
        }
    };
};

// Validate quiz/fact check IDs are alphanumeric
const validateGameId = (req, res, next) => {
    const { quizId, factCheckId } = req.params;
    const gameId = quizId || factCheckId;

    if (gameId && !/^[a-zA-Z0-9]{5,15}$/.test(gameId)) {
        return res.status(400).json({ error: 'Invalid game ID format' });
    }

    next();
};

// Validate and sanitize text content
const validateTextContent = (field, maxLength = 1000) => {
    return (req, res, next) => {
        const content = req.body[field];

        if (!content) {
            return res.status(400).json({ error: `${field} is required` });
        }

        if (typeof content !== 'string') {
            return res.status(400).json({ error: `${field} must be a string` });
        }

        // Check for suspicious patterns
        const suspiciousPatterns = [
            /<script/i,
            /javascript:/i,
            /on\w+\s*=/i,
            /eval\s*\(/i,
            /expression\s*\(/i,
            /vbscript:/i,
            /data:text\/html/i
        ];

        if (suspiciousPatterns.some(pattern => pattern.test(content))) {
            return res.status(400).json({ error: `${field} contains invalid characters` });
        }

        if (content.length > maxLength) {
            return res.status(413).json({
                error: `${field} too long. Maximum length is ${maxLength} characters`
            });
        }

        // Sanitize the content
        const sanitized = content
            .replace(/<[^>]*>/g, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '')
            .trim();

        req.body[field] = sanitized;
        next();
    };
};

// Validate answers object for quiz/fact check submission
const validateAnswers = (req, res, next) => {
    const { answers } = req.body;

    if (!answers || typeof answers !== 'object') {
        return res.status(400).json({ error: 'Answers must be an object' });
    }

    // Validate each answer
    for (const [questionId, answer] of Object.entries(answers)) {
        // Validate question ID format
        if (!/^[a-fA-F0-9]{24}$/.test(questionId)) {
            return res.status(400).json({ error: 'Invalid question ID format' });
        }

        // Validate answer value
        if (!['true', 'false', 'A', 'B', 'C', 'D', '0', '1', '2', '3', 'no_answer'].includes(answer)) {
            return res.status(400).json({ error: 'Invalid answer format' });
        }
    }

    next();
};

// Enhanced wallet address validation with checksum
const validateWalletAddressEnhanced = (req, res, next) => {
    const { creatorWallet, walletAddress } = req.body;
    const wallet = creatorWallet || walletAddress;

    if (!wallet) {
        return res.status(400).json({ error: 'Wallet address is required' });
    }

    try {
        // Use ethers to validate and normalize the address
        const normalizedAddress = ethers.getAddress(wallet);

        // Update the request with the normalized address
        if (creatorWallet) {
            req.body.creatorWallet = normalizedAddress;
        }
        if (walletAddress) {
            req.body.walletAddress = normalizedAddress;
        }

        next();
    } catch (error) {
        return res.status(400).json({ error: 'Invalid wallet address format' });
    }
};

module.exports = {
    validateRequestSize,
    validateFileUpload,
    validateContentLength,
    validateNumbers,
    validateWalletAddress,
    validateWalletAddressEnhanced,
    validateURL,
    sanitizeInput,
    validateGameId,
    validateTextContent,
    validateAnswers,
    CONTENT_LIMITS,
    FILE_SIZE_LIMITS
};