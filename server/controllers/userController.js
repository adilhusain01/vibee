const User = require("../models/User");
const Quiz = require("../models/Quiz");
const { v4: uuidv4 } = require("uuid");
const { ethers } = require("ethers");


exports.createOrGetUser = async (req, res) => {
  const { walletAddress, email, name, authType } = req.body;

  try {
    let user = await User.findOne({ walletAddress });

    if (user) {
      user.lastLogin = Date.now();
      
      if (email && !user.email) user.email = email;
      if (name && user.name !== name) user.name = name;
      if (authType && user.authType !== authType) user.authType = authType;
      
      await user.save();
      return res.status(200).json(user);
    }

    user = new User({
      userId: uuidv4(),
      walletAddress,
      email,
      name,
      authType: authType || 'wallet'
    });

    await user.save();
    return res.status(201).json(user);
  } catch (error) {
    console.error("Error in createOrGetUser:", error);
    return res.status(500).json({ error: error.message });
  }
};


exports.getUserProfile = async (req, res) => {
  const { walletAddress } = req.params;

  try {
    const user = await User.findOne({ walletAddress });
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json(user);
  } catch (error) {
    console.error("Error in getUserProfile:", error);
    return res.status(500).json({ error: error.message });
  }
};

exports.verifyLoginPayload = async (req, res) => {
  const { payload, signature, walletAddress } = req.body;

  try {
    // Validate required fields
    if (!payload || !signature || !walletAddress) {
      return res.status(400).json({
        valid: false,
        error: "Missing required fields: payload, signature, and walletAddress"
      });
    }

    // Create the message that was signed
    const message = typeof payload === 'string' ? payload : JSON.stringify(payload);

    // Verify the signature
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);

      // Check if the recovered address matches the provided wallet address
      if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        return res.status(401).json({
          valid: false,
          error: "Signature verification failed: wallet address mismatch"
        });
      }

      // Generate a secure nonce for the session
      const nonce = ethers.hexlify(ethers.randomBytes(32));

      return res.status(200).json({
        valid: true,
        payload: {
          ...payload,
          nonce: nonce
        }
      });

    } catch (sigError) {
      console.error("Signature verification error:", sigError);
      return res.status(401).json({
        valid: false,
        error: "Invalid signature format or verification failed"
      });
    }

  } catch (error) {
    console.error("Error in verifyLoginPayload:", error);
    return res.status(500).json({ error: "Internal server error during verification" });
  }
};


exports.checkLoggedIn = async (req, res) => {
  const { walletAddress } = req.body;

  try {
    if (!walletAddress) {
      return res.status(200).json({ isLoggedIn: false });
    }

    const user = await User.findOne({ walletAddress });
    return res.status(200).json({ 
      isLoggedIn: !!user,
      user: user || null
    });
  } catch (error) {
    console.error("Error in checkLoggedIn:", error);
    return res.status(500).json({ error: error.message });
  }
};


exports.logoutUser = async (_req, res) => {
  return res.status(200).json({ success: true });
};




exports.getUserQuizHistory = async (req, res) => {
  const { walletAddress } = req.params;

  try {
    const user = await User.findOne({ walletAddress });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const createdQuizzes = await Quiz.find({ creator: user._id })
                                    .select('quizId title createdAt isFinished isPublic questionCount creatorName') // Select needed fields
                                    .sort({ createdAt: -1 });

    const takenQuizzesDetails = await Quiz.find({ 'participants.user': user._id })
                                        .select('quizId title createdAt isFinished isPublic questionCount creatorName participants.$') // Select needed fields + the matching participant entry
                                        .populate('creator', 'name') 
                                        .sort({ createdAt: -1 });


    const formattedHistory = [];

    createdQuizzes.forEach(quiz => {
      formattedHistory.push({
        _id: quiz._id,
        quizId: quiz.quizId,
        title: quiz.title || `Quiz ${quiz.quizId}`,
        createdAt: quiz.createdAt,
        isFinished: quiz.isFinished,
        isPublic: quiz.isPublic,
        questionCount: quiz.questionCount,
        creatorName: quiz.creatorName || 'You', 
        isCreator: true,
        score: null, 
        reward: null,
      });
    });

    takenQuizzesDetails.forEach(quiz => {
      
        const participation = quiz.participants && quiz.participants.length > 0
                                ? quiz.participants[0]
                                : null;

        formattedHistory.push({
            _id: quiz._id,
            quizId: quiz.quizId,
            title: quiz.title || `Quiz ${quiz.quizId}`,
            createdAt: quiz.createdAt,
            isFinished: quiz.isFinished,
            isPublic: quiz.isPublic,
            questionCount: quiz.questionCount,
            creatorName: quiz.creator?.name || quiz.creatorName || 'Unknown Creator',
            isCreator: false,
            score: participation?.score ?? null, 
            reward: participation?.reward !== null ? participation.reward.toString() : null,
        });
    });


    formattedHistory.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));


     const uniqueHistory = formattedHistory.filter((quiz, index, self) =>
         index === self.findIndex((q) => q.quizId === quiz.quizId)
     );


    return res.status(200).json({ quizzes: uniqueHistory });

  } catch (error) {
    console.error("Error in getUserQuizHistory:", error);
    return res.status(500).json({ error: "Failed to retrieve quiz history. " + error.message });
  }
};
