
const Quiz = require("../models/Quiz");
const User = require("../models/User");
const pdfParse = require("pdf-parse");
const mongoose = require("mongoose");
const { generateGameId, generateUserId } = require("../utils/secureId");
const { google } = require("googleapis");
const youtube = google.youtube("v3");
// const { YoutubeTranscript } = require("youtube-transcript"); // Commented out - using Supadata instead
const { Supadata } = require('@supadata/js');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const { Firecrawl } = require("@mendable/firecrawl-js");
const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY });
const { withCircuitBreaker } = require("../middleware/circuitBreaker");
const { invalidateCache } = require("../middleware/cache");

const extractQuestions = (responseText) => {
  const patterns = [
    /\*\*Question (\d+):\*\* (.*?)\n\nA\) (.*?)\nB\) (.*?)\nC\) (.*?)\nD\) (.*?)\n\n\*\*Correct Answer: (\w)\*\*/g,
    /Question (\d+): (.*?)\nA\) (.*?)\nB\) (.*?)\nC\) (.*?)\nD\) (.*?)\nCorrect Answer: (\w)/g,
    /(?:Q(?:uestion)?\.?\s*)?(\d+)[\.:]\s*(.*?)\s*(?:Choices|Options)?:?\s*\n\s*[Aa]\)\s*(.*?)\s*\n\s*[Bb]\)\s*(.*?)\s*\n\s*[Cc]\)\s*(.*?)\s*\n\s*[Dd]\)\s*(.*?)\s*\n\s*(?:Correct\s*(?:Answer)?:?\s*|\[Answer\]\s*:?\s*)(\w)/g,
  ];

  const questions = [];

  for (const pattern of patterns) {
    let match;
    pattern.lastIndex = 0;

    while ((match = pattern.exec(responseText)) !== null) {
      if (match.length === 8) {
        const question = {
          question: match[2].trim(),
          options: [
            `A) ${match[3].trim()}`,
            `B) ${match[4].trim()}`,
            `C) ${match[5].trim()}`,
            `D) ${match[6].trim()}`,
          ],
          correctAnswer: match[7].trim().toUpperCase(),
        };

        if (
          question.question &&
          question.options.length === 4 &&
          ["A", "B", "C", "D"].includes(question.correctAnswer)
        ) {
          questions.push(question);
        }
      }
    }

    if (questions.length > 0) {
      break;
    }
  }

  return questions;
};

const QUIZ_GENERATION_PROMPT = (
  content,
  questionCount
) => `${content.substring(0, 8000)}

Generate a quiz with exactly ${questionCount} multiple-choice questions about the above information.

IMPORTANT FORMATTING INSTRUCTIONS:
- Each question must have EXACTLY 4 options: A, B, C, and D
- Clearly mark the correct answer
- Follow this EXACT format:

Question 1: [Question Text]
A) [Option A]
B) [Option B]
C) [Option C]
D) [Option D]
Correct Answer: [A/B/C/D]

Question 2: [Next Question Text]
...and so on.`;


const createQuizLogic = async (quizData, creatorWallet, creatorName) => {
  // Use upsert operation to handle user creation/update in one operation
  const user = await User.findOneAndUpdate(
    { walletAddress: creatorWallet },
    {
      $setOnInsert: {
        userId: generateUserId(),
        walletAddress: creatorWallet,
        authType: 'wallet',
        quizzesCreated: [],
        quizzesTaken: []
      },
      $set: {
        name: creatorName || 'Unnamed Creator',
        lastLogin: new Date()
      }
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  );

  const quizId = generateGameId();

  const quiz = new Quiz({
    ...quizData,
    quizId,
    creatorWallet: user.walletAddress,
    creatorName: user.name,
    creator: user._id,
    sId: Date.now(),
  });

  // Use session for atomic operations
  const session = await Quiz.startSession();
  try {
    await session.withTransaction(async () => {
      await quiz.save({ session });

      // Add quiz to user's created quizzes atomically
      await User.updateOne(
        { _id: user._id },
        { $addToSet: { quizzesCreated: quiz._id } },
        { session }
      );
    });
  } finally {
    await session.endSession();
  }

  return quiz;
};

async function generateQuestionsWithGemini(content, questionCount) {
  return await withCircuitBreaker.gemini(async () => {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = QUIZ_GENERATION_PROMPT(content, questionCount);

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    return extractQuestions(text);
  });
}

const extractVideoId = (url) => {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname.includes("youtube.com")) {
      return urlObj.searchParams.get("v");
    } else if (urlObj.hostname.includes("youtu.be")) {
      return urlObj.pathname.slice(1);
    }
    return null;
  } catch (error) {
    return null;
  }
};

