const networks = {
    "0x1": "Mainnet",
    "0x4f5e0c": "Electroneum",
    "0xc488": "Somnia Testnet",
    "0x13a7": "Somnia Mainnet"
}

// Network configuration based on environment
const getNetworkConfig = () => {
    const isProduction = import.meta.env.VITE_NODE_ENV === 'production';

    if (isProduction) {
        // Somnia Mainnet configuration
        return {
            chainId: '0x13a7', // 5031 in hex
            chainName: 'Somnia Mainnet',
            rpcUrls: ['https://somnia-rpc.publicnode.com'],
            nativeCurrency: {
                name: 'SOMI',
                symbol: 'SOMI',
                decimals: 18,
            },
            blockExplorerUrls: ['https://somniate.me/'],
        };
    } else {
        // Somnia Testnet configuration
        return {
            chainId: '0xc488', // 50312 in hex
            chainName: 'Somnia Testnet',
            rpcUrls: ['https://dream-rpc.somnia.network'],
            nativeCurrency: {
                name: 'STT',
                symbol: 'STT',
                decimals: 18,
            },
            blockExplorerUrls: ['https://shannon-explorer.somnia.network/'],
        };
    }
};

// Get currency symbol based on environment
const getCurrentCurrency = () => {
    const networkConfig = getNetworkConfig();
    return networkConfig.nativeCurrency.symbol;
};

export { networks, getNetworkConfig, getCurrentCurrency };
  