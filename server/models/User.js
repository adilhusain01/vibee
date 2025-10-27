const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    unique: true,
    sparse: true
  },
  name: {
    type: String
  },
  walletAddress: {
    type: String,
    required: true,
    unique: true
  },
  authType: {
    type: String,
    enum: ['google', 'github', 'email', 'wallet'],
    default: 'wallet'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  quizzesTaken: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz'
  }],
  quizzesCreated: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz'
  }]
});

// Performance indexes
userSchema.index({ walletAddress: 1 }, { unique: true }); // Primary lookup field
userSchema.index({ userId: 1 }, { unique: true }); // User ID lookups
userSchema.index({ email: 1 }, { sparse: true }); // Email lookups (sparse for optional field)
userSchema.index({ authType: 1 }); // Auth type filtering
userSchema.index({ createdAt: -1 }); // Recent users
userSchema.index({ lastLogin: -1 }); // Active users

module.exports = mongoose.model("User", userSchema);