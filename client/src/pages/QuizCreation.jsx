import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { usePrivyAuth } from "../context/PrivyAuthContext";
import toast from "react-hot-toast";
import axios from "../api/axios";
import { ethers } from "ethers";
import { getCurrentCurrency } from '../utils/networks';
import { QRCodeSVG } from "qrcode.react";
import ABI from "../utils/abi.json";
import { sanitizeFilename, sanitizeGameId } from '../utils/sanitize';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  TextField,
  InputAdornment,
  CircularProgress,
} from "@mui/material";
import {
  Download,
  Copy,
  Wand2,
  Globe,
  FileText,
  Users,
  HelpCircle,
  Trophy,
  Upload,
  Video,
} from "lucide-react";
import ConnectWallet from "../components/ConnectWallet";
import QuizCostDisplay from "../components/QuizCostDisplay";

const QuizCreation = () => {
  const { type } = useParams();
  const navigate = useNavigate();
  const { walletAddress, getContractSigner, authenticated, connectWallet } = usePrivyAuth();

  const [formData, setFormData] = useState({
    creatorName: "",
    title: type === "prompt" ? "" : undefined,
    prompt: type === "prompt" ? "" : undefined,
    websiteUrl: type === "url" ? "" : undefined,
    ytVideoUrl: type === "video" ? "" : undefined,
    numParticipants: "",
    questionCount: "",
    rewardPerScore: "",
  });

  const [pdfFile, setPdfFile] = useState(null);
  const [quizId, setQuizId] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [startDisabled, setStartDisabled] = useState(false);
  const [closeDisabled, setCloseDisabled] = useState(true);
  const qrRef = useRef();
  const fileInputRef = useRef();
  const [quizCreated, setQuizCreated] = useState(false);
  const [costValidation, setCostValidation] = useState({
    isValid: true,
    totalCost: 0
  });
  const baseUrl = import.meta.env.VITE_CLIENT_URI;
  const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;

  // Redirect if invalid type
  useEffect(() => {
    const validTypes = ["prompt", "url", "video", "pdf"];
    if (!validTypes.includes(type)) {
      navigate("/quizOptions");
    }
  }, [type, navigate]);

  const getQuizConfig = () => {
    const configs = {
      prompt: {
        title: "Create Quiz from Prompt",
        highlight: "Prompt",
        icon: Wand2,
        endpoint: "/api/quiz/create/prompt",
        requiredFields: ["creatorName", "title", "prompt", "numParticipants", "questionCount", "rewardPerScore"]
      },
      url: {
        title: "Create Quiz from Website",
        highlight: "Website",
        icon: Globe,
        endpoint: "/api/quiz/create/url",
        requiredFields: ["creatorName", "websiteUrl", "numParticipants", "questionCount", "rewardPerScore"]
      },
      video: {
        title: "Create Quiz from Youtube Video",
        highlight: "Youtube Video",
        icon: Video,
        endpoint: "/api/quiz/create/video",
        requiredFields: ["creatorName", "ytVideoUrl", "numParticipants", "questionCount", "rewardPerScore"]
      },
      pdf: {
        title: "Create Quiz from PDF",
        highlight: "PDF",
        icon: FileText,
        endpoint: "/api/quiz/create/pdf",
        requiredFields: ["creatorName", "numParticipants", "questionCount", "rewardPerScore"]
      }
    };
    return configs[type] || configs.prompt;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type !== "application/pdf") {
      toast.error("Please select a valid PDF file");
      setPdfFile(null);
      return;
    }
    setPdfFile(file);
  };

  // Handle cost calculation updates
  const handleCostCalculated = (costInfo) => {
    setCostValidation(costInfo);
  };

  const validateWebsiteUrl = async (url) => {
    if (!url) return { isValid: false, error: "URL is required" };

    try {
      const parsedUrl = new URL(url);

      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return { isValid: false, error: "URL must use HTTP or HTTPS protocol" };
      }

      const invalidExtensions = [
        ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".zip", ".doc", ".docx",
      ];
      if (
        invalidExtensions.some((ext) =>
          parsedUrl.pathname.toLowerCase().endsWith(ext)
        )
      ) {
        return { isValid: false, error: "Direct file links are not supported" };
      }

      return { isValid: true, normalizedUrl: parsedUrl.href };
    } catch (error) {
      return { isValid: false, error: "Invalid URL format" };
    }
  };

  const validateYouTubeUrl = (url) => {
    if (!url) return { isValid: false, error: "URL is required" };

    try {
      const parsedUrl = new URL(url);

      const validDomains = ["youtube.com", "youtu.be", "www.youtube.com"];
      if (!validDomains.some((domain) => parsedUrl.hostname === domain)) {
        return { isValid: false, error: "Not a valid YouTube URL" };
      }

      if (parsedUrl.hostname.includes("youtube.com")) {
        if (parsedUrl.pathname === "/watch") {
          const videoId = parsedUrl.searchParams.get("v");
          if (!videoId || videoId.length !== 11) {
            return { isValid: false, error: "Invalid YouTube video ID" };
          }
          return { isValid: true, videoId };
        }
        if (parsedUrl.pathname.startsWith("/shorts/")) {
          const videoId = parsedUrl.pathname.slice(8);
          if (!videoId || videoId.length !== 11) {
            return { isValid: false, error: "Invalid YouTube shorts ID" };
          }
          return { isValid: true, videoId };
        }
      }

      if (parsedUrl.hostname === "youtu.be") {
        const videoId = parsedUrl.pathname.slice(1);
        if (!videoId || videoId.length !== 11) {
          return { isValid: false, error: "Invalid YouTube video ID" };
        }
        return { isValid: true, videoId };
      }

      return { isValid: false, error: "Invalid YouTube URL format" };
    } catch (error) {
      return { isValid: false, error: "Invalid URL format" };
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!authenticated || !walletAddress) {
      toast.error("Please connect your wallet first");
      await connectWallet();
      return;
    }

    const config = getQuizConfig();
    const {
      creatorName,
      title,
      prompt,
      websiteUrl,
      ytVideoUrl,
      numParticipants,
      questionCount,
      rewardPerScore,
    } = formData;

    // Check required fields
    const fieldValidation = config.requiredFields.every(field => {
      if (field === "title" && type === "prompt") return title;
      if (field === "prompt" && type === "prompt") return prompt;
      if (field === "websiteUrl" && type === "url") return websiteUrl;
      if (field === "ytVideoUrl" && type === "video") return ytVideoUrl;
      if (["creatorName", "numParticipants", "questionCount", "rewardPerScore"].includes(field)) {
        return formData[field];
      }
      return true;
    });

    if (!fieldValidation || (type === "pdf" && !pdfFile)) {
      toast.error("All fields are required");
      return;
    }

    if (questionCount > 30) {
      toast.error("Question count cannot be more than 30");
      return;
    }

    // Type-specific validations
    if (type === "url") {
      const urlValidation = await validateWebsiteUrl(websiteUrl);
      if (!urlValidation.isValid) {
        toast.error(urlValidation.error);
        return;
      }
    }

    if (type === "video") {
      const urlValidation = validateYouTubeUrl(ytVideoUrl);
      if (!urlValidation.isValid) {
        toast.error(urlValidation.error);
        return;
      }
    }

    // ⚠️ CRITICAL: Check balance BEFORE creating quiz on server
    if (costValidation.totalCost === 0) {
      toast.error("Please fill in all required fields to calculate cost");
      return;
    }

    // Check balance with fresh data
    try {
      const signer = await getContractSigner();
      const currentBalance = await signer.getBalance();

      // Convert simple cost to Wei for comparison (round to 18 decimal places max)
      const totalCostRounded = parseFloat(costValidation.totalCost.toFixed(18));
      const requiredAmountInWei = ethers.utils.parseUnits(totalCostRounded.toString(), 18);

      if (currentBalance.lt(requiredAmountInWei)) {
        const shortfall = ethers.utils.formatEther(requiredAmountInWei.sub(currentBalance));
        toast.error(`Insufficient balance. You need ${shortfall} more ${getCurrentCurrency()} tokens.`);
        return;
      }
    } catch (balanceError) {
      console.error("Balance check error:", balanceError);
      toast.error("Unable to verify balance. Please try again.");
      return;
    }

    // Calculate costs for server (maintaining backward compatibility)
    const rewardPerScoreRounded = parseFloat(parseFloat(rewardPerScore).toFixed(18));
    const rewardPerScoreInWei = ethers.utils.parseUnits(
      rewardPerScoreRounded.toString(),
      18
    );
    const totalCost = rewardPerScoreInWei
      .mul(numParticipants)
      .mul(questionCount)
      .mul(ethers.BigNumber.from("110"))
      .div(ethers.BigNumber.from("100"));

    try {
      setLoading(true);

      let dataToSubmit;
      let headers;

      if (type === "pdf") {
        dataToSubmit = new FormData();
        dataToSubmit.append("creatorName", creatorName);
        dataToSubmit.append("creatorWallet", walletAddress);
        dataToSubmit.append("numParticipants", numParticipants);
        dataToSubmit.append("pdf", pdfFile);
        dataToSubmit.append("questionCount", questionCount);
        dataToSubmit.append("rewardPerScore", rewardPerScoreInWei.toString());
        dataToSubmit.append("totalCost", totalCost.toString());
        dataToSubmit.append("isPublic", false);
        headers = { "Content-Type": "multipart/form-data" };
      } else {
        dataToSubmit = {
          creatorName,
          ...(type === "prompt" && { title, prompt }),
          ...(type === "url" && { websiteUrl }),
          ...(type === "video" && { ytVideoUrl }),
          numParticipants: parseInt(numParticipants),
          questionCount: parseInt(questionCount),
          rewardPerScore: rewardPerScoreInWei.toString(),
          creatorWallet: walletAddress,
          totalCost: totalCost.toString(),
          ...(type === "url" && { isPublic: false }),
        };
        headers = { "Content-Type": "application/json" };
      }

      console.log('📤 Sending data to server:', dataToSubmit);
      const response = await axios.post(config.endpoint, dataToSubmit, { headers });

      setQuizCreated(true);
      const quizId = response.data.quizId;
      setQuizId(quizId);

      if (authenticated && walletAddress) {
        // Balance already verified above, proceed with blockchain transaction
        const signer = await getContractSigner();
        const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI.abi, signer);
        const budget = ethers.BigNumber.from(totalCost.toString());

        console.log('🔥 Creating game with budget:', ethers.utils.formatEther(budget), getCurrentCurrency());

        const tx = await contract.createGame({ value: budget });
        const receipt = await tx.wait();
        const gameId = receipt.events.find(
          (event) => event.event === "GameCreated"
        ).args.gameId;

        console.log("✅ New Game ID:", gameId.toString());
        await axios.put(`/api/quiz/update/${quizId}`, { gameId });

        toast.success("🎉 Quiz successfully created and funded!");

        // Reset form
        setFormData({
          creatorName: "",
          title: type === "prompt" ? "" : undefined,
          prompt: type === "prompt" ? "" : undefined,
          websiteUrl: type === "url" ? "" : undefined,
          ytVideoUrl: type === "video" ? "" : undefined,
          numParticipants: "",
          questionCount: "",
          rewardPerScore: "",
        });

        if (type === "pdf") {
          setPdfFile(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        }

        setLoading(false);
        setOpen(true);
      } else {
        toast.error("Please connect your wallet to continue.");
        connectWallet();
      }
    } catch (error) {
      console.error("Full error object:", error);
      const errorMessage = error.response?.data?.message || error.message || "An error occurred while creating the quiz";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleDownload = () => {
    const svg = qrRef.current.querySelector("svg");
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], {
      type: "image/svg+xml;charset=utf-8",
    });
    const svgUrl = URL.createObjectURL(svgBlob);
    const downloadLink = document.createElement("a");
    downloadLink.href = svgUrl;
    downloadLink.download = `quiz-${quizId}.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  const handleCopy = () => {
    const sanitizedQuizId = sanitizeGameId(quizId);
    if (sanitizedQuizId) {
      navigator.clipboard.writeText(`${baseUrl}/quiz/${sanitizedQuizId}`);
      toast.success("Link copied to clipboard");
    } else {
      toast.error("Invalid quiz ID");
    }
  };

  const handleStartQuiz = async () => {
    try {
      await axios.put(`/api/quiz/update/${quizId}`, { isPublic: true });
      setIsPublic(true);
      toast.success("Quiz has started");
    } catch (error) {
      toast.error("Failed to start the quiz");
      console.log(error);
    }
  };

  const handleStopQuiz = async () => {
    setStartDisabled(true);
    try {
      const response = await axios.put(`/api/quiz/update/${quizId}`, {
        isPublic: false,
        isFinished: true,
      });

      const { gameId, participants } = response.data;
      let rewards = response.data.rewards;

      if (
        !gameId ||
        !participants ||
        !rewards ||
        participants.length !== rewards.length
      ) {
        toast.error("Invalid data received from the server");
        setStartDisabled(false);
        return;
      }

      setIsPublic(false);
      setCloseDisabled(false);

      if (authenticated && walletAddress) {
        try {
          const signer = await getContractSigner();
          const contract = new ethers.Contract(
            CONTRACT_ADDRESS,
            ABI.abi,
            signer
          );

          rewards = rewards.map((reward) => reward / 1e18);
          rewards = rewards.map((reward) =>
            ethers.utils.parseEther(reward.toString())
          );

          const tx = await contract.endGame(gameId, participants, rewards);
          await tx.wait();

          toast.success("Game has ended successfully");
          setOpen(false);
          setStartDisabled(false);
          setIsPublic(false);
          setCloseDisabled(true);
          setQuizCreated(false);
        } catch (error) {
          console.error("Error ending the game:", error);
          toast.error("An error occurred while ending the game");
        }
      } else {
        toast.error("Please connect your wallet to continue.");
        connectWallet();
      }
    } catch (error) {
      toast.error("Failed to end the quiz");
      console.error(error);
    } finally {
      setStartDisabled(false);
    }
  };

  const fetchParticipants = async () => {
    try {
      const response = await axios.get(`/api/quiz/leaderboards/${quizId}`);
      setParticipants(response.data.participants || []);
    } catch (error) {
      console.error("Failed to fetch participants:", error);
    }
  };

  useEffect(() => {
    if (quizCreated && quizId) {
      fetchParticipants();
      // Poll for live updates every 3 seconds
      const interval = setInterval(fetchParticipants, 3000);
      return () => clearInterval(interval);
    }
  }, [quizId, quizCreated]);

  const config = getQuizConfig();
  const IconComponent = config.icon;

  // Show ConnectWallet component if wallet is not connected
  if (!authenticated || !walletAddress) {
    return (
      <ConnectWallet
        connectWallet={connectWallet}
        icon={IconComponent}
        title={`Connect Wallet to ${config.title}`}
        description="Please connect your wallet to create quizzes and manage rewards"
      />
    );
  }

  const renderTypeSpecificFields = () => {
    switch (type) {
      case "prompt":
        return (
          <>
            <div className="space-y-2">
              <label className="text-white text-sm font-medium">
                Quiz Title
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                className="w-full px-4 py-2 md:py-3 bg-white/10 border border-white/20 rounded-lg md:rounded-xl text-white placeholder-red-200 focus:outline-none focus:ring-2 focus:ring-red-400"
                placeholder="Enter quiz title"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-white text-sm font-medium flex items-center gap-2">
                <Wand2 size={16} />
                Description
              </label>
              <textarea
                name="prompt"
                value={formData.prompt}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg md:rounded-xl text-white placeholder-red-200 focus:outline-none focus:ring-2 focus:ring-red-400 min-h-[100px]"
                placeholder="Describe your quiz in detail..."
                required
              />
            </div>
          </>
        );

      case "url":
        return (
          <div className="space-y-2">
            <label className="text-white text-sm font-medium flex items-center gap-2">
              <Globe size={16} />
              Website URL
            </label>
            <input
              type="url"
              name="websiteUrl"
              value={formData.websiteUrl}
              onChange={handleChange}
              className="w-full px-4 py-2 md:py-3 bg-white/10 border border-white/20 rounded-md md:rounded-xl text-white placeholder-red-200 focus:outline-none focus:ring-2 focus:ring-red-400"
              placeholder="e.g., https://example.com/info"
              required
            />
          </div>
        );

      case "video":
        return (
          <div className="space-y-2">
            <label className="text-white text-sm font-medium flex items-center gap-2">
              <Globe size={16} />
              Youtube Video URL
            </label>
            <input
              type="url"
              name="ytVideoUrl"
              value={formData.ytVideoUrl}
              onChange={handleChange}
              className="w-full px-4 py-2 md:py-3 bg-white/10 border border-white/20 rounded-lg md:rounded-xl text-white placeholder-red-200 focus:outline-none focus:ring-2 focus:ring-red-400"
              placeholder="e.g., https://www.youtube.com/watch?v=gmaKoSjL0BU"
              required
            />
          </div>
        );

      case "pdf":
        return (
          <div className="space-y-2">
            <label className="text-white text-sm font-medium flex items-center gap-2">
              <FileText size={16} />
              PDF Document
            </label>
            <div className="relative">
              <input
                id="pdf-upload"
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                className="hidden"
                required
                ref={fileInputRef}
              />
              <label
                htmlFor="pdf-upload"
                className="w-full px-4 py-2 md:py-3 bg-white/10 border border-white/20 rounded-lg md:rounded-xl text-white flex items-center justify-center gap-2 cursor-pointer hover:bg-white/20 transition-colors"
              >
                <Upload size={20} />
                {pdfFile ? sanitizeFilename(pdfFile.name) : "Choose PDF File"}
              </label>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex items-center justify-center min-h-full">
      <div className="max-w-4xl mx-auto">
        <div className="text-center space-y-4 mb-8">
          <h1 className="text-2xl md:text-5xl font-bold text-white">
            {config.title.split(config.highlight)[0]}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-pink-400">
              {config.highlight}
            </span>
            {config.title.split(config.highlight)[1]}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 text-sm md:text-md">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 shadow-xl">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-white text-sm font-medium">
                  Creator Name
                </label>
                <input
                  type="text"
                  name="creatorName"
                  value={formData.creatorName}
                  onChange={handleChange}
                  className="w-full px-4 py-2 md:py-3 bg-white/10 border border-white/20 rounded-lg md:rounded-xl text-white placeholder-red-200 focus:outline-none focus:ring-2 focus:ring-red-400"
                  placeholder="Enter your name"
                  required
                />
              </div>

              {(type === "prompt" || type === "pdf") && renderTypeSpecificFields()}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-white text-sm font-medium flex items-center gap-2">
                    <Users size={16} />
                    Participants
                  </label>
                  <input
                    type="number"
                    name="numParticipants"
                    value={formData.numParticipants}
                    onChange={handleChange}
                    className="w-full px-4 py-2 md:py-3 bg-white/10 border border-white/20 rounded-lg md:rounded-xl text-white placeholder-red-200 focus:outline-none focus:ring-2 focus:ring-red-400"
                    placeholder="Number of participants"
                    min="1"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-white text-sm font-medium flex items-center gap-2">
                    <HelpCircle size={16} />
                    Questions
                  </label>
                  <input
                    type="number"
                    name="questionCount"
                    value={formData.questionCount}
                    onChange={handleChange}
                    className="w-full px-4 py-2 md:py-3 bg-white/10 border border-white/20 rounded-lg md:rounded-xl text-white placeholder-red-200 focus:outline-none focus:ring-2 focus:ring-red-400"
                    placeholder="Number of questions"
                    min="1"
                    max="30"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-white text-sm font-medium flex items-center gap-2">
                    <Trophy size={16} />
                    Reward
                  </label>
                  <input
                    type="number"
                    name="rewardPerScore"
                    value={formData.rewardPerScore}
                    onChange={handleChange}
                    className="w-full px-4 py-2 md:py-3 bg-white/10 border border-white/20 rounded-lg md:rounded-xl text-white placeholder-red-200 focus:outline-none focus:ring-2 focus:ring-red-400"
                    placeholder="Reward per score"
                    min="0.0001"
                    step="0.0001"
                    required
                  />
                </div>
              </div>

              {(type === "url" || type === "video") && renderTypeSpecificFields()}

              {/* Cost Display Component */}
              <QuizCostDisplay
                numParticipants={formData.numParticipants}
                questionCount={formData.questionCount}
                rewardPerScore={formData.rewardPerScore}
                onCostCalculated={handleCostCalculated}
                disabled={loading}
              />

              <button
                type="submit"
                disabled={loading || !costValidation.isValid}
                className="w-full px-6 py-3 md:py-4 bg-gradient-to-r from-red-500 to-pink-500 rounded-lg md:rounded-xl text-white font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  <>
                    <IconComponent size={20} />
                    {costValidation.isValid ? 'Create Quiz' : 'Insufficient Balance'}
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        <Dialog
          open={open}
          onClose={(_, reason) =>
            reason === "backdropClick" ? null : handleClose
          }
          maxWidth="md"
          fullWidth
          PaperProps={{
            style: {
              backgroundColor: "#7f1d1d",
              borderRadius: "1rem",
              border: "1px solid rgba(255, 255, 255, 0.1)",
            },
          }}
        >
          <DialogContent>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="flex flex-col items-center gap-6" ref={qrRef}>
                <h2 className="text-xl md:text-2xl font-bold text-white">
                  Quiz ID: <span className="text-red-400">{sanitizeGameId(quizId) || 'Invalid ID'}</span>
                </h2>
                <div className="bg-white p-4 rounded-xl">
                  <QRCodeSVG
                    value={`${baseUrl}/quiz/${sanitizeGameId(quizId) || 'invalid'}`}
                    className="w-48 h-48 sm:w-48 sm:h-48 md:w-64 md:h-64 lg:w-72 lg:h-72"
                  />
                </div>
                <TextField
                  value={`${baseUrl}/quiz/${sanitizeGameId(quizId) || 'invalid'}`}
                  slotProps={{
                    input: {
                      readOnly: true,
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={handleCopy}>
                            <Copy className="text-red-400" size={20} />
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                  fullWidth
                  sx={{
                    "& .MuiInputBase-root": {
                      color: "white",
                      backgroundColor: "rgba(255, 255, 255, 0.1)",
                    },
                  }}
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl md:text-2xl font-bold text-white">
                    Participants
                  </h2>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-sm text-gray-300">Live Updates</span>
                  </div>
                </div>
                <div className="bg-white/10 rounded-xl p-4 max-h-[300px] overflow-y-auto">
                  {participants.map((participant) => (
                    <div
                      key={participant.user.walletAddress}
                      className="flex justify-between items-center py-2 px-4 border-b border-white/10 text-white"
                    >
                      <span className="flex items-center gap-2">
                        {participant.user.name}
                        {participant.isCompleted && (
                          <span className="text-green-400 text-sm">✓ Completed</span>
                        )}
                      </span>
                      <span className="font-mono flex items-center gap-2">
                        {participant.isCompleted ? (
                          <span className="text-green-400">{participant.score}</span>
                        ) : (
                          <span className="text-yellow-400">{participant.score}</span>
                        )}
                        {!participant.isCompleted && (
                          <span className="text-xs text-gray-400">Live</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </DialogContent>

          <DialogActions className="p-4 bg-white/5">
            <IconButton onClick={handleDownload} className="text-red-400">
              <Download size={20} style={{ color: "white" }} />
            </IconButton>
            <Button
              onClick={handleClose}
              disabled={closeDisabled}
              color="white"
            >
              Close
            </Button>
            <Button
              onClick={handleStartQuiz}
              disabled={isPublic || loading || startDisabled}
              color="white"
              className="bg-gradient-to-r from-red-500 to-pink-500 text-white px-4 py-2 rounded-lg"
            >
              Start Quiz
            </Button>
            <Button
              onClick={handleStopQuiz}
              disabled={!isPublic || loading}
              color="white"
              className="bg-gradient-to-r from-red-500 to-pink-500 text-white px-4 py-2 rounded-lg"
            >
              Stop Quiz
            </Button>
          </DialogActions>
        </Dialog>
      </div>
    </div>
  );
};

export default QuizCreation;