import { useState, useEffect } from "react";
import { usePrivyAuth } from "../context/PrivyAuthContext";
import { usePrivy } from '@privy-io/react-auth';
import { ethers } from "ethers";
import toast from "react-hot-toast";
import { getCurrentCurrency } from '../utils/networks';
import ConnectWallet from "../components/ConnectWallet";
import {
  Dialog,
  DialogContent,
  DialogActions,
  DialogTitle,
  CircularProgress,
} from "@mui/material";
import {
  Wallet,
  Send,
  Copy,
  RefreshCw,
  User,
  LogOut,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";

const Profile = () => {
  const {
    walletAddress,
    user,
    authenticated,
    connectWallet,
    disconnectWallet,
    getWalletInfo,
    getContractSigner,
    network,
  } = usePrivyAuth();

  const { exportWallet, ready } = usePrivy();

  const [balance, setBalance] = useState("0");
  const [loading, setLoading] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  const currentCurrency = getCurrentCurrency();

  useEffect(() => {
    if (authenticated && walletAddress) {
      fetchBalance();
    }
  }, [authenticated, walletAddress]);

  const fetchBalance = async () => {
    try {
      setLoading(true);
      const signer = await getContractSigner();
      const balanceWei = await signer.getBalance();
      const balanceEth = ethers.utils.formatEther(balanceWei);
      setBalance(balanceEth);
    } catch (error) {
      console.error("Error fetching balance:", error);
      toast.error("Failed to fetch balance");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(walletAddress);
    toast.success("Wallet address copied to clipboard");
  };

  const validateWithdrawForm = () => {
    if (!withdrawAmount || !recipientAddress) {
      toast.error("Please fill in all fields");
      return false;
    }

    if (parseFloat(withdrawAmount) <= 0) {
      toast.error("Withdraw amount must be greater than 0");
      return false;
    }

    if (parseFloat(withdrawAmount) > parseFloat(balance)) {
      toast.error("Insufficient balance");
      return false;
    }

    if (!ethers.utils.isAddress(recipientAddress)) {
      toast.error("Invalid recipient address");
      return false;
    }

    return true;
  };

  const handleWithdraw = async () => {
    if (!validateWithdrawForm()) return;

    try {
      setLoading(true);
      const signer = await getContractSigner();

      const amountWei = ethers.utils.parseEther(withdrawAmount);

      // Estimate gas
      const gasEstimate = await signer.estimateGas({
        to: recipientAddress,
        value: amountWei,
      });

      // Add 20% buffer to gas estimate
      const gasLimit = gasEstimate.mul(120).div(100);

      const tx = await signer.sendTransaction({
        to: recipientAddress,
        value: amountWei,
        gasLimit,
      });

      toast.success("Withdrawal transaction sent!");

      // Wait for transaction confirmation
      await tx.wait();

      toast.success("Withdrawal completed successfully!");

      // Reset form and refresh balance
      setWithdrawAmount("");
      setRecipientAddress("");
      setWithdrawDialogOpen(false);
      await fetchBalance();

    } catch (error) {
      console.error("Withdrawal error:", error);
      if (error.code === "INSUFFICIENT_FUNDS") {
        toast.error("Insufficient funds for transaction (including gas fees)");
      } else if (error.code === "USER_REJECTED") {
        toast.error("Transaction was rejected");
      } else {
        toast.error("Withdrawal failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExportPrivateKey = async () => {
    try {
      const walletInfo = getWalletInfo();

      // Check if user is authenticated and has an embedded wallet
      const hasEmbeddedWallet = !!user?.linkedAccounts?.find(
        (account) =>
          account.type === 'wallet' &&
          account.walletClientType === 'privy' &&
          account.chainType === 'ethereum'
      );

      if (!ready || !authenticated) {
        toast.error("Please authenticate first");
        return;
      }

      if (!hasEmbeddedWallet) {
        toast.error("No embedded wallet found to export");
        return;
      }

      if (walletInfo?.walletType === "privy") {
        // For Privy embedded wallets, use Privy's official export method
        toast.success("Opening wallet export interface...");

        // Use Privy's exportWallet method - this opens a secure modal
        if (exportWallet) {
          await exportWallet();
          toast.success("Export modal opened successfully");
        } else {
          toast.error("Export functionality not available");
        }

      } else {
        // For external wallets, provide guidance
        toast("For external wallets, use your wallet's built-in export feature");
      }

      setExportDialogOpen(false);
    } catch (error) {
      console.error("Error opening wallet export:", error);
      toast.error("Failed to open wallet export interface");
    }
  };

  const walletInfo = getWalletInfo();

  const getUserDisplayName = () => {
    if (!user) return '';
    if (user.google?.name) return user.google.name;
    if (user.email?.address) return user.email.address;
    if (walletAddress) return `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
    return 'User';
  };

  const getUserDisplayType = () => {
    if (!user) return '';
    if (user.google?.email) return `Google: ${user.google.email}`;
    if (user.email?.address) return `Email: ${user.email.address}`;
    return 'Wallet User';
  };

  if (!authenticated) {
    return (
      <ConnectWallet
        connectWallet={connectWallet}
        icon={User}
        title="Connect Your Wallet"
        description="Please connect your wallet to view your profile"
      />
    );
  }

  return (
    <div className="px-4 md:px-24 py-6 md:py-12">
      <div className="max-w-lg mx-auto">
        <div className="bg-white/10 backdrop-blur-lg rounded-lg md:rounded-2xl p-4 md:p-6 border border-white/20 shadow-xl">
          {/* Compact Header */}
          <div className="flex items-center gap-3 md:gap-4 mb-4 md:mb-6 pb-3 md:pb-4 border-b border-white/10">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-r from-red-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg md:text-xl font-bold text-white truncate">
                {getUserDisplayName()}
              </h2>
              <p className="text-red-200 text-xs md:text-sm truncate">
                {getUserDisplayType()}
              </p>
            </div>
            {user?.google && (
              <span className="px-2 md:px-3 py-1 bg-white/10 border border-white/20 rounded-full text-white text-xs">
                Google
              </span>
            )}
          </div>

          <div className="space-y-4 md:space-y-6">
            {/* Wallet Information */}
            <div className="space-y-3 md:space-y-4">
              <h3 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
                <Wallet className="w-4 h-4 md:w-5 md:h-5" />
                Wallet Information
              </h3>

              <div className="space-y-3 md:space-y-4">
                <div>
                  <label className="text-red-200 text-xs font-medium">Wallet Address</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      value={walletAddress || ''}
                      readOnly
                      className="w-full px-2 md:px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-xs font-mono"
                    />
                    <button
                      onClick={handleCopyAddress}
                      className="px-2 py-2 bg-white/10 border border-white/20 rounded-lg text-white hover:bg-white/20 transition-all duration-200 flex-shrink-0"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <div>
                    <label className="text-red-200 text-xs font-medium">Network</label>
                    <input
                      value={network || "Unknown Network"}
                      readOnly
                      className="w-full px-2 md:px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-xs mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-red-200 text-xs font-medium">Wallet Type</label>
                    <input
                      value={walletInfo?.walletType === "privy" ? "Embedded" : "External"}
                      readOnly
                      className="w-full px-2 md:px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-xs mt-1"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Balance & Actions */}
            <div className="space-y-3 md:space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-base md:text-lg font-bold text-white">Balance & Actions</h3>
                <button
                  onClick={fetchBalance}
                  disabled={loading}
                  className="px-2 py-1 bg-white/10 border border-white/20 rounded-lg text-white hover:bg-white/20 transition-all duration-200 disabled:opacity-50"
                >
                  {loading ? (
                    <CircularProgress size={12} style={{ color: 'white' }} />
                  ) : (
                    <RefreshCw className="w-3 h-3" />
                  )}
                </button>
              </div>

              {/* Balance Display */}
              <div className="text-center p-3 md:p-4 bg-white/5 rounded-lg border border-white/10">
                <p className="text-red-200 text-xs mb-1">Current Balance</p>
                <p className="text-lg md:text-xl font-bold text-white">
                  {loading ? (
                    <CircularProgress size={18} style={{ color: 'white' }} />
                  ) : (
                    `${parseFloat(balance).toFixed(4)} ${currentCurrency}`
                  )}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 md:space-y-3">
              <button
                onClick={() => setWithdrawDialogOpen(true)}
                disabled={parseFloat(balance) <= 0}
                className="flex items-center justify-center gap-2 w-full px-4 py-2 md:py-3 bg-gradient-to-r from-red-500 to-pink-500 rounded-lg text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base"
              >
                <Send className="w-4 h-4" />
                Withdraw
              </button>

              <button
                onClick={() => setExportDialogOpen(true)}
                className="flex items-center justify-center gap-2 w-full px-4 py-2 md:py-3 bg-white/10 border border-white/20 rounded-lg text-white font-medium hover:bg-white/20 transition-all duration-200 text-sm md:text-base"
              >
                <ExternalLink className="w-4 h-4" />
                Export
              </button>

              <button
                onClick={disconnectWallet}
                className="flex items-center justify-center gap-2 w-full px-4 py-2 md:py-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 font-medium hover:bg-red-500/30 transition-all duration-200 text-sm md:text-base"
              >
                <LogOut className="w-4 h-4" />
                Disconnect
              </button>
            </div>
          </div>
        </div>

        {/* Withdraw Dialog */}
        <Dialog
          open={withdrawDialogOpen}
          onClose={() => setWithdrawDialogOpen(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            style: {
              backgroundColor: "#7f1d1d",
              borderRadius: "1rem",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              margin: "16px",
              maxHeight: "calc(100vh - 32px)",
            },
          }}
        >
          <DialogTitle className="text-white flex items-center gap-2 text-lg md:text-xl px-4 md:px-6 py-3 md:py-4">
            <Send className="w-5 h-5 md:w-6 md:h-6" />
            {`Withdraw ${currentCurrency} Tokens`}
          </DialogTitle>
          <DialogContent className="space-y-4 md:space-y-6 px-4 md:px-6">
            <p className="text-red-200 text-xs md:text-sm">
              {`Send your ${currentCurrency} tokens to an external wallet address`}
            </p>

            <div className="space-y-3 md:space-y-4">
              <label className="text-white text-xs md:text-sm font-medium">Amount ({currentCurrency})</label>

              {/* Amount Input */}
              <input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                step="0.0000001"
                min="0"
                max={balance}
                placeholder="0.0000000"
                className="w-full px-3 md:px-4 py-2 md:py-3 bg-white/10 border border-white/20 rounded-lg md:rounded-xl text-white placeholder-red-200 focus:outline-none focus:ring-2 focus:ring-red-400 text-sm md:text-base"
              />

              {/* Amount Slider */}
              <div className="space-y-2">
                <input
                  type="range"
                  min="0"
                  max={balance}
                  step="0.0000001"
                  value={withdrawAmount || 0}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer slider"
                  style={{
                    background: `linear-gradient(to right, #ef4444 0%, #ec4899 ${((withdrawAmount || 0) / balance) * 100}%, rgba(255,255,255,0.1) ${((withdrawAmount || 0) / balance) * 100}%, rgba(255,255,255,0.1) 100%)`
                  }}
                />

                {/* Slider Labels */}
                <div className="flex justify-between text-xs text-red-200">
                  <span className="hidden sm:inline">0 {currentCurrency}</span>
                  <span className="sm:hidden">0</span>
                  <span className="font-medium text-center px-2">
                    {withdrawAmount ? `${parseFloat(withdrawAmount).toFixed(4)} ${currentCurrency}` : `0.0000 ${currentCurrency}`}
                  </span>
                  <span className="hidden sm:inline">{parseFloat(balance).toFixed(4)} {currentCurrency}</span>
                  <span className="sm:hidden">{parseFloat(balance).toFixed(2)}</span>
                </div>
              </div>

              {/* Quick Amount Buttons */}
              <div className="grid grid-cols-4 gap-1 md:gap-2">
                <button
                  type="button"
                  onClick={() => setWithdrawAmount((parseFloat(balance) * 0.25).toFixed(7))}
                  className="px-2 md:px-3 py-1 md:py-2 bg-white/10 border border-white/20 rounded-lg text-white text-xs hover:bg-white/20 transition-all duration-200"
                >
                  25%
                </button>
                <button
                  type="button"
                  onClick={() => setWithdrawAmount((parseFloat(balance) * 0.5).toFixed(7))}
                  className="px-2 md:px-3 py-1 md:py-2 bg-white/10 border border-white/20 rounded-lg text-white text-xs hover:bg-white/20 transition-all duration-200"
                >
                  50%
                </button>
                <button
                  type="button"
                  onClick={() => setWithdrawAmount((parseFloat(balance) * 0.75).toFixed(7))}
                  className="px-2 md:px-3 py-1 md:py-2 bg-white/10 border border-white/20 rounded-lg text-white text-xs hover:bg-white/20 transition-all duration-200"
                >
                  75%
                </button>
                <button
                  type="button"
                  onClick={() => setWithdrawAmount(parseFloat(balance).toFixed(7))}
                  className="px-2 md:px-3 py-1 md:py-2 bg-gradient-to-r from-red-500 to-pink-500 rounded-lg text-white text-xs hover:opacity-90 transition-opacity"
                >
                  MAX
                </button>
              </div>

              <p className="text-red-200 text-xs">Available: {parseFloat(balance).toFixed(4)} {currentCurrency}</p>
            </div>

            <div className="space-y-2">
              <label className="text-white text-xs md:text-sm font-medium">Recipient Address</label>
              <input
                type="text"
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                placeholder="0x..."
                className="w-full px-3 md:px-4 py-2 md:py-3 bg-white/10 border border-white/20 rounded-lg md:rounded-xl text-white placeholder-red-200 focus:outline-none focus:ring-2 focus:ring-red-400 font-mono text-xs md:text-sm"
              />
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg md:rounded-xl p-3 md:p-4">
              <div className="flex items-start gap-2 md:gap-3">
                <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                <p className="text-yellow-200 text-xs md:text-sm">
                  Please double-check the recipient address. Transactions cannot be reversed.
                </p>
              </div>
            </div>
          </DialogContent>
          <DialogActions className="p-4 md:p-6 gap-2 md:gap-3 flex-col sm:flex-row">
            <button
              onClick={() => setWithdrawDialogOpen(false)}
              className="w-full sm:w-auto px-4 md:px-6 py-2 bg-white/10 border border-white/20 rounded-lg md:rounded-xl text-white hover:bg-white/20 transition-all duration-200 text-sm md:text-base order-2 sm:order-1"
            >
              Cancel
            </button>
            <button
              onClick={handleWithdraw}
              disabled={loading}
              className="w-full sm:w-auto px-4 md:px-6 py-2 bg-gradient-to-r from-red-500 to-pink-500 rounded-lg md:rounded-xl text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm md:text-base order-1 sm:order-2"
            >
              {loading ? (
                <CircularProgress size={16} style={{ color: 'white' }} />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {loading ? "Processing..." : "Withdraw"}
            </button>
          </DialogActions>
        </Dialog>

        {/* Export Wallet Dialog */}
        <Dialog
          open={exportDialogOpen}
          onClose={() => setExportDialogOpen(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            style: {
              backgroundColor: "#7f1d1d",
              borderRadius: "1rem",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              margin: "16px",
              maxHeight: "calc(100vh - 32px)",
            },
          }}
        >
          <DialogTitle className="text-white flex items-center gap-2 text-lg md:text-xl px-4 md:px-6 py-3 md:py-4">
            <ExternalLink className="w-5 h-5 md:w-6 md:h-6" />
            Export Wallet
          </DialogTitle>
          <DialogContent className="space-y-4 md:space-y-6 px-4 md:px-6">
            <p className="text-red-200 text-xs md:text-sm">
              Export your embedded wallet's private key to use with other wallet clients like MetaMask. This will open Privy's secure export modal where you can safely copy your private key.
            </p>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg md:rounded-xl p-3 md:p-4">
              <div className="flex items-start gap-2 md:gap-3">
                <ExternalLink className="w-4 h-4 md:w-5 md:h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-blue-200 text-xs md:text-sm">
                  <p className="font-medium mb-1">What happens next:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>Privy's secure export modal will open</li>
                    <li>You can copy your full private key</li>
                    <li>Use it to import your wallet into MetaMask or other clients</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-red-500/10 border border-red-500/20 rounded-lg md:rounded-xl p-3 md:p-4">
              <div className="flex items-start gap-2 md:gap-3">
                <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-red-200 text-xs md:text-sm">
                  <strong>Security Warning:</strong> Keep your private key secure and never share it with anyone. Anyone with your private key has full access to your wallet.
                </p>
              </div>
            </div>
          </DialogContent>
          <DialogActions className="p-4 md:p-6 gap-2 md:gap-3 flex-col sm:flex-row">
            <button
              onClick={() => setExportDialogOpen(false)}
              className="w-full sm:w-auto px-4 md:px-6 py-2 bg-white/10 border border-white/20 rounded-lg md:rounded-xl text-white hover:bg-white/20 transition-all duration-200 text-sm md:text-base order-2 sm:order-1"
            >
              Close
            </button>
            <button
              onClick={handleExportPrivateKey}
              className="w-full sm:w-auto px-4 md:px-6 py-2 bg-gradient-to-r from-red-500 to-pink-500 rounded-lg md:rounded-xl text-white font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2 text-sm md:text-base order-1 sm:order-2"
            >
              <ExternalLink className="w-4 h-4" />
              Open Wallet Manager
            </button>
          </DialogActions>
        </Dialog>
      </div>
    </div>
  );
};

export default Profile;