const getVideoDetails = async (videoId) => {
  return await withCircuitBreaker.youtube(async () => {
    const response = await youtube.videos.list({
      key: process.env.YOUTUBE_API_KEY,
      part: ["snippet"],
      id: [videoId],
    });

    if (response.data.items.length === 0) {
      return null;
    }

    return response.data.items[0].snippet;
  });
};

const getTranscriptFromAPI = async (videoId) => {
  return await withCircuitBreaker.supadata(async () => {
    const supadata = new Supadata({
      apiKey: process.env.SUPADATA_API_KEY,
    });

    const transcriptData = await supadata.youtube.transcript({
      videoId: videoId,
    });

    if (!transcriptData || !transcriptData.content || transcriptData.content.length === 0) {
      return null;
    }

    return transcriptData.content.map(item => item.text).join(' ');
  });
};



exports.createQuizByPrompt = async (req, res) => {
  const {
    creatorName,
    prompt,
    numParticipants,
    questionCount,
    rewardPerScore, 
    creatorWallet,
    totalCost, 
    title
  } = req.body;

  try {
    if (!prompt || !numParticipants || !questionCount || !rewardPerScore || !creatorWallet || !totalCost) {
        return res.status(400).json({ error: "Missing required fields for quiz creation." });
    }

    const questions = await generateQuestionsWithGemini(prompt, questionCount);

    if (!questions || questions.length === 0) {
      return res.status(400).json({
        error: "Failed to generate questions. Please try with a different prompt.",
      });
    }

     const formattedQuestions = questions.map((q) => ({
      question: q.question,
      options: q.options, 
      correctAnswer: q.correctAnswer, 
    }));


    const quizData = {
      title: title || prompt.substring(0, 50) + (prompt.length > 50 ? '...' : ''), 
      description: prompt, 
      maxParticipants: parseInt(numParticipants),
      questionCount: questions.length,
      rewardPerScore: Number(rewardPerScore), 
      totalCost: Number(totalCost), 
      questions: formattedQuestions,
    };

    const quiz = await createQuizLogic(quizData, creatorWallet, creatorName);

    res.status(201).json({ quizId: quiz.quizId }); 

  } catch (err) {
    console.error("Error creating quiz by prompt:", err);
    res.status(500).json({ error: "Failed to create quiz. " + err.message });
  }
};

