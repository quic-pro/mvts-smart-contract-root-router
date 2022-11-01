const HDWalletProvider = require('@truffle/hdwallet-provider');
const dotenv = require('dotenv');
const {cleanEnv, str} = require('envalid');


dotenv.config('.env');
const env = cleanEnv(process.env, {
    PRIVATE_KEY: str(),
    INFURA_KEY_GOERLI: str({default: ''}),
    INFURA_KEY_ETH: str({default: ''}),
    ETHERSCAN_API_KEY: str({default: ''}),
    BSCSCAN_API_KEY: str({default: ''}),
    POLYGONSCAN_API_KEY: str({default: ''})
});


module.exports = {
    networks: {
        goerli: {
            provider: () => new HDWalletProvider(env.PRIVATE_KEY, `https://goerli.infura.io/v3/${env.INFURA_KEY_GOERLI}`),
            network_id: 4
        },
        eth: {
            provider: () => new HDWalletProvider(env.PRIVATE_KEY, `https://mainnet.infura.io/v3/${env.INFURA_KEY_ETH}`),
            network_id: 1
        },
        testnet: {
            provider: () => new HDWalletProvider(env.PRIVATE_KEY, 'https://data-seed-prebsc-1-s3.binance.org:8545'),
            network_id: 97,
            confirmations: 2,
            skipDryRun: true,
            networkCheckTimeout: 500000000,
            timeoutBlocks: 20000
        },
        bsc: {
            provider: () => new HDWalletProvider(env.PRIVATE_KEY, `https://bsc.getblock.io/mainnet/?api_key=<${env.GETBLOCK_KEY_BSC}`),
            network_id: 56,
            confirmations: 2,
            skipDryRun: true,
            networkCheckTimeout: 500000000,
            gasPrice: 10000000000
        },
        mumbai: {
            provider: () => new HDWalletProvider(env.PRIVATE_KEY, 'https://matic-mumbai.chainstacklabs.com'),
            network_id: 80001,
            confirmations: 2,
            skipDryRun: true
        },
        polygon: {
            provider: () => new HDWalletProvider(env.PRIVATE_KEY, 'https://polygon-rpc.com'),
            network_id: 137,
            confirmations: 2,
            skipDryRun: true,
            gasPrice: 50000000000
        }
    },
    plugins: ["truffle-plugin-verify"],
    api_keys: {
        etherscan: env.ETHERSCAN_API_KEY,
        bscscan: env.BSCSCAN_API_KEY,
        polygonscan: env.POLYGONSCAN_API_KEY
    },
    compilers: {
        solc: {
            version: '0.8.7',
            settings: {
                optimizer: {
                    enabled: true
                }
            }
        }
    }
};
