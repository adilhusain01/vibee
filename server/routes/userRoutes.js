
const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");

router.post("/create", userController.createOrGetUser);
router.get("/profile/:walletAddress", userController.getUserProfile); 
router.get("/quiz-history/:walletAddress", userController.getUserQuizHistory);

router.post("/auth/verify", userController.verifyLoginPayload);
router.post("/auth/check", userController.checkLoggedIn);
router.post("/auth/logout", userController.logoutUser);

module.exports = router;