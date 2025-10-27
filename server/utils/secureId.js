const { randomBytes } = require('crypto');

/**
 * Generate a cryptographically secure random ID
 * @param {number} length - The length of the ID in bytes (default: 8)
 * @param {string} encoding - The encoding to use (default: 'hex')
 * @returns {string} - Secure random ID
 */
const generateSecureId = (length = 8, encoding = 'hex') => {
  try {
    return randomBytes(length).toString(encoding);
  } catch (error) {
    // Fallback to timestamp + random in case of crypto failure
    console.error('Crypto random generation failed, using fallback:', error);
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
};

/**
 * Generate a secure quiz/fact-check ID (5-15 alphanumeric characters)
 * @returns {string} - Secure game ID
 */
const generateGameId = () => {
  // Generate 5 bytes of randomness and convert to base36 for alphanumeric
  const randomId = generateSecureId(5, 'hex');

  // Convert hex to base36 and ensure it's the right length
  const base36Id = parseInt(randomId, 16).toString(36);

  // Ensure it's at least 5 characters and at most 10
  const finalId = base36Id.padStart(5, '0').substring(0, 10);

  return finalId;
};

/**
 * Generate a secure user ID
 * @returns {string} - Secure user ID
 */
const generateUserId = () => {
  // Generate 16 bytes for a strong user ID
  return generateSecureId(16, 'hex');
};

/**
 * Generate a secure session nonce
 * @returns {string} - Secure nonce
 */
const generateNonce = () => {
  // Generate 32 bytes for session nonce
  return generateSecureId(32, 'hex');
};

/**
 * Generate a secure API key or token
 * @returns {string} - Secure token
 */
const generateToken = () => {
  // Generate 64 bytes for high-security tokens
  return generateSecureId(64, 'base64url');
};

/**
 * Check if a string looks like it was generated with weak randomness
 * @param {string} id - The ID to check
 * @returns {boolean} - True if the ID looks weak
 */
const isWeakId = (id) => {
  if (!id || typeof id !== 'string') {
    return true;
  }

  // Check for obvious patterns from Math.random()
  const weakPatterns = [
    /^0\.\d+$/, // Math.random() output
    /^[a-z0-9]{5}$/, // Short predictable IDs
    /(.)\1{3,}/, // Repeated characters
    /^(123|abc|test)/i, // Common test patterns
  ];

  return weakPatterns.some(pattern => pattern.test(id));
};

module.exports = {
  generateSecureId,
  generateGameId,
  generateUserId,
  generateNonce,
  generateToken,
  isWeakId
};