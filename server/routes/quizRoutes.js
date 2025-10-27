
const express = require('express');
const multer = require('multer');
const router = express.Router();
const {
  getQuiz,
  createQuizByPrompt,
  createQuizByURL,
  createQuizByPdf,
  createQuizByVideo,
  joinQuiz,
  submitQuiz,
  submitAnswer,
  getLeaderBoards,
  updateQuiz,
} = require('../controllers/quizController');

const rateLimiters = require("../middleware/rateLimiter");
const { cacheQuiz, cacheLeaderboard } = require("../middleware/cache");
const {
  validateFileUpload,
  validateContentLength,
  validateNumbers,
  validateWalletAddressEnhanced,
  validateURL,
  validateGameId,
  sanitizeInput,
  CONTENT_LIMITS
} = require("../middleware/validation");

// Configure multer with size limits
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1 // Only one file per request
  },
  fileFilter: (_, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// Routes with appropriate middleware
router.get('/leaderboards/:quizId',
  validateGameId,
  cacheLeaderboard(60), // Cache for 1 minute
  getLeaderBoards
);

router.post('/verify/:quizId',
  rateLimiters.general,
  validateGameId,
  validateWalletAddressEnhanced,
  cacheQuiz(300), // Cache for 5 minutes
  getQuiz
);

router.post('/create/prompt',
  rateLimiters.creation,
  rateLimiters.externalAPI,
  validateWalletAddressEnhanced,
  validateContentLength('prompt', CONTENT_LIMITS.PROMPT),
  sanitizeInput(['prompt', 'creatorName']),
  validateNumbers(['numParticipants', 'questionCount', 'rewardPerScore', 'totalCost']),
  createQuizByPrompt
);

router.post('/create/pdf',
  rateLimiters.creation,
  rateLimiters.upload,
  rateLimiters.externalAPI,
  upload.single('pdf'),
  validateFileUpload('PDF'),
  validateWalletAddressEnhanced,
  sanitizeInput(['creatorName']),
  validateNumbers(['numParticipants', 'questionCount', 'rewardPerScore', 'totalCost']),
  createQuizByPdf
);

router.post('/create/url',
  rateLimiters.creation,
  rateLimiters.externalAPI,
  validateWalletAddressEnhanced,
  validateURL,
  sanitizeInput(['creatorName']),
  validateNumbers(['numParticipants', 'questionCount', 'rewardPerScore', 'totalCost']),
  createQuizByURL
);

router.post('/create/video',
  rateLimiters.creation,
  rateLimiters.externalAPI,
  validateWalletAddressEnhanced,
  validateURL,
  sanitizeInput(['creatorName']),
  validateNumbers(['numParticipants', 'questionCount', 'rewardPerScore', 'totalCost']),
  createQuizByVideo
);

router.post('/join/:quizId',
  rateLimiters.general,
  validateGameId,
  validateWalletAddressEnhanced,
  sanitizeInput(['participantName']),
  joinQuiz
);

router.post('/answer',
  rateLimiters.general,
  validateWalletAddressEnhanced,
  submitAnswer
);

router.post('/submit',
  rateLimiters.general,
  validateWalletAddressEnhanced,
  submitQuiz
);

router.put('/update/:quizId',
  rateLimiters.general,
  validateGameId,
  updateQuiz
);

module.exports = router;
