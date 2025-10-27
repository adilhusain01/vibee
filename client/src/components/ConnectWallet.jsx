import { Timer, User } from "lucide-react";

const ConnectWallet = ({ connectWallet, icon = Timer, title = "Connect Your Wallet", description = "Please connect your wallet to continue" }) => {
  const IconComponent = icon;

  return (
    <div
      className="flex items-center justify-center px-4"
      style={{ height: "calc(100vh - 6rem)" }}
    >
      <div className="bg-white/10 backdrop-blur-lg rounded-lg md:rounded-2xl p-6 md:p-8 border border-white/20 shadow-xl text-center space-y-4 md:space-y-6 max-w-md w-full">
        <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-r from-red-500 to-pink-500 rounded-full flex items-center justify-center mx-auto">
          <IconComponent className="w-6 h-6 md:w-8 md:h-8 text-white" />
        </div>
        <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-white">{title}</h1>
        <p className="text-red-200 text-sm md:text-base">
          {description}
        </p>
        <button
          onClick={connectWallet}
          className="w-full md:w-auto px-6 py-2 md:py-3 bg-gradient-to-r from-red-500 to-pink-500 rounded-lg md:rounded-xl text-white font-medium hover:opacity-90 transition-opacity text-sm md:text-base"
        >
          Connect Wallet
        </button>
      </div>
    </div>
  );
};

export default ConnectWallet;