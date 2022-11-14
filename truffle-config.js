const HDWalletProvider = require('@truffle/hdwallet-provider');
const dotenv = require('dotenv');
const {cleanEnv, str} = require('envalid');


dotenv.config('.env');
const env = cleanEnv(process.env, {
    PRIVATE_KEY: str(),
    INFURA_ETH_SEPOLIA_API_KEY: str({default: ''}),
    INFURA_ETH_MAINNET_API_KEY: str({default: ''}),
    ALCHEMY_POLYGON_MUMBAI_API_KEY: str({default: ''}),
    ALCHEMY_POLYGON_MAINNET_API_KEY: str({default: ''}),
    GETBLOCK_BSC_TESTNET_API_KEY: str({default: ''}),
    GETBLOCK_BSC_MAINNET_API_KEY: str({default: ''}),
    ETHERSCAN_API_KEY: str({default: ''}),
    POLYGONSCAN_API_KEY: str({default: ''}),
    BSCSCAN_API_KEY: str({default: ''})
});


const DefaultNetworkConfig = {
    skipDryRun: true,
    confirmations: 2,
    timeoutBlocks: 200,
    networkCheckTimeout: 10000
};


module.exports = {
    networks: {
        'eth-sepolia': Object.assign({
            provider: () => new HDWalletProvider(env.PRIVATE_KEY, `https://sepolia.infura.io/v3/${env.INFURA_ETH_SEPOLIA_API_KEY}`),
            network_id: 11155111
        }, DefaultNetworkConfig),
        'eth-mainnet': Object.assign({
            provider: () => new HDWalletProvider(env.PRIVATE_KEY, `https://mainnet.infura.io/v3/${env.INFURA_ETH_MAINNET_API_KEY}`),
            network_id: 1
        }, DefaultNetworkConfig),
        'polygon-mumbai': Object.assign({
            provider: () => new HDWalletProvider(env.PRIVATE_KEY, `https://polygon-mumbai.g.alchemy.com/v2/${env.ALCHEMY_POLYGON_MUMBAI_API_KEY}`),
            network_id: 80001
        }, DefaultNetworkConfig),
        'polygon-mainnet': Object.assign({
            provider: () => new HDWalletProvider(env.PRIVATE_KEY, `https://polygon-mainnet.g.alchemy.com/v2/${env.ALCHEMY_POLYGON_MAINNET_API_KEY}`),
            network_id: 137
        }, DefaultNetworkConfig),
        'bsc-testnet': Object.assign({
            provider: () => new HDWalletProvider(env.PRIVATE_KEY, `https://bsc.getblock.io/mainnet/?api_key=${env.GETBLOCK_BSC_TESTNET_API_KEY}`),
            network_id: 97
        }, DefaultNetworkConfig),
        'bsc-mainnet': Object.assign({
            provider: () => new HDWalletProvider(env.PRIVATE_KEY, `https://bsc.getblock.io/mainnet/?api_key=${env.GETBLOCK_BSC_MAINNET_API_KEY}`),
            network_id: 56
        }, DefaultNetworkConfig)
    },
    plugins: ["truffle-plugin-verify"],
    api_keys: {
        etherscan: env.ETHERSCAN_API_KEY,
        polygonscan: env.POLYGONSCAN_API_KEY,
        bscscan: env.BSCSCAN_API_KEY
    },
    compilers: {
        solc: {
            version: '0.8.17',
            settings: {
                optimizer: {
                    enabled: true,
                    runs: 200
                }
            }
        }
    }
};
