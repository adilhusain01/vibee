const { ethers } = require("ethers");

// Middleware to verify wallet signature for protected routes
const verifyWalletSignature = async (req, res, next) => {
  try {
    const { walletAddress, signature, message, timestamp } = req.body;

    // Check if required auth fields are present
    if (!walletAddress || !signature || !message) {
      return res.status(401).json({
        error: "Authentication required: missing walletAddress, signature, or message"
      });
    }

    // Verify timestamp is recent (within 5 minutes)
    if (timestamp) {
      const now = Date.now();
      const messageTime = parseInt(timestamp);
      const fiveMinutes = 5 * 60 * 1000;

      if (Math.abs(now - messageTime) > fiveMinutes) {
        return res.status(401).json({
          error: "Authentication expired: message timestamp too old"
        });
      }
    }

    try {
      // Verify the signature
      const recoveredAddress = ethers.verifyMessage(message, signature);

      // Check if recovered address matches provided wallet address
      if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        return res.status(401).json({
          error: "Authentication failed: signature verification failed"
        });
      }

      // Add verified wallet address to request object
      req.verifiedWallet = recoveredAddress.toLowerCase();
      next();

    } catch (sigError) {
      console.error("Signature verification error:", sigError);
      return res.status(401).json({
        error: "Authentication failed: invalid signature"
      });
    }

  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({
      error: "Internal server error during authentication"
    });
  }
};

// Middleware to ensure the authenticated user owns the resource
const verifyResourceOwnership = (resourceOwnerField = 'creatorWallet') => {
  return (req, res, next) => {
    const resourceOwner = req.body[resourceOwnerField];
    const authenticatedWallet = req.verifiedWallet;

    if (!resourceOwner) {
      return res.status(400).json({
        error: `Resource owner field '${resourceOwnerField}' not found in request`
      });
    }

    if (resourceOwner.toLowerCase() !== authenticatedWallet) {
      return res.status(403).json({
        error: "Access denied: you can only access your own resources"
      });
    }

    next();
  };
};

// Optional authentication middleware (doesn't block request if auth fails)
const optionalAuth = async (req, res, next) => {
  try {
    const { walletAddress, signature, message } = req.body;

    if (walletAddress && signature && message) {
      try {
        const recoveredAddress = ethers.verifyMessage(message, signature);
        if (recoveredAddress.toLowerCase() === walletAddress.toLowerCase()) {
          req.verifiedWallet = recoveredAddress.toLowerCase();
        }
      } catch (sigError) {
        // Ignore signature errors in optional auth
        console.warn("Optional auth signature verification failed:", sigError.message);
      }
    }

    next();
  } catch (error) {
    // Continue without authentication in optional auth
    next();
  }
};

// Rate limiting per wallet address
const walletRateLimit = (windowMs = 15 * 60 * 1000, maxRequests = 100) => {
  const walletWindows = new Map();

  return (req, res, next) => {
    const walletAddress = req.verifiedWallet || req.body.walletAddress;

    if (!walletAddress) {
      return next();
    }

    const now = Date.now();
    const wallet = walletAddress.toLowerCase();

    if (!walletWindows.has(wallet)) {
      walletWindows.set(wallet, { count: 1, resetTime: now + windowMs });
      return next();
    }

    const windowData = walletWindows.get(wallet);

    if (now > windowData.resetTime) {
      walletWindows.set(wallet, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (windowData.count >= maxRequests) {
      return res.status(429).json({
        error: "Rate limit exceeded for this wallet address"
      });
    }

    windowData.count++;
    next();
  };
};

module.exports = {
  verifyWalletSignature,
  verifyResourceOwnership,
  optionalAuth,
  walletRateLimit
};