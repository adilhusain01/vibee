const mongoose = require("mongoose");

const participantSchema = new mongoose.Schema({
  quizId: { type: String, required: true },
  participantName: { type: String, required: true },
  walletAddress: { type: String, required: true },
  score: { type: Number, default: null },
  reward: { type: Number, default: null },
  nftTokenId: { type: Number },
  createdAt: { type: Date, default: Date.now },
});

// Performance indexes
participantSchema.index({ quizId: 1, walletAddress: 1 }, { unique: true }); // Composite unique index
participantSchema.index({ quizId: 1 }); // Quiz participants lookup
participantSchema.index({ walletAddress: 1 }); // User's participations
participantSchema.index({ score: -1 }); // Leaderboard sorting

module.exports = mongoose.model("Participant", participantSchema);
