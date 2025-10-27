import { Link } from "react-router-dom";
import { RefreshCw, Home as HomeIcon } from "lucide-react";

const ServerError = () => {
  return (
    <div className="container mx-auto px-4 py-10 md:py-0 min-h-full flex items-center">
      <div className="flex flex-col items-center justify-center h-full space-y-6 md:space-y-8">
        <div className="text-center space-y-3 md:space-y-4">
          <h1 className="text-4xl md:text-6xl lg:text-8xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-pink-400">
            500
          </h1>
          <h2 className="text-xl md:text-2xl lg:text-4xl font-semibold text-white">
            Server Error
          </h2>
          <p className="text-white/60 max-w-md mx-auto text-sm md:text-base">
            Something went wrong on our servers. We're working to fix the issue.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full max-w-sm sm:max-w-none">
          <button
            onClick={() => window.location.reload()}
            className="group bg-white/10 backdrop-blur-lg rounded-xl px-4 md:px-6 py-2 md:py-3 border border-white/20 hover:bg-white/20 transition-all inline-flex items-center justify-center space-x-2"
          >
            <RefreshCw className="text-white" size={16} />
            <span className="text-white font-semibold text-sm md:text-base">Try Again</span>
          </button>

          <Link
            to="/"
            className="group bg-white/10 backdrop-blur-lg rounded-xl px-4 md:px-6 py-2 md:py-3 border border-white/20 hover:bg-white/20 transition-all inline-flex items-center justify-center space-x-2"
          >
            <HomeIcon className="text-white" size={16} />
            <span className="text-white font-semibold text-sm md:text-base">Back to Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ServerError;
