const networks = {
    "0x1": "Mainnet",
    "0x4f5e0c": "Electroneum",
    "0xc488": "Flow Testnet",
    "0x13a7": "Flow Mainnet"
}

// Network configuration based on environment
const getNetworkConfig = () => {
    const isProduction = import.meta.env.VITE_NODE_ENV === 'production';

    if (isProduction) {
        // Flow Mainnet configuration
        return {
            chainId: '0x2eb', // 5031 in hex
            chainName: 'Flow Mainnet',
            rpcUrls: ['https://mainnet.evm.nodes.onflow.org'],
            nativeCurrency: {
                name: 'FLOW',
                symbol: 'FLOW',
                decimals: 18,
            },
            blockExplorerUrls: ['https://www.flowscan.io'],
        };
    } else {
        // Flow Testnet configuration
        return {
            chainId: '0x221', // 50312 in hex
            chainName: 'Flow Testnet',
            rpcUrls: ['https://testnet.evm.nodes.onflow.org'],
            nativeCurrency: {
                name: 'FLOW',
                symbol: 'FLOW',
                decimals: 18,
            },
            blockExplorerUrls: ['https://testnet.flowscan.io'],
        };
    }
};

// Get currency symbol based on environment
const getCurrentCurrency = () => {
    const networkConfig = getNetworkConfig();
    return networkConfig.nativeCurrency.symbol;
};

export { networks, getNetworkConfig, getCurrentCurrency };