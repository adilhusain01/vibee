import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { usePrivyAuth } from "../context/PrivyAuthContext";
import toast from "react-hot-toast";
import axios from "../api/axios";
import { Play, FileText, Link2, Video, Brain } from "lucide-react";

const FactCheckOptions = () => {
  const { walletAddress, connectWallet } = usePrivyAuth();
  const [joinGameCode, setJoinGameCode] = useState("");
  const navigate = useNavigate();

  const handleJoinGame = async () => {
    if (!walletAddress) {
      toast.error("Please connect your wallet first.");
      await connectWallet();
      return;
    }

    try {
      await axios.post(`/api/fact-check/verify/${joinGameCode}`, {
        walletAddress,
      });
      toast.success("Redirecting ...");
      navigate(`/fact-check/${joinGameCode}`);
    } catch (err) {
      toast.error(
        err.response?.data?.error || "An error occurred while joining the game."
      );
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 md:py-10 lg:py-16">
      <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold text-white text-center mb-8 md:mb-12">
        Fact Check Options
      </h1>

      <div className="max-w-xl mx-auto space-y-6 md:space-y-8">
        {/* Create Fact Check Options */}
        <div className="bg-white/10 backdrop-blur-lg rounded-lg md:rounded-2xl p-6 md:p-8 lg:p-10 border border-white/20">
          <h2 className="text-lg md:text-xl lg:text-2xl font-semibold text-white mb-4 md:mb-6">
            Create a Fact Check Game By
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-2 gap-3 md:gap-4">
            {[
              { path: "/fact-check-creation/pdf", icon: FileText, label: "PDF" },
              { path: "/fact-check-creation/prompt", icon: Brain, label: "Topic" },
              { path: "/fact-check-creation/url", icon: Link2, label: "Website URL" },
              { path: "/fact-check-creation/video", icon: Video, label: "Video" },
            ].map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className="group bg-white/10 backdrop-blur-lg rounded-lg md:rounded-xl p-3 md:p-4 border border-white/20 hover:bg-white/20 transition-all"
              >
                <div className="flex flex-col items-center space-y-2 md:space-y-3">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-r from-red-500 to-pink-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <item.icon className="text-white" size={20} />
                  </div>
                  <span className="text-sm md:text-lg font-semibold text-white text-center">
                    {item.label}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Join Game Section */}
        <div className="bg-white/10 backdrop-blur-lg rounded-lg md:rounded-2xl p-4 md:p-6 border border-white/20">
          <h2 className="text-lg md:text-xl lg:text-2xl font-semibold text-white mb-4 md:mb-6">
            Join a Fact Check Game
          </h2>
          <div className="flex flex-col md:flex-row gap-3 md:gap-4">
            <input
              type="text"
              value={joinGameCode}
              onChange={(e) => setJoinGameCode(e.target.value)}
              placeholder="Enter game code"
              className="flex-1 px-3 md:px-4 py-2 md:py-3 bg-white/10 border border-white/20 rounded-lg md:rounded-xl text-white placeholder-red-200 focus:outline-none focus:ring-2 focus:ring-red-400 text-sm md:text-base"
            />
            <button
              onClick={handleJoinGame}
              className="px-4 md:px-6 py-2 md:py-3 bg-gradient-to-r from-red-500 to-pink-500 rounded-lg md:rounded-xl text-white font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2 text-sm md:text-base"
            >
              <Play size={16} className="md:hidden" />
              <Play size={20} className="hidden md:block" />
              Join
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FactCheckOptions;