exports.createQuizByPdf = async (req, res) => {
  const {
    creatorName,
    creatorWallet,
    numParticipants,
    questionCount,
    rewardPerScore,
    isPublic,
    totalCost,
  } = req.body;
  const pdfFile = req.file;

  if (!pdfFile) {
    return res.status(400).json({ error: "No PDF file uploaded." });
  }

  try {
    const pdfData = await pdfParse(pdfFile.buffer);
    const questions = await generateQuestionsWithGemini(pdfData.text, questionCount);

    if (!questions || questions.length === 0) {
      return res.status(400).json({
        error: "Failed to generate valid questions from the PDF content",
      });
    }

    const quizId = generateGameId();

    const quiz = new Quiz({
      quizId,
      creatorName,
      creatorWallet,
      questions,
      maxParticipants: numParticipants,
      totalCost,
      questionCount,
      rewardPerScore,
      isPublic,
    });

    await quiz.save();
    res.status(201).json(quiz);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

exports.createQuizByURL = async (req, res) => {
  console.log("🚀 Starting URL quiz creation");
  console.log("📥 Request body:", req.body);

  const {
    creatorName,
    creatorWallet,
    websiteUrl,
    numParticipants,
    questionCount,
    rewardPerScore,
    isPublic = true,
    totalCost,
  } = req.body;

  try {
    console.log("🌐 Scraping URL with Firecrawl SDK:", websiteUrl);

    // Use Firecrawl SDK to scrape the website
    const doc = await firecrawl.scrape(websiteUrl, {
      formats: ['markdown'],
      onlyMainContent: true,
      removeBase64Images: true,
      blockAds: true,
      timeout: 30000,
    });

    console.log("📄 Firecrawl scrape completed");

    if (!doc || !doc.markdown) {
      console.log("❌ Firecrawl returned no content");
      return res.status(400).json({
        error: "Failed to extract content from the website",
      });
    }

    const websiteContent = doc.markdown;
    console.log("📝 Content length:", websiteContent?.length || 0);

    if (!websiteContent || websiteContent.length < 100) {
      console.log("❌ Insufficient content extracted");
      return res.status(400).json({
        error: "Could not extract sufficient content from the provided URL",
      });
    }

    console.log("🤖 Generating questions with Gemini...");
    const questions = await generateQuestionsWithGemini(websiteContent, questionCount);
    console.log("❓ Questions generated:", questions?.length || 0);

    if (!questions || questions.length === 0) {
      console.log("❌ Failed to generate questions");
      return res.status(400).json({
        error: "Failed to generate valid questions from the website content",
      });
    }

    console.log("💾 Creating quiz in database...");
    const quizId = generateGameId();
    const quiz = new Quiz({
      quizId,
      creatorName,
      creatorWallet,
      questions,
      maxParticipants: numParticipants,
      totalCost,
      questionCount,
      rewardPerScore,
      isPublic,
    });

    await quiz.save();
    console.log("✅ Quiz created successfully with ID:", quizId);
    res.status(201).json(quiz);
  } catch (err) {
    console.error("❌ Quiz creation error:", err);
    console.error("🔍 Error stack:", err.stack);
    res.status(400).json({
      error: err.message || "Failed to create quiz from URL",
    });
  }
};

exports.createQuizByVideo = async (req, res) => {
  const {
    creatorName,
    creatorWallet,
    ytVideoUrl,
    numParticipants,
    questionCount,
    rewardPerScore,
    isPublic = false,
    totalCost,
  } = req.body;

  try {
    const videoId = extractVideoId(ytVideoUrl);
    if (!videoId) {
      return res.status(400).json({
        error: "Invalid YouTube URL. Please provide a valid YouTube video URL.",
      });
    }

    const videoDetails = await getVideoDetails(videoId);
    if (!videoDetails) {
      return res.status(400).json({
        error: "Could not fetch video details. Please check if the video exists.",
      });
    }

    const transcript = await getTranscriptFromAPI(videoId);
    if (!transcript) {
      return res.status(400).json({
        error: "Could not extract transcript from the video.",
      });
    }

    const questions = await generateQuestionsWithGemini(transcript, questionCount);

    if (!questions || questions.length === 0) {
      return res.status(400).json({
        error: "Failed to generate valid questions from the video content",
      });
    }

    const quizId = generateGameId();
    const quiz = new Quiz({
      quizId,
      creatorName,
      creatorWallet,
      questions,
      maxParticipants: numParticipants,
      totalCost,
      questionCount,
      rewardPerScore,
      isPublic,
    });

    await quiz.save();
    res.json(quiz);
  } catch (err) {
    console.error("Quiz creation error:", err);
    res.status(400).json({
      error: err.message || "Failed to create quiz from video",
    });
  }
};

exports.updateQuiz = async (req, res) => {
  const data = req.body;
  const { quizId } = req.params;

  try {
    const quiz = await Quiz.findOne({ quizId }).populate('participants.user', 'walletAddress'); 

    if (!quiz) return res.status(404).json({ message: "Quiz not found" });

    if (data.gameId !== undefined) {
         if (typeof data.gameId === "object" && data.gameId !== null && data.gameId.hex) {
            quiz.gameId = parseInt(data.gameId.hex, 16);
         } else if (typeof data.gameId === 'string' && data.gameId.startsWith('0x')) {
             quiz.gameId = parseInt(data.gameId, 16);
         } else if (!isNaN(Number(data.gameId))) {
             quiz.gameId = Number(data.gameId);
         } else {
             console.warn("Received unexpected format for gameId:", data.gameId);
         }
    }
    if (data.isPublic !== undefined) quiz.isPublic = data.isPublic;
    if (data.isFinished !== undefined) quiz.isFinished = data.isFinished;

    await quiz.save();

    // 🔄 CRITICAL: Invalidate cache when quiz is updated (especially isPublic status)
    invalidateCache.quiz(quizId);
    console.log(`🗑️ Cache invalidated for quiz: ${quizId}`);

    const participantWalletAddresses = quiz.participants.map((p) => p.user.walletAddress);
    const participantRewards = quiz.participants.map((p) => p.reward !== null ? p.reward.toString() : '0'); 


    console.log("Update successful for quiz:", quizId, "Returning gameId:", quiz.gameId, "Participants:", participantWalletAddresses, "Rewards:", participantRewards);


    res.json({
      gameId: quiz.gameId !== null && quiz.gameId !== undefined ? quiz.gameId.toString() : null,
      participants: participantWalletAddresses,
      rewards: participantRewards,
    });
  } catch (err) {
    console.error("Error updating quiz:", err);
    res.status(400).json({ error: err.message });
  }
};

exports.getQuiz = async (req, res) => {
  const { quizId } = req.params;
  const { walletAddress } = req.body; 

  try {
    const quiz = await Quiz.findOne({ quizId })
                           .populate('creator', 'name walletAddress')
                           .populate('participants.user', 'walletAddress');

    if (!quiz) return res.status(404).json({ error: "Quiz not found" });

    if (quiz.isFinished) {
         return res.status(410).json({ error: "This quiz has already ended." }); 
     }


    if (!quiz.isPublic) {
      if (quiz.creatorWallet !== walletAddress) {
         return res.status(403).json({ error: "This quiz has not started yet or is private." });
      }
    }


    const alreadyJoined = quiz.participants.some(p => p.user?.walletAddress === walletAddress);
    if (alreadyJoined) {

      console.log(`User ${walletAddress} already joined quiz ${quizId}`);
    } else {
        const participantCount = quiz.participants.length;
        if (participantCount >= quiz.maxParticipants) {
          return res.status(403).json({
            error: "The maximum number of participants for this quiz has been reached.",
          });
        }
    }


    const quizDataForParticipant = {
        _id: quiz._id,
        quizId: quiz.quizId,
        title: quiz.title,
        description: quiz.description,
        creatorName: quiz.creator?.name || quiz.creatorName, 
        questionCount: quiz.questionCount,
        maxParticipants: quiz.maxParticipants,
        isPublic: quiz.isPublic,
        isFinished: quiz.isFinished,
        alreadyJoined: alreadyJoined, 
        questions: quiz.questions.map(q => ({
            _id: q._id,
            question: q.question,
            options: q.options
        })),
    };


    res.status(200).json(quizDataForParticipant);

  } catch (err) {
    console.error("Error getting quiz:", err);
    res.status(400).json({ error: err.message });
  }
};



exports.joinQuiz = async (req, res) => {
  const { quizId } = req.params;
  const { walletAddress, participantName, email, authType } = req.body;

  if (!walletAddress || !participantName) {
      return res.status(400).json({ error: "Wallet address and participant name are required." });
  }

  // Start a transaction session for atomic operations
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Find or create user first (outside of quiz participation logic)
    let user = await User.findOne({ walletAddress }).session(session);
    if (!user) {
      user = new User({
        userId: generateUserId(),
        walletAddress,
        name: participantName,
        email,
        authType: authType || 'wallet'
      });
      await user.save({ session });
    } else {
      if (participantName && user.name !== participantName) {
        user.name = participantName;
        await user.save({ session });
      }
    }

    // Use atomic findOneAndUpdate to prevent race conditions
    const updateResult = await Quiz.findOneAndUpdate(
      {
        quizId: quizId,
        isPublic: true,
        isFinished: false,
        $expr: { $lt: [{ $size: "$participants" }, "$maxParticipants"] }, // Atomic participant count check
        "participants.user": { $ne: user._id } // Ensure user hasn't already joined
      },
      {
        $push: { participants: { user: user._id } }
      },
      {
        new: true,
        session: session
      }
    );

    if (!updateResult) {
      // Determine the specific reason for failure
      const quiz = await Quiz.findOne({ quizId }).session(session);

      if (!quiz) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ error: "Quiz not found" });
      }

      if (!quiz.isPublic) {
        await session.abortTransaction();
        session.endSession();
        return res.status(403).json({ error: "This quiz is not active or is private." });
      }

      if (quiz.isFinished) {
        await session.abortTransaction();
        session.endSession();
        return res.status(410).json({ error: "This quiz has already ended." });
      }

      if (quiz.participants.length >= quiz.maxParticipants) {
        await session.abortTransaction();
        session.endSession();
        return res.status(403).json({
          error: "The maximum number of participants for this quiz has been reached.",
        });
      }

      // User already joined
      const alreadyJoined = quiz.participants.some(p => p.user && p.user.toString() === user._id.toString());
      if (alreadyJoined) {
        await session.abortTransaction();
        session.endSession();
        return res.status(409).json({ error: "You have already joined this quiz." });
      }

      // Unknown error
      await session.abortTransaction();
      session.endSession();
      return res.status(500).json({ error: "Failed to join quiz due to unexpected error." });
    }

    // Update user's quiz history atomically
    if (!user.quizzesTaken.includes(updateResult._id)) {
        await User.findByIdAndUpdate(
          user._id,
          { $addToSet: { quizzesTaken: updateResult._id } },
          { session }
        );
    }

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    // 🔄 CRITICAL: Invalidate cache when participant joins
    invalidateCache.quiz(quizId);
    console.log(`🗑️ Cache invalidated for quiz join: ${quizId}`);

    res.status(200).json({ message: "Successfully joined the quiz." });

  } catch (err) {
    console.error("Error joining quiz:", err);
    await session.abortTransaction();
    session.endSession();

    if (err.code === 11000) {
      res.status(409).json({ error: "A conflict occurred. You might already be registered or joined." });
    } else {
      res.status(500).json({ error: "Failed to join quiz. " + err.message });
    }
  }
};


