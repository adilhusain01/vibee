// Utility functions for sanitizing user input and preventing XSS

/**
 * Sanitize text content to prevent XSS attacks
 * @param {string} text - The text to sanitize
 * @param {boolean} allowBasicFormatting - Whether to allow basic HTML formatting
 * @returns {string} - Sanitized text
 */
export const sanitizeText = (text, allowBasicFormatting = false) => {
  if (!text || typeof text !== 'string') {
    return '';
  }

  // Remove script tags and their content
  let sanitized = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove dangerous attributes and protocols
  sanitized = sanitized
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/data:text\/html/gi, '')
    .replace(/eval\s*\(/gi, '')
    .replace(/expression\s*\(/gi, '');

  if (!allowBasicFormatting) {
    // Remove all HTML tags
    sanitized = sanitized.replace(/<[^>]*>/g, '');
  } else {
    // Only allow safe formatting tags (b, i, em, strong, br)
    const tagPattern = /<(?!\/?(?:b|i|em|strong|br)\b)[^>]*>/gi;
    sanitized = sanitized.replace(tagPattern, '');
  }

  // Decode HTML entities that might be used for obfuscation
  sanitized = sanitized
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'");

  // Remove any remaining dangerous patterns after entity decoding
  sanitized = sanitized
    .replace(/<script/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');

  return sanitized.trim();
};

/**
 * Sanitize filename for safe display
 * @param {string} filename - The filename to sanitize
 * @returns {string} - Sanitized filename
 */
export const sanitizeFilename = (filename) => {
  if (!filename || typeof filename !== 'string') {
    return 'unnamed-file';
  }

  // Remove HTML tags and dangerous characters
  let sanitized = filename
    .replace(/<[^>]*>/g, '')
    .replace(/[<>:"'`]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');

  // Ensure filename isn't empty after sanitization
  if (!sanitized.trim()) {
    return 'unnamed-file';
  }

  return sanitized.trim();
};

/**
 * Sanitize URL to prevent XSS and SSRF
 * @param {string} url - The URL to sanitize
 * @returns {string|null} - Sanitized URL or null if invalid
 */
export const sanitizeUrl = (url) => {
  if (!url || typeof url !== 'string') {
    return null;
  }

  try {
    const urlObj = new URL(url);

    // Only allow HTTP and HTTPS protocols
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return null;
    }

    // Block dangerous hosts
    const blockedHosts = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '::1'
    ];

    const hostname = urlObj.hostname.toLowerCase();
    if (blockedHosts.includes(hostname)) {
      return null;
    }

    // Block private IP ranges
    if (
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)
    ) {
      return null;
    }

    return urlObj.toString();
  } catch (error) {
    return null;
  }
};

/**
 * Validate and sanitize quiz/fact check ID
 * @param {string} gameId - The game ID to validate
 * @returns {string|null} - Sanitized game ID or null if invalid
 */
export const sanitizeGameId = (gameId) => {
  if (!gameId || typeof gameId !== 'string') {
    return null;
  }

  // Only allow alphanumeric characters, 5-15 characters long
  if (!/^[a-zA-Z0-9]{5,15}$/.test(gameId)) {
    return null;
  }

  return gameId;
};

/**
 * Sanitize wallet address
 * @param {string} address - The wallet address to sanitize
 * @returns {string|null} - Sanitized address or null if invalid
 */
export const sanitizeWalletAddress = (address) => {
  if (!address || typeof address !== 'string') {
    return null;
  }

  // Basic Ethereum address format validation
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return null;
  }

  return address.toLowerCase();
};

/**
 * Create safe props for React components to prevent XSS
 * @param {Object} props - The props object to sanitize
 * @param {Array} textFields - Array of field names that should be sanitized as text
 * @param {Array} urlFields - Array of field names that should be sanitized as URLs
 * @returns {Object} - Sanitized props object
 */
export const sanitizeProps = (props, textFields = [], urlFields = []) => {
  const sanitized = { ...props };

  textFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = sanitizeText(sanitized[field]);
    }
  });

  urlFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = sanitizeUrl(sanitized[field]);
    }
  });

  return sanitized;
};

/**
 * Safe HTML renderer for React - returns sanitized string
 * @param {string} htmlString - HTML string to sanitize
 * @returns {string} - Sanitized HTML string
 */
export const renderSafeHTML = (htmlString) => {
  return sanitizeText(htmlString, true);
};