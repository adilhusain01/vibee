import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import toast from "react-hot-toast";
import axios from "../api/axios";
import { CircularProgress } from "@mui/material";
import { Search, Trophy, Users, HelpCircle, SortAsc } from "lucide-react";

const LeaderBoards = () => {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOption, setSortOption] = useState("name");
  const [allParticipants, setAllParticipants] = useState([]);
  const [nftData, setNftData] = useState({});
  const [nftLoading, setNftLoading] = useState(true);
  const [selectedNFT, setSelectedNFT] = useState(null);

  const fetchNFTData = async (participant) => {
    try {
      const tronWeb = window.tronLink.tronWeb;
      const nftContract = await tronWeb
        .contract()
        .at("TTgJKEbKmznmG6XtT9nHG6hQXHQ4geeGSx");

      console.log(nftContract);

      // Ensure nftTokenId is a valid number
      const tokenId = participant.nftTokenId;
      if (!tokenId || isNaN(tokenId)) {
        throw new Error("Invalid nftTokenId");
      }

      // Fetch NFT metadata using the correct method
      const metadata = await nftContract.getTokenDetails(tokenId).call();
      return metadata;
    } catch (error) {
      console.error("Error fetching NFT data:", error);
      return null;
    }
  };

  const loadNFTData = async () => {
    const nftDataMap = {};
    for (const participant of participants) {
      if (participant.nftTokenId) {
        const data = await fetchNFTData(participant);
        if (data) {
          nftDataMap[participant.walletAddress] = data;
        }
      }
    }
    setNftData(nftDataMap);
  };

  useEffect(() => {
    if (participants?.length > 0) {
      loadNFTData();
    }
  }, [participants]);

  useEffect(() => {
    const fetchLeaderBoards = async () => {
      try {
        const response = await axios.get(`/api/quiz/leaderboards/${id}`);

        setQuiz(response.data.quiz);
        setParticipants(response.data.participants || []);
        setAllParticipants(response.data.participants || []);
        setLoading(false);

        console.log(response.data);
      } catch (error) {
        console.log(error);
        if (loading) {
          toast.error("Failed to fetch leaderboard data");
        }
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

  if (!quiz) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ height: "calc(100vh - 6rem)" }}
      >
        <h1 className="text-2xl md:text-4xl font-bold text-white">
          Quiz not found!
        </h1>
      </div>
    );
  }

  const NFTModal = ({ nft, participant, onClose }) => {
    if (!nft) return null;

    const tronScanUrl = `https://nile.tronscan.org/#/contract/TTgJKEbKmznmG6XtT9nHG6hQXHQ4geeGSx/code`; // Replace with your contract address
    const ipfsUrl = nft?.imageUrl;

    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-lg md:rounded-2xl p-4 md:p-6 max-w-lg w-full">
          <div className="space-y-3 md:space-y-4">
            <img
              src={nft?.imageUrl}
              alt="NFT"
              className="w-full h-48 md:h-64 lg:h-80 object-cover rounded-lg md:rounded-xl"
            />
            <div className="space-y-2 md:space-y-3 text-white">
              <h3 className="text-base md:text-lg lg:text-xl font-bold">NFT Details</h3>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <p className="text-sm md:text-base">
                  <span className="text-red-400">Participant:</span>{" "}
                  {nft?.participantName}
                </p>
                <p className="text-sm md:text-base">
                  <span className="text-red-400">Quiz Creator:</span>{" "}
                  {nft?.quizCreatorName}
                </p>
              </div>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <p className="text-sm md:text-base">
                  <span className="text-red-400">Quiz Name:</span>{" "}
                  {nft?.quizName}
                </p>
                <p className="text-sm md:text-base">
                  <span className="text-red-400">Token ID:</span>{" "}
                  {participant?.nftTokenId}
                </p>
              </div>
              {/* Verification Links */}
              <div className="space-y-2 md:space-y-3 mt-3 md:mt-4">
                <h4 className="text-base md:text-lg font-semibold">
                  Verify Ownership
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-3">
                  <a
                    href={tronScanUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between px-3 md:px-4 py-2 md:py-3 bg-white/10 rounded-lg md:rounded-xl hover:bg-white/20 transition-colors"
                  >
                    <span className="text-sm md:text-base">Contract</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 md:h-5 md:w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </a>

                  <a
                    href={ipfsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between px-3 md:px-4 py-2 md:py-3 bg-white/10 rounded-lg md:rounded-xl hover:bg-white/20 transition-colors"
                  >
                    <span className="text-sm md:text-base">See on IPFS</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 md:h-5 md:w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </a>
                  <button
                    onClick={onClose}
                    className="text-sm md:text-base w-full py-2 md:py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg md:rounded-xl transition-colors md:col-span-1"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className="flex items-center justify-center px-4"
      style={{ height: "calc(100vh - 6rem)" }}
    >
      <div className="max-w-4xl w-full mx-auto">
        <div className="text-center space-y-2 md:space-y-4 mb-6 md:mb-8">
          <h1 className="text-xl md:text-3xl lg:text-5xl font-bold text-white">
            Quiz Leaderboard &nbsp;
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-pink-400">
              #{id}
            </span>
          </h1>
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-300">Live Updates</span>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-lg md:rounded-2xl p-4 md:p-6 lg:p-8 border border-white/20 shadow-xl space-y-4 md:space-y-6">
          {/* Quiz Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            <div className="flex flex-row md:flex-col items-center justify-between md:items-start md:justify-start bg-white/5 p-3 md:p-4 rounded-lg md:rounded-xl border border-white/10">
              <div className="flex items-center gap-2 text-white">
                <HelpCircle size={16} className="md:hidden" />
                <HelpCircle size={20} className="hidden md:block" />
                <span className="text-xs md:text-sm font-medium">Questions</span>
              </div>
              <p className="text-lg md:text-xl lg:text-2xl font-bold text-red-400 md:mt-2">
                {quiz.questionCount}
              </p>
            </div>

            <div className="flex flex-row md:flex-col items-center justify-between md:items-start md:justify-start bg-white/5 p-3 md:p-4 rounded-lg md:rounded-xl border border-white/10">
              <div className="flex items-center gap-2 text-white">
                <Users size={16} className="md:hidden" />
                <Users size={20} className="hidden md:block" />
                <span className="text-xs md:text-sm font-medium">Participants</span>
              </div>
              <p className="text-lg md:text-xl lg:text-2xl font-bold text-red-400 md:mt-2">
                {participants?.length || 0}
              </p>
            </div>

            <div className="flex flex-row md:flex-col items-center justify-between md:items-start md:justify-start bg-white/5 p-3 md:p-4 rounded-lg md:rounded-xl border border-white/10">
              <div className="flex items-center gap-2 text-white">
                <Trophy size={16} className="md:hidden" />
                <Trophy size={20} className="hidden md:block" />
                <span className="text-xs md:text-sm font-medium">Status</span>
              </div>
              <p
                className={`text-lg md:text-xl lg:text-2xl font-bold md:mt-2 ${
                  quiz.isPublic ? "text-green-400" : "text-pink-400"
                }`}
              >
                {quiz.isPublic ? "Open" : "Closed"}
              </p>
            </div>
          </div>

          {/* Search and Sort Controls */}
          <div className="flex flex-col md:flex-row gap-3 md:gap-4 justify-between items-center">
            <div className="relative w-full md:w-auto">
              <input
                type="text"
                placeholder="Search participants..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="w-full md:w-64 px-3 md:px-4 py-2 md:py-3 bg-white/10 border border-white/20 rounded-lg md:rounded-xl text-white placeholder-red-200 focus:outline-none focus:ring-2 focus:ring-red-400 pl-9 md:pl-10 text-sm md:text-base"
              />
              <Search
                className="absolute left-2 md:left-3 top-2.5 md:top-3.5 text-red-400"
                size={16}
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <SortAsc size={16} className="text-red-400 md:hidden" />
              <SortAsc size={20} className="text-red-400 hidden md:block" />
              <select
                value={sortOption}
                onChange={handleSortChange}
                className="w-full md:w-auto px-3 md:px-4 py-2 md:py-3 bg-white/10 border border-white/20 rounded-lg md:rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-red-400 appearance-none cursor-pointer text-sm md:text-base"
              >
                <option value="name">Sort by Name</option>
                <option value="score">Sort by Score</option>
              </select>
            </div>
          </div>

          {/* Participants List */}
          <div className="space-y-2 md:space-y-3 mt-4 md:mt-6">
            {sortedParticipants.map((participant, index) => (
              <div
                key={participant.walletAddress}
                className="flex items-center justify-between p-3 md:p-4 bg-white/5 rounded-lg md:rounded-xl border border-white/10 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-3 md:gap-4">
                  <span className="text-red-400 font-medium text-sm md:text-base min-w-[24px]">{index + 1}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm md:text-base truncate">
                      {participant.user.name}
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
      {selectedNFT && (
        <NFTModal
          nft={selectedNFT}
          participant={participants.find(
            (p) => nftData[p.walletAddress] === selectedNFT
          )}
          onClose={() => setSelectedNFT(null)}
        />
      )}
    </div>
  );
};

export default LeaderBoards;
