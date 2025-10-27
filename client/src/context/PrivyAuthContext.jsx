import { createContext, useContext, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { ethers } from 'ethers';
import { getNetworkConfig } from '../utils/networks';

export const PrivyAuthContext = createContext();

export const usePrivyAuth = () => {
  const context = useContext(PrivyAuthContext);
  if (!context) {
    throw new Error('usePrivyAuth must be used within a PrivyAuthProvider');
  }
  return context;
};

const PrivyAuthProvider = ({ children }) => {
  const {
    ready,
    authenticated,
    user,
    login,
    logout,
    linkWallet,
    unlinkWallet,
    createWallet,
    sendTransaction
  } = usePrivy();

  const { wallets } = useWallets();
  const [walletAddress, setWalletAddress] = useState(null);
  const [network, setNetwork] = useState(() => getNetworkConfig().chainName);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);

  // Helper to create provider/signer based on wallet type
  const createProviderAndSigner = async (wallet) => {
    let ethersProvider;
    if (wallet.walletClientType === 'privy') {
      // For embedded wallets: get the EIP-1193 provider
      const privyProvider = await wallet.getEthereumProvider();
      ethersProvider = new ethers.providers.Web3Provider(privyProvider);
    } else if (wallet.walletClient) {
      // For external wallets (e.g., MetaMask): use walletClient directly
      ethersProvider = new ethers.providers.Web3Provider(wallet.walletClient);
    } else {
      throw new Error('Wallet client not available');
    }
    return {
      provider: ethersProvider,
      signer: ethersProvider.getSigner()
    };
  };

  // Get the primary wallet address and set up provider/signer
  useEffect(() => {
    const setupWallet = async () => {
      if (authenticated && user && wallets.length > 0) {
        const primaryWallet = wallets[0];
        if (primaryWallet?.address) {
          setWalletAddress(primaryWallet.address);
          localStorage.setItem('walletAddress', primaryWallet.address);

          try {
            const { provider: ethersProvider, signer: ethersSigner } = await createProviderAndSigner(primaryWallet);
            setProvider(ethersProvider);
            setSigner(ethersSigner);
            console.log('✅ Signer set up successfully for wallet:', primaryWallet.address);
          } catch (error) {
            console.error('❌ Error setting up signer:', error);
          }
        }
      } else {
        setWalletAddress(null);
        setProvider(null);
        setSigner(null);
        localStorage.removeItem('walletAddress');
      }
    };

    setupWallet();
  }, [authenticated, user, wallets]);

  // Auto-create embedded wallet for users without wallets (only once)
  useEffect(() => {
    if (ready && authenticated && user && wallets.length === 0) {
      // Check if user has any linked accounts with wallets
      const hasAnyWallet = user.linkedAccounts?.some(account =>
        account.type === 'wallet' || account.type === 'smart_wallet'
      );

      // Only create wallet if user has no wallets at all
      if (!hasAnyWallet) {
        console.log('Creating embedded wallet for new user...');
        try {
          createWallet();
        } catch (error) {
          console.log('Wallet creation skipped:', error.message);
        }
      }
    }
  }, [ready, authenticated, user?.id]); // Only depend on user.id to avoid re-runs

  const connectWallet = async () => {
    try {
      if (!authenticated) {
        login();
      } else if (wallets.length === 0) {
        // User is authenticated but has no wallet, create one
        try {
          createWallet();
        } catch (error) {
          // Ignore error if user already has embedded wallet
          if (!error.message?.includes('already has an embedded wallet')) {
            console.error('Error creating wallet:', error);
          }
        }
      } else {
        // User already has wallet, just link if needed
        console.log('User already has wallets:', wallets.length);
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
    }
  };

  const disconnectWallet = async () => {
    try {
      logout();
      setWalletAddress(null);
      setProvider(null);
      setSigner(null);
      localStorage.removeItem('walletAddress');
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
    }
  };

  const switchNetwork = async () => {
    // With Privy, network switching is handled automatically
    // The defaultChain in PrivyProvider config handles this
    console.log('Network switching handled by Privy configuration');
    return true;
  };

  const getWalletInfo = () => {
    if (!authenticated || !user) {
      return {
        isConnected: false,
        address: null,
        walletType: null
      };
    }

    const primaryWallet = wallets[0];
    return {
      isConnected: !!walletAddress,
      address: walletAddress,
      walletType: primaryWallet?.walletClientType || 'embedded',
      user: user,
      email: user.email?.address,
      googleAccount: user.google?.email
    };
  };

  const getContractSigner = async () => {
    console.log('🔍 getContractSigner called - signer available:', !!signer);
    console.log('🔍 Authenticated:', authenticated, 'Wallets:', wallets.length);

    if (!authenticated || wallets.length === 0) {
      throw new Error('Please connect your wallet first.');
    }

    // If signer is already set from useEffect, return it
    if (signer) {
      return signer;
    }

    // Otherwise, create it on-demand
    const primaryWallet = wallets[0];
    try {
      const { signer: tempSigner } = await createProviderAndSigner(primaryWallet);
      console.log('✅ Created temporary signer for transaction');
      return tempSigner;
    } catch (error) {
      console.error('❌ Error creating temporary signer:', error);
      throw new Error('Unable to create signer for transaction. Please try refreshing the page.');
    }
  };

  const value = {
    // Wallet state
    walletAddress,
    network,
    authenticated,
    ready,
    user,
    provider,
    signer,

    // Wallet actions
    connectWallet,
    disconnectWallet,
    switchNetwork,
    linkWallet,
    unlinkWallet,
    createWallet,

    // Utility functions
    getWalletInfo,
    getContractSigner,
    sendTransaction,

    // Privy specific
    login,
    logout,
    wallets
  };

  return (
    <PrivyAuthContext.Provider value={value}>
      {children}
    </PrivyAuthContext.Provider>
  );
};

PrivyAuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export default PrivyAuthProvider;