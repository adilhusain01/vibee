const mongoose = require("mongoose");

const participantFactsSchema = new mongoose.Schema({
  factCheckId: { type: String, required: true },
  participantName: { type: String, required: true },
  walletAddress: { type: String, required: true },
  score: { type: Number, default: 0 },
  isCompleted: { type: Boolean, default: false },
  reward: { type: Number, default: null },
  nftTokenId: { type: Number },
  createdAt: { type: Date, default: Date.now },
});

// Performance indexes
participantFactsSchema.index({ factCheckId: 1, walletAddress: 1 }, { unique: true }); // Composite unique index
participantFactsSchema.index({ factCheckId: 1 }); // Fact check participants lookup
participantFactsSchema.index({ walletAddress: 1 }); // User's participations
participantFactsSchema.index({ score: -1 }); // Leaderboard sorting

module.exports = mongoose.model("ParticipantFacts", participantFactsSchema);
