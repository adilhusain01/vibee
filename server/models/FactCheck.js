const mongoose = require("mongoose");

const factCheckSchema = new mongoose.Schema({
  sId: { type: Number },
  gameId: { type: Number },
  factCheckId: { type: String, required: true, unique: true },
  creatorName: { type: String, required: true },
  creatorWallet: { type: String, required: true },
  facts: [
    {
      statement: String,
      isTrue: Boolean,
    },
  ],
  numParticipants: { type: Number, required: true },
  totalCost: { type: Number, required: true },
  factsCount: { type: Number, required: true },
  rewardPerScore: { type: Number, required: true },
  isPublic: { type: Boolean, default: false },
  isFinished: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

// Performance indexes
factCheckSchema.index({ factCheckId: 1 }, { unique: true }); // Primary lookup field
factCheckSchema.index({ creatorWallet: 1 }); // Creator queries
factCheckSchema.index({ isPublic: 1, isFinished: 1 }); // Public fact check filtering
factCheckSchema.index({ createdAt: -1 }); // Recent fact checks
factCheckSchema.index({ gameId: 1 }, { sparse: true }); // Blockchain game ID

module.exports = mongoose.model("FactCheck", factCheckSchema);