exports.submitAnswer = async (req, res) => {
  const { quizId, questionId, answer, walletAddress } = req.body;

  if (!quizId || !questionId || !answer || !walletAddress) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const quiz = await Quiz.findOne({ quizId })
      .populate('participants.user', 'walletAddress');

    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found" });
    }

    if (quiz.isFinished) {
      return res.status(410).json({ error: "Quiz has already ended" });
    }

    const participantIndex = quiz.participants.findIndex(
      p => p.user && p.user.walletAddress === walletAddress
    );

    if (participantIndex === -1) {
      return res.status(403).json({ error: "You have not joined this quiz" });
    }

    const participant = quiz.participants[participantIndex];

    if (participant.isCompleted) {
      return res.status(409).json({ error: "You have already completed this quiz" });
    }

    const question = quiz.questions.find(q => q._id.toString() === questionId);
    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }

    let userAnswerLetter;
    if (/^[0-3]$/.test(answer)) {
      const indexToLetter = ["A", "B", "C", "D"];
      userAnswerLetter = indexToLetter[parseInt(answer)];
    } else {
      userAnswerLetter = answer.toString().toUpperCase();
    }

    const isCorrect = userAnswerLetter === question.correctAnswer.toUpperCase();

    if (isCorrect) {
      participant.score = (participant.score || 0) + 1;
    }

    await quiz.save();

    // Invalidate cache to show real-time updates
    invalidateCache.quiz(quizId);
    console.log(`🔄 Cache invalidated for quiz answer submission: ${quizId}`);

    res.json({
      success: true,
      isCorrect,
      score: participant.score,
      correctAnswer: question.correctAnswer
    });

  } catch (err) {
    console.error("Answer submission error:", err);
    res.status(500).json({ error: "Failed to submit answer" });
  }
};

