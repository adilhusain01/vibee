import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { usePrivyAuth } from "../context/PrivyAuthContext";
import toast from "react-hot-toast";
import axios from "../api/axios";
import { Dialog, DialogContent } from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";
import ConnectWallet from "../components/ConnectWallet";
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
    const { walletAddress, connectWallet, authenticated } = usePrivyAuth();
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
    const [isProcessingAnswer, setIsProcessingAnswer] = useState(false);
    const navigate = useNavigate();
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    useEffect(() => {
        let isCancelled = false;

        // Reset all state when fact-check ID changes
        setFactCheck(null);
        setFactCheckCreator("");
        setCurrentFactIndex(0);
        setAnswers({});
        setParticipantName("");
        setNameDialogOpen(true);
        setTimer(30);
        setUserJoined(false);
        setFactCheckStarted(false);
        setFactCheckEnded(false);
        setIsSubmitting(false);
        setIsProcessingAnswer(false);
        setError("");
        setMessage("");
        setLoading(true);

        const fetchFactCheck = async () => {
            // Only proceed if we have authentication and wallet address
            if (!authenticated || !walletAddress) {
                // Don't show toast on initial load or when auth is changing
                setLoading(false);
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

                if (!isCancelled) {
                    setFactCheck(response.data);
                    setFactCheckStarted(response.data.isPublic);
                    setFactCheckEnded(response.data.isFinished);
                    setFactCheckCreator(response.data.creatorName);
                    setLoading(false);
                }
            } catch (err) {
                if (!isCancelled) {
                    setError(err.response?.data?.error);
                    console.log(err);

                    if (err.response?.status === 404) setMessage("Fact Check not found");
                    setLoading(false);

                    toast.error(
                        err.response?.data?.error ||
                        "An error occurred while fetching the fact check."
                    );
                }
            }
        };

        // Only fetch if we have the required data
        if (authenticated && walletAddress) {
            fetchFactCheck();
            loadAllFactChecks();
        } else {
            setLoading(false);
        }

        return () => {
            isCancelled = true;
        };
    }, [id, walletAddress, authenticated]);

    useEffect(() => {
        let interval;
        if (factCheckStarted && !isSubmitting && !isProcessingAnswer && !factCheckEnded && userJoined) {
            interval = setInterval(() => {
                setTimer((prevTimer) => {
                    if (prevTimer <= 1) {
                        // Handle timer expiry inline to avoid circular dependency
                        setTimeout(() => {
                            // Prevent race condition by checking flags
                            setIsProcessingAnswer(prev => {
                                if (prev) return prev; // Already processing, abort

                                if (factCheck && factCheck.facts) {
                                    const currentFact = factCheck.facts[currentFactIndex];
                                    if (currentFact) {
                                        let finalAnswer = answers[currentFact._id];

                                        if (!finalAnswer) {
                                            finalAnswer = "no_answer";
                                            setAnswers(prevAnswers => ({
                                                ...prevAnswers,
                                                [currentFact._id]: "no_answer",
                                            }));
                                        }

                                        // Submit current answer and handle next step
                                        const handleTimerExpiry = async () => {
                                            try {
                                                // Submit current answer
                                                if (finalAnswer && finalAnswer !== "no_answer") {
                                                    await axios.post('/api/fact-check/answer', {
                                                        factCheckId: id,
                                                        factId: currentFact._id,
                                                        answer: finalAnswer,
                                                        walletAddress
                                                    });
                                                }

                                                // Move to next fact or submit fact check
                                                if (currentFactIndex < (factCheck?.facts?.length || 0) - 1) {
                                                    setCurrentFactIndex(prev => prev + 1);
                                                    setTimer(30);
                                                    setIsProcessingAnswer(false);
                                                } else {
                                                    // Final submission
                                                    setIsSubmitting(true);
                                                    try {
                                                        await axios.post("/api/fact-check/submit", {
                                                            factCheckId: id,
                                                            walletAddress,
                                                        });
                                                        toast.success("Fact check score submitted successfully!");
                                                        navigate(`/fact-check-leaderboards/${id}`);
                                                    } catch (err) {
                                                        console.error(err);
                                                        toast.error("An error occurred while submitting the fact check.");
                                                    } finally {
                                                        setIsSubmitting(false);
                                                        setIsProcessingAnswer(false);
                                                    }
                                                }
                                            } catch (error) {
                                                console.error('Error in timer expiry:', error);
                                                setIsProcessingAnswer(false);
                                            }
                                        };

                                        handleTimerExpiry();
                                        return true; // Set processing flag
                                    }
                                }
                                return false; // No processing needed
                            });
                        }, 0);
                        return 30;
                    }
                    return prevTimer - 1;
                });
            }, 1000);
        }

        return () => clearInterval(interval);
    }, [factCheckStarted, currentFactIndex, isSubmitting, isProcessingAnswer, factCheckEnded, userJoined, factCheck, answers, id, walletAddress, navigate]);

    const handleAnswerChange = (factId, answer) => {
        if (isSubmitting || !userJoined) return;

        // Only update local state - don't submit yet
        setAnswers({
            ...answers,
            [factId]: answer,
        });
    };

    const submitCurrentAnswer = async (factId, answer) => {
        // Submit answer to update real-time score
        if (answer && answer !== "no_answer") {
            try {
                await axios.post('/api/fact-check/answer', {
                    factCheckId: id,
                    factId,
                    answer,
                    walletAddress
                });
            } catch (error) {
                console.error('Error submitting answer:', error);
            }
        }
    };

    const handleNextFact = async () => {
        if (isSubmitting || isProcessingAnswer || !userJoined) return;

        // Set processing flag to prevent race condition
        setIsProcessingAnswer(true);

        try {
            const currentFact = factCheck.facts[currentFactIndex];
            let finalAnswer = answers[currentFact._id];

            // Only set "no_answer" if no answer was selected for this fact
            if (!finalAnswer) {
                finalAnswer = "no_answer";
                setAnswers(prevAnswers => ({
                    ...prevAnswers,
                    [currentFact._id]: "no_answer",
                }));
            }

            // Submit the current answer for real-time scoring
            await submitCurrentAnswer(currentFact._id, finalAnswer);

            setTimer(30);
            if (currentFactIndex < (factCheck?.facts?.length || 0) - 1) {
                setCurrentFactIndex(currentFactIndex + 1);
                setIsProcessingAnswer(false);
            } else {
                // Final submission
                setIsSubmitting(true);
                try {
                    await axios.post(
                        "/api/fact-check/submit",
                        {
                            factCheckId: id,
                            walletAddress,
                        },
                        {
                            headers: {
                                "Content-Type": "application/json",
                            },
                        }
                    );

                    toast.success("Fact check score submitted successfully!");
                    navigate(`/fact-check-leaderboards/${id}`);
                } catch (err) {
                    console.error(err);
                    toast.error(
                        err.response?.data?.error ||
                        "An error occurred while submitting the fact check."
                    );
                } finally {
                    setIsSubmitting(false);
                    setIsProcessingAnswer(false);
                }
            }
        } catch (error) {
            console.error('Error in handleNextFact:', error);
            setIsProcessingAnswer(false);
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


    const loadAllFactChecks = async () => {
        // This function appears to be a placeholder
        // Removing toast notifications to prevent spam
        try {
            // Add actual fact check loading logic here if needed
            console.log("Fact check data refreshed");
        } catch (error) {
            console.error("Error refreshing fact check data:", error);
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

    if (!authenticated || !walletAddress) {
        return (
            <ConnectWallet
                connectWallet={connectWallet}
                icon={Timer}
                title="Connect Your Wallet"
                description="Please connect your wallet to participate in this fact check"
            />
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
                        {message.length > 0 ? "" : "Please wait for the fact check to begin"}
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
            {/* Name Dialog */}
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
                                            disabled={!answers[currentFact._id] || isProcessingAnswer}
                                            className={`flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 rounded-lg md:rounded-xl font-medium transition-all ${
                                                answers[currentFact._id] && !isProcessingAnswer
                                                    ? "bg-gradient-to-r from-red-500 to-pink-500 text-white hover:opacity-90"
                                                    : "bg-white/10 text-white/50 cursor-not-allowed"
                                            }`}
                                        >
                                            {currentFactIndex < (factCheck?.facts?.length || 0) - 1
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
