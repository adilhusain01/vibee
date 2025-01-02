import { useState, useEffect, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { WalletContext } from "../context/WalletContext";
import toast from "react-hot-toast";
import axios from "../api/axios";
import { Dialog, DialogContent } from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";
import {
    Timer,
    ArrowRight,
    CheckCircle2,
    RefreshCcw,
    Trophy,
    Loader2,
} from "lucide-react";

const FactCheck = () => {
    const { id } = useParams();
    const { walletAddress, connectWallet } = useContext(WalletContext);
    const [loading, setLoading] = useState(true);
    const [factCheck, setFactCheck] = useState(null);
    const [factCheckCreator, setFactCheckCreator] = useState("");
    const [currentFactIndex, setCurrentFactIndex] = useState(0);
    const [answers, setAnswers] = useState({});
    const [participantName, setParticipantName] = useState("");
    const [nameDialogOpen, setNameDialogOpen] = useState(true);
    const [timer, setTimer] = useState(30);
    const [userJoined, setUserJoined] = useState(false);
    const [factCheckStarted, setFactCheckStarted] = useState(false);
    const [factCheckEnded, setFactCheckEnded] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const navigate = useNavigate();
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    useEffect(() => {
        const fetchFactCheck = async () => {
            if (!walletAddress) {
                toast.error("Please connect your wallet first.");
                await connectWallet();
                return;
            }

            try {
                const response = await axios.post(
                    `/api/fact-check/verify/${id}`,
                    { walletAddress },
                    {
                        headers: {
                            "Content-Type": "application/json",
                        },
                    }
                );

                console.log(response.data);

                setFactCheck(response.data);
                setFactCheckStarted(response.data.isPublic);
                setFactCheckEnded(response.data.isFinished);
                setFactCheckCreator(response.data.creatorName);
                setLoading(false);
            } catch (err) {
                setError(err.response?.data?.error);
                console.log(err);

                if (err.response?.status === 404) setMessage("Fact Check not found");
                setLoading(false);

                toast.error(
                    err.response?.data?.error ||
                    "An error occurred while fetching the fact check."
                );
            }
        };

        fetchFactCheck();
        loadAllFactChecks(); // Ensure loadAllFactChecks is awaited
    }, [id, walletAddress, connectWallet]);

    useEffect(() => {
        let interval;
        if (factCheckStarted && !isSubmitting && !factCheckEnded && userJoined) {
            interval = setInterval(() => {
                setTimer((prevTimer) => {
                    if (prevTimer <= 1) {
                        handleNextFact();
                        return 30;
                    }
                    return prevTimer - 1;
                });
            }, 1000);
        }

        return () => clearInterval(interval);
    }, [
        factCheckStarted,
        currentFactIndex,
        isSubmitting,
        factCheckEnded,
        userJoined,
    ]);

    const handleAnswerChange = (factId, answer) => {
        if (isSubmitting || !userJoined) return; // Prevent answer changes during submission
        setAnswers({
            ...answers,
            [factId]: answer,
        });
    };

    const handleNextFact = () => {
        if (isSubmitting || !userJoined) return;

        const currentFact = factCheck.facts[currentFactIndex];
        if (!answers[currentFact._id]) {
            setAnswers({
                ...answers,
                [currentFact._id]: "no_answer",
            });
        }
        setTimer(30);
        if (currentFactIndex < factCheck.facts.length - 1) {
            setCurrentFactIndex(currentFactIndex + 1);
        } else {
            handleSubmitFactCheck();
        }
    };

    const handleJoinFactCheck = async () => {
        try {
            await axios.post(
                `/api/fact-check/join/${id}`,
                {
                    walletAddress,
                    participantName,
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );
            toast.success("Joined fact check successfully!");
            await loadAllFactChecks();
            setNameDialogOpen(false);
            setUserJoined(true);
            setTimer(30);
            setFactCheckStarted(true); // Start the fact check and timer
        } catch (err) {
            toast.error(
                err.response?.data?.error ||
                "An error occurred while joining the fact check."
            );
        }
    };

    const handleSubmitFactCheck = async () => {
        setIsSubmitting(true);
        try {
            // 1. First, submit fact check answers to API
            const factCheckSubmissionResponse = await axios.post(
                "/api/fact-check/submit",
                {
                    factCheckId: id,
                    walletAddress,
                    answers,
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );

            toast.success("Fact check score submitted successfully!");

            // 8. Navigate to leaderboards
            navigate(`/fact-check-leaderboards/${id}`);
        } catch (err) {
            console.error(err);
            toast.error(
                err.response?.data?.error ||
                "An error occurred while submitting the fact check."
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const loadAllFactChecks = async () => {
        try {
            toast.success("Fact checks loaded successfully");
        } catch (error) {
            console.error(error);
            toast.error("Failed to load fact checks");
        }
    };

    const handleNameSubmit = () => {
        if (!participantName) {
            toast.error("Please enter your name.");
            return;
        }
        handleJoinFactCheck();
    };

    if (loading) {
        return (
            <div
            className="flex items-center justify-center"
            style={{ height: "calc(100vh - 6rem)" }}
            >
            <Loader2 className="w-6 md:w-8 h-6 md:h-8 text-red-400 animate-spin" />
            </div>
        );
    }

    if (factCheckEnded) {
        return (
            <div
            className="flex items-center justify-center"
            style={{ height: "calc(100vh - 6rem)" }}
            >
            <div className="text-center space-y-4">
            <Trophy className="w-12 md:w-16 h-12 md:h-16 text-red-400 mx-auto" />
            <h1 className="text-2xl md:text-4xl font-bold text-white">
            Fact Check has ended
            </h1>
            <p className="text-red-200">
            Check the leaderboard to see the results
            </p>
            </div>
            </div>
        );
    }

    if (!factCheckStarted) {
        return (
            <div
            className="flex items-center justify-center"
            style={{ height: "calc(100vh - 6rem)" }}
            >
            <div className="text-center flex flex-col items-center justify-center space-y-6">
            <h1 className="text-2xl md:text-4xl font-bold text-white">
            {message.length > 0 ? message : "Fact Check hasn't started yet"}
            </h1>
            <p className="text-md md:text-lg text-red-200">
            {message.length > 0
                ? ""
                : "Please wait for the fact check to begin"}
                </p>
                <button
                onClick={() => window.location.reload()}
                className="text-md md:text-lg flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-500 to-pink-500 rounded-xl text-white font-medium hover:opacity-90 transition-opacity"
                >
                <RefreshCcw size={20} />
                Refresh
                </button>
                </div>
                </div>
        );
    }

    const currentFact = factCheck.facts[currentFactIndex];

    return (
        <div
        className="flex items-center justify-center px-4"
        style={{ height: "calc(100vh - 6rem)" }}
        >
        {/* Name Dialog remains the same */}
        <Dialog
        open={nameDialogOpen}
        PaperProps={{
            style: {
                backgroundColor: "#7f1d1d",
                borderRadius: "1rem",
                border: "1px solid rgba(255, 255, 255, 0.1)",
            maxWidth: "400px",
            width: "100%",
            },
        }}
        >
        <DialogContent
        className="space-y-4"
        style={{ backgroundColor: "#7f1d1d" }}
        >
        <h2 className="text-xl md:text-2xl font-bold text-white text-center">
        Welcome to the Fact Check
        </h2>
        <p className="text-md md:text-lg text-red-200 text-center">
        Please enter your name to begin
        </p>
        <input
        type="text"
        value={participantName}
        onChange={(e) => setParticipantName(e.target.value)}
        placeholder="Enter your name"
        className="w-full px-4 py-2 md:py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-red-200 focus:outline-none focus:ring-2 focus:ring-red-400"
        />
        <button
        onClick={handleNameSubmit}
        className="w-full px-6 py-2 md:py-3 bg-gradient-to-r from-red-500 to-pink-500 rounded-xl text-white font-medium hover:opacity-90 transition-opacity"
        >
        Start Fact Check
        </button>
        </DialogContent>
        </Dialog>

        {/* Main Fact Check Container */}
        {userJoined ? (
            <div className="w-full max-w-4xl">
            <AnimatePresence mode="wait">
            <motion.div
            key={currentFactIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 shadow-xl space-y-6"
            >
            {/* Timer and Progress - Only show if not submitting */}
            {!isSubmitting && (
                <div className="space-y-2">
                <div className="flex items-center justify-between">
                <span className="text-red-200">
                Fact {currentFactIndex + 1} of {factCheck?.facts?.length}
                </span>
                <div className="flex items-center gap-2 text-white">
                <Timer size={20} className="text-red-400" />
                <span className="font-medium">{timer}s</span>
                </div>
                </div>
                <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                initial={{ width: "100%" }}
                animate={{ width: `${(timer / 30) * 100}%` }}
                transition={{ duration: 1, ease: "linear" }}
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-red-500 to-pink-500"
                />
                </div>
                </div>
            )}

            {/* Show loading state during submission */}
            {isSubmitting ? (
                <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <Loader2 className="w-12 h-12 text-red-400 animate-spin" />
                <p className="text-white text-xl font-medium">
                Submitting Fact Check...
                </p>
                <p className="text-red-200 text-center">
                Please wait while we process your submission
                </p>
                </div>
            ) : (
                <>
                {/* Fact */}
                <h2 className="text-lg md:text-2xl font-bold text-white">
                {currentFact.statement}
                </h2>

                {/* Options Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {["true", "false"].map((option) => (
                    <motion.button
                    key={option}
                    onClick={() =>
                        handleAnswerChange(currentFact._id, option)
                    }
                    className={`relative p-3 md:p-6 text-md md:text-lg text-left rounded-lg md:rounded-xl border transition-all ${
                        answers[currentFact._id] === option
                        ? "bg-red-500/20 border-red-400"
                        : "bg-white/5 border-white/10 hover:bg-white/10"
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    >
                    <span className="text-white font-medium">
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                    </span>
                    {answers[currentFact._id] === option && (
                        <CheckCircle2
                        className="absolute top-4 right-4 text-red-400"
                        size={24}
                        />
                    )}
                    </motion.button>
                ))}
                </div>

                {/* Navigation */}
                <div className="flex justify-end">
                <button
                onClick={handleNextFact}
                disabled={!answers[currentFact._id]}
                className={`flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 rounded-lg md:rounded-xl font-medium transition-all ${
                    answers[currentFact._id]
                    ? "bg-gradient-to-r from-red-500 to-pink-500 text-white hover:opacity-90"
                    : "bg-white/10 text-white/50 cursor-not-allowed"
                }`}
                >
                {currentFactIndex < factCheck.facts.length - 1
                    ? "Next Fact"
                    : "Submit Fact Check"}
                    <ArrowRight size={20} />
                    </button>
                    </div>
                    </>
            )}
            </motion.div>
            </AnimatePresence>
            </div>
        ) : (
            <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold text-white">
            Please enter your name to start the fact check
            </h2>
            <p className="text-red-200">Your timer will begin after you join</p>
            </div>
        )}
        </div>
    );
};

export default FactCheck;