exports.getLeaderBoards = async (req, res) => {
  const { quizId } = req.params;

  try {
    const quiz = await Quiz.findOne({ quizId })
                           .populate('creator', 'name walletAddress')
                           .populate('participants.user', 'name walletAddress');


    if (!quiz) return res.status(404).json({ error: "Quiz not found" });


    const sortedParticipants = quiz.participants.sort((a, b) => {
      return (b.score || 0) - (a.score || 0);
    });


    const leaderboardData = {
      quiz: {
        _id: quiz._id,
        quizId: quiz.quizId,
        title: quiz.title,
        creatorName: quiz.creator?.name || quiz.creatorName,
        questionCount: quiz.questionCount,
        maxParticipants: quiz.maxParticipants,
        isPublic: quiz.isPublic,
        isFinished: quiz.isFinished,
      },
      participants: sortedParticipants.map(p => ({
         user: p.user ? {
            name: p.user.name || 'Unnamed Participant',
            walletAddress: p.user.walletAddress
         } : { name: 'Loading...', walletAddress: '...' },
         score: p.score || 0,
         isCompleted: p.isCompleted || false,
         reward: p.reward !== null ? p.reward.toString() : null,
         joinedAt: p.joinedAt
      }))
    };


    res.status(200).json(leaderboardData);


  } catch (err) {
    console.error("Error getting leaderboards:", err);
    res.status(500).json({ error: "Failed to retrieve leaderboard data. " + err.message });
  }
};

