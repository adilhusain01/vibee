import { useState, useContext, useRef, useEffect } from "react";
import { WalletContext } from "../context/WalletContext";
import toast from "react-hot-toast";
import axios from "../api/axios";
import { ethers } from "ethers";
import { QRCodeSVG } from "qrcode.react";
import ABI from "../utils/abi.json";
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
import { Download, Copy, Users, BookOpen, Trophy, Brain } from "lucide-react";

const FactCheckingGame = () => {
  const { walletAddress } = useContext(WalletContext);
  const [formData, setFormData] = useState({
    creatorName: "",
    topic: "",
    numParticipants: "",
    factsCount: "",
    rewardPerScore: "",
    difficulty: "medium",
  });
  const [factCheckId, setFactCheckId] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [startDisabled, setStartDisabled] = useState(false);
  const [closeDisabled, setCloseDisabled] = useState(true);
  const qrRef = useRef();
  const [factCheckCreated, setFactCheckCreated] = useState(false);
  const baseUrl = import.meta.env.VITE_CLIENT_URI;
  const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!walletAddress) {
      toast.error("Please connect your wallet");
      return;
    }

    const {
      creatorName,
      topic,
      numParticipants,
      factsCount,
      rewardPerScore,
      difficulty,
    } = formData;

    if (
      !creatorName ||
      !topic ||
      !numParticipants ||
      !factsCount ||
      !rewardPerScore ||
      !difficulty
    ) {
      toast.error("All fields are required");
      return;
    }

    if (factsCount > 30) {
      toast.error("Facts count cannot be more than 30");
      return;
    }

    const rewardPerScoreInWei = ethers.utils.parseUnits(
      rewardPerScore.toString(),
                                                        18
    );
    const totalCost = rewardPerScoreInWei
    .mul(numParticipants)
    .mul(factsCount)
    .mul(ethers.BigNumber.from("110"))
    .div(ethers.BigNumber.from("100"));

    try {
      const dataToSubmit = {
        creatorName,
        topic,
        numParticipants,
        factsCount,
        rewardPerScore: rewardPerScoreInWei.toString(),
        creatorWallet: walletAddress,
        totalCost: totalCost.toString(),
        difficulty,
      };

      setLoading(true);

      const response = await axios.post(
        `/api/fact-check/create/challenge`,
        dataToSubmit,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      console.log(response.data);

      setFactCheckCreated(true);

      const factCheckId = response.data.factCheckId;
      setFactCheckId(factCheckId);
      console.log(factCheckId);

      if (typeof window.ethereum !== "undefined") {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI.abi, signer);
        const budget = ethers.BigNumber.from(totalCost.toString());
        const tx = await contract.createGame({ value: budget });
        const receipt = await tx.wait();
        const gameId = receipt.events.find(
          (event) => event.event === "GameCreated"
        ).args.gameId;

        console.log("New Game ID:", gameId.toString());
        await axios.put(`/api/fact-check/update/${factCheckId}`, { gameId });

        toast.success("Fact checking game created successfully");
        setFormData({
          creatorName: "",
          topic: "",
          numParticipants: "",
          factsCount: "",
          rewardPerScore: "",
          difficulty: "medium",
        });

        setLoading(false);
        setOpen(true);
      } else {
        toast.error("Metamask not found. Please install Metamask");
      }
    } catch (error) {
      console.error(error);
      toast.error(
        error.response?.data?.message ||
        "An error occurred while creating the game"
      );
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
    downloadLink.download = `fact-check-${factCheckId}.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(`${baseUrl}/fact-check/${factCheckId}`);
    toast.success("Link copied to clipboard");
  };

  const handleStartGame = async () => {
    try {
      await axios.put(`/api/fact-check/update/${factCheckId}`, {
        isPublic: true,
      });
      setIsPublic(true);
      toast.success("Game has started");
    } catch (error) {
      toast.error("Failed to start the game");
      console.log(error);
    }
  };

  const handleStopGame = async () => {
    setStartDisabled(true);
    try {
      const response = await axios.put(
        `/api/fact-check/update/${factCheckId}`,
        {
          isPublic: false,
          isFinished: true,
        }
      );

      console.log(response);

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

      if (typeof window.ethereum !== "undefined") {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI.abi, signer);

        const normalizedRewards = rewards.map(
          (reward) => reward / 1000000000000000000
        );
        rewards = normalizedRewards.map((reward) =>
        ethers.utils.parseEther(reward.toString())
        );

        const tx = await contract.endGame(gameId, participants, rewards);
        await tx.wait();

        toast.success("Game has ended successfully");
        setOpen(false);
        setStartDisabled(false);
        setIsPublic(false);
        setCloseDisabled(true);
        setFactCheckCreated(false);
      } else {
        toast.error("MetaMask not found. Please install MetaMask.");
      }
    } catch (error) {
      toast.error("Failed to end the game");
      console.error(error);
    } finally {
      setStartDisabled(false);
    }
  };

  const fetchParticipants = async () => {
    try {
      const response = await axios.get(
        `/api/fact-check/leaderboards/${factCheckId}`
      );
      setParticipants(response.data.participants || []);
    } catch (error) {
      console.error("Failed to fetch participants:", error);
    }
  };

  useEffect(() => {
    if (factCheckCreated && factCheckId) {
      fetchParticipants();
      const interval = setInterval(fetchParticipants, 1000);
      return () => clearInterval(interval);
    }
  }, [factCheckId, factCheckCreated]);

  return (
    <div
    className="flex items-center justify-center"
    style={{ height: "calc(100vh - 6rem)" }}
    >
    <div className="max-w-4xl mx-auto">
    <div className="text-center space-y-4 mb-8">
    <h1 className="text-2xl md:text-5xl font-bold text-white">
    Create Fact Checking &nbsp;
    <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-pink-400">
    Game
    </span>
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
    <BookOpen size={16} />
    Facts
    </label>
    <input
    type="number"
    name="factsCount"
    value={formData.factsCount}
    onChange={handleChange}
    className="w-full px-4 py-2 md:py-3 bg-white/10 border border-white/20 rounded-lg md:rounded-xl text-white placeholder-red-200 focus:outline-none focus:ring-2 focus:ring-red-400"
    placeholder="Number of facts"
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
    required
    />
    </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div className="space-y-2">
    <label className="text-white text-sm font-medium flex items-center gap-2">
    <Brain size={16} />
    Topic
    </label>
    <input
    type="text"
    name="topic"
    value={formData.topic}
    onChange={handleChange}
    className="w-full px-4 py-2 md:py-3 bg-white/10 border border-white/20 rounded-lg md:rounded-xl text-white placeholder-red-200 focus:outline-none focus:ring-2 focus:ring-red-400"
    placeholder="Enter topic (e.g., 'Space', 'History')"
    required
    />
    </div>

    <div className="space-y-2">
    <label className="text-white text-sm font-medium">
    Difficulty
    </label>
    <select
    name="difficulty"
    value={formData.difficulty}
    onChange={handleChange}
    className="w-full px-4 py-2 md:py-3 bg-white/10 border border-white/20 rounded-lg md:rounded-xl text-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-400"
    >
    <option value="easy" className="bg-red-900">
    Easy
    </option>
    <option value="medium" className="bg-red-900">
    Medium
    </option>
    <option value="hard" className="bg-red-900">
    Hard
    </option>
    </select>
    </div>
    </div>

    <button
    type="submit"
    disabled={loading}
    className="w-full px-6 py-3 md:py-4 bg-gradient-to-r from-red-500 to-pink-500 rounded-lg md:rounded-xl text-white font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
    >
    {loading ? (
      <CircularProgress size={24} color="inherit" />
    ) : (
      <>
      <Brain size={20} />
      Create Game
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
    Game ID: <span className="text-red-400">{factCheckId}</span>
    </h2>
    <div className="bg-white p-4 rounded-xl">
    <QRCodeSVG
    value={`${baseUrl}/fact-check/${factCheckId}`}
    className="w-48 h-48 sm:w-48 sm:h-48 md:w-64 md:h-64 lg:w-72 lg:h-72"
    />
    </div>
    <TextField
    value={`${baseUrl}/fact-check/${factCheckId}`}
    InputProps={{
      readOnly: true,
      endAdornment: (
        <InputAdornment position="end">
        <IconButton onClick={handleCopy}>
        <Copy className="text-red-400" size={20} />
        </IconButton>
        </InputAdornment>
      ),
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
    <h2 className="text-xl md:text-2xl font-bold text-white text-center">
    Participants
    </h2>
    <div className="bg-white/10 rounded-xl p-4 max-h-[300px] overflow-y-auto">
    {participants.map((participant) => (
      <div
      key={participant.walletAddress}
      className="flex justify-between items-center py-2 px-4 border-b border-white/10 text-white"
      >
      <span>{participant.participantName}</span>
      <span className="font-mono">
      {participant.score !== null ? participant.score : "N/A"}
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
    color="inherit"
    className="text-white"
    >
    Close
    </Button>
    <Button
    onClick={handleStartGame}
    disabled={isPublic || loading || startDisabled}
    color="inherit"
    className="bg-gradient-to-r from-red-500 to-pink-500 text-white px-4 py-2 rounded-lg"
    >
    Start Game
    </Button>
    <Button
    onClick={handleStopGame}
    disabled={!isPublic || loading}
    color="inherit"
    className="bg-gradient-to-r from-red-500 to-pink-500 text-white px-4 py-2 rounded-lg"
    >
    Stop Game
    </Button>
    </DialogActions>
    </Dialog>
    </div>
    </div>
  );
};

export default FactCheckingGame;
