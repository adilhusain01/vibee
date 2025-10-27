import { Link } from "react-router-dom";
import { Keyboard, Brain, Play, CheckCircle } from "lucide-react";
import AnimatedBackground from "./AnimatedBackground";
import StatsSection from "../StatsSection";

const Home = () => {
  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 py-1 sm:py-2 md:py-8 space-y-3 sm:space-y-4 md:space-y-10">
      {/* Hero Section */}
      <div className="grid lg:grid-cols-2 items-center gap-3 sm:gap-4 md:gap-10 min-h-[40vh] sm:min-h-[50vh] lg:min-h-[60vh]">
        {/* Left Column - Hero Content */}
        <div className="w-full max-w-xs sm:max-w-sm md:max-w-xl space-y-2 sm:space-y-3 md:space-y-6 justify-self-center">
          <div className="text-center space-y-1 sm:space-y-2 md:space-y-4">
            <h1 className="text-xl sm:text-2xl md:text-4xl lg:text-6xl font-bold text-white leading-tight px-2">
              Learn & Engage
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-pink-400">
                Through Games
              </span>
            </h1>
          </div>

          {/* Main Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3 md:gap-4">
            <Link
              to="/quiz-options"
              className="group bg-white/10 backdrop-blur-lg rounded-lg md:rounded-xl p-4 sm:p-4 md:p-6 lg:p-8 border border-white/20 hover:bg-white/20 transition-all w-full max-w-xs mx-auto sm:max-w-none"
            >
              <div className="flex flex-col items-center space-y-2 sm:space-y-2 md:space-y-3">
                <div className="w-10 h-10 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-r from-red-500 to-pink-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Play className="text-white" size={18} />
                </div>
                <span className="text-sm sm:text-sm md:text-lg font-semibold text-white">Quiz</span>
              </div>
            </Link>

            <Link
              to="/fact-check-options"
              className="group bg-white/10 backdrop-blur-lg rounded-lg md:rounded-xl p-4 sm:p-4 md:p-6 lg:p-8 border border-white/20 hover:bg-white/20 transition-all w-full max-w-xs mx-auto sm:max-w-none"
            >
              <div className="flex flex-col items-center space-y-2 sm:space-y-2 md:space-y-3">
                <div className="w-10 h-10 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-r from-red-500 to-pink-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <CheckCircle className="text-white" size={18} />
                </div>
                <span className="text-sm sm:text-sm md:text-lg font-semibold text-white text-center">
                  Fact Check
                </span>
              </div>
            </Link>
          </div>
        </div>

        <div className="hidden lg:block relative lg:h-[700px] w-full lg:max-w-lg justify-self-center">
          <AnimatedBackground />
        </div>
      </div>

      {/* Stats Section */}
      <div className="w-full">
        <StatsSection />
      </div>
    </div>
  );
};

export default Home;