exports.submitQuiz = async (req, res) => {
  const { quizId, walletAddress } = req.body;

  if (!quizId || !walletAddress) {
      return res.status(400).json({ error: "Missing quizId or walletAddress." });
  }

  try {
    const quiz = await Quiz.findOne({ quizId })
                           .populate('participants.user', 'walletAddress'); 


    if (!quiz) return res.status(404).json({ error: "Quiz not found" });
    if (quiz.isFinished) return res.status(410).json({ error: "Quiz has already ended." });


    const participantIndex = quiz.participants.findIndex(p => p.user?.walletAddress === walletAddress);


    if (participantIndex === -1) {
      return res.status(403).json({ error: "You have not joined this quiz or user data is missing." });
    }


    if (quiz.participants[participantIndex].isCompleted) {
        return res.status(409).json({ error: "You have already submitted answers for this quiz." });
    }

    // No need to recalculate score - use the already calculated score from individual answers
    const finalScore = quiz.participants[participantIndex].score || 0;

    const rewardPerScoreWei = BigInt(quiz.rewardPerScore || 0);
    const totalRewardWei = BigInt(finalScore) * rewardPerScoreWei;

    // Mark as completed and set reward
    quiz.participants[participantIndex].isCompleted = true;
    quiz.participants[participantIndex].reward = Number(totalRewardWei); 


    await quiz.save();

    // 🔄 CRITICAL: Invalidate cache when participant submits
    invalidateCache.quiz(quizId);
    console.log(`🗑️ Cache invalidated for quiz submit: ${quizId}`);

    res.status(200).json({
        message: "Quiz submitted successfully!",
        quizId: quiz.quizId,
        score: finalScore,
        reward: totalRewardWei > 0 ? totalRewardWei.toString() : null
    });


  } catch (err) {
    console.error("Error submitting quiz:", err);
    res.status(500).json({ error: "Failed to submit quiz. " + err.message });
  }
};