import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import toast from "react-hot-toast";
import axios from "../api/axios";
import { CircularProgress } from "@mui/material";
import { Search, Trophy, Users, HelpCircle, SortAsc } from "lucide-react";

const FactCheckLeaderBoards = () => {
    const { id } = useParams();
    const [loading, setLoading] = useState(true);
    const [factCheck, setFactCheck] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [sortOption, setSortOption] = useState("name");
    const [allParticipants, setAllParticipants] = useState([]);

    useEffect(() => {
        const fetchLeaderBoards = async () => {
            try {
                let response = await axios.get(`/api/fact-check/leaderboards/${id}`);
                if (!response || !response.data) {
                    throw new Error("Failed to fetch fact check leaderboard data");
                }
                setFactCheck(response.data.factCheck);
                setParticipants(response.data.participants || []);
                setAllParticipants(response.data.participants || []);
                console.log(response.data);
            } catch (error) {
                console.log(error);
                if (loading) {
                    toast.error("Failed to fetch leaderboard data");
                }
            } finally {
                setLoading(false);
            }
        };

        // Initial fetch
        fetchLeaderBoards();

        // Set up polling for real-time updates every 3 seconds
        const interval = setInterval(() => {
            fetchLeaderBoards();
        }, 3000);

        // Cleanup interval on unmount
        return () => clearInterval(interval);
    }, [id, loading]);

    const handleSortChange = (e) => {
        setSortOption(e.target.value);
    };

    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
        if (e.target.value.trim() === "") {
            setParticipants(allParticipants);
        } else {
            const filteredParticipants = allParticipants.filter((participant) =>
            participant.participantName
            .toLowerCase()
            .includes(e.target.value.toLowerCase())
            );
            setParticipants(filteredParticipants);
        }
    };

    const sortedParticipants = [...participants].sort((a, b) => {
        if (sortOption === "name") {
            const nameA = a.user?.name || a.participantName || 'Unknown';
            const nameB = b.user?.name || b.participantName || 'Unknown';
            return nameA.localeCompare(nameB);
        } else if (sortOption === "score") {
            return b.score - a.score;
        }
        return 0;
    });

    if (loading) {
        return (
            <div
            className="flex items-center justify-center"
            style={{ height: "calc(100vh - 6rem)" }}
            >
            <CircularProgress sx={{ color: "white" }} />
            </div>
        );
    }

    if (!factCheck) {
        return (
            <div
            className="flex items-center justify-center"
            style={{ height: "calc(100vh - 6rem)" }}
            >
            <h1 className="text-2xl md:text-4xl font-bold text-white">
            Fact Check not found!
            </h1>
            </div>
        );
    }

    return (
        <div
            className="flex items-center justify-center px-4"
            style={{ height: "calc(100vh - 6rem)" }}
        >
            <div className="max-w-4xl w-full mx-auto">
                <div className="text-center space-y-4 mb-8">
                    <h1 className="text-xl md:text-3xl lg:text-5xl font-bold text-white">
                        Fact Check Leaderboard &nbsp;
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-pink-400">
                            #{id}
                        </span>
                    </h1>
                    <div className="flex items-center justify-center gap-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                        <span className="text-sm text-gray-300">Live Updates</span>
                    </div>
                </div>

                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 md:p-8 border border-white/20 shadow-xl space-y-6">
                    {/* Fact Check Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex flex-row md:flex-col items-center justify-between md:items-start md:justify-start bg-white/5 p-3 md:p-4 rounded-xl border border-white/10">
                            <div className="flex items-center gap-2 text-white">
                                <HelpCircle size={16} className="md:hidden" />
                                <HelpCircle size={20} className="hidden md:block" />
                                <span className="text-sm font-medium">Facts</span>
                            </div>
                            <p className="text-xl md:text-2xl font-bold text-red-400 md:mt-2">
                                {factCheck?.facts?.length || 0}
                            </p>
                        </div>

                        <div className="flex flex-row md:flex-col items-center justify-between md:items-start md:justify-start bg-white/5 p-3 md:p-4 rounded-xl border border-white/10">
                            <div className="flex items-center gap-2 text-white">
                                <Users size={16} className="md:hidden" />
                                <Users size={20} className="hidden md:block" />
                                <span className="text-sm font-medium">Participants</span>
                            </div>
                            <p className="text-xl md:text-2xl font-bold text-red-400 md:mt-2">
                                {participants?.length || 0}
                            </p>
                        </div>

                        <div className="flex flex-row md:flex-col items-center justify-between md:items-start md:justify-start bg-white/5 p-3 md:p-4 rounded-xl border border-white/10">
                            <div className="flex items-center gap-2 text-white">
                                <Trophy size={16} className="md:hidden" />
                                <Trophy size={20} className="hidden md:block" />
                                <span className="text-sm font-medium">Status</span>
                            </div>
                            <p
                                className={`text-lg md:text-2xl font-bold md:mt-2 ${
                                    factCheck.isPublic ? "text-green-400" : "text-pink-400"
                                }`}
                            >
                                {factCheck.isPublic ? "Open" : "Closed"}
                            </p>
                        </div>
                    </div>

                    {/* Search and Sort Controls */}
                    <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                        <div className="relative w-full md:w-auto">
                            <input
                                type="text"
                                placeholder="Search participants..."
                                value={searchTerm}
                                onChange={handleSearchChange}
                                className="w-full md:w-64 px-4 py-2 md:py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-red-200 focus:outline-none focus:ring-2 focus:ring-red-400 pl-10"
                            />
                            <Search
                                className="absolute left-3 top-2.5 md:top-3.5 text-red-400"
                                size={16}
                            />
                        </div>

                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <SortAsc size={16} className="md:hidden text-red-400" />
                            <SortAsc size={20} className="hidden md:block text-red-400" />
                            <select
                                value={sortOption}
                                onChange={handleSortChange}
                                className="w-full md:w-auto px-4 py-2 md:py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-red-400 appearance-none cursor-pointer"
                            >
                                <option value="name">Sort by Name</option>
                                <option value="score">Sort by Score</option>
                            </select>
                        </div>
                    </div>

                    {/* Participants List */}
                    <div className="space-y-2 mt-6">
                        {sortedParticipants.map((participant, index) => (
                            <div
                                key={participant.walletAddress}
                                className="flex items-center justify-between p-3 md:p-4 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors"
                            >
                                <div className="flex items-center gap-4">
                                    <span className="text-red-400 font-medium text-sm md:text-base">{index + 1}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-white text-sm md:text-base">
                                            {participant.participantName}
                                        </span>
                                        {participant.isCompleted && (
                                            <span className="text-green-400 text-xs">✓ Completed</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`font-bold text-sm md:text-base ${
                                        participant.isCompleted ? 'text-green-400' : 'text-yellow-400'
                                    }`}>
                                        {participant.score}
                                    </span>
                                    {!participant.isCompleted && (
                                        <span className="text-xs text-gray-400">Live</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FactCheckLeaderBoards;
