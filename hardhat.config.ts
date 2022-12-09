import {HardhatUserConfig} from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import 'dotenv/config';
import {cleanEnv, str} from 'envalid';


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
    accounts: [`0x${env.PRIVATE_KEY}`],
};


const config: HardhatUserConfig = {
    solidity: {
        version: '0.8.17',
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            }
        }
    },
    paths: {
        cache: './cache',
        artifacts: './artifacts',
        sources: './contracts',
        tests: './test'
    },
    networks: {
        'eth-sepolia': Object.assign({
            url: `https://sepolia.infura.io/v3/${env.INFURA_ETH_SEPOLIA_API_KEY}`
        }, DefaultNetworkConfig),
        'eth-mainnet': Object.assign({
            url: `https://mainnet.infura.io/v3/${env.INFURA_ETH_MAINNET_API_KEY}`
        }, DefaultNetworkConfig),
        'polygon-mumbai': Object.assign({
            url: `https://polygon-mumbai.g.alchemy.com/v2/${env.ALCHEMY_POLYGON_MUMBAI_API_KEY}`
        }, DefaultNetworkConfig),
        'polygon-mainnet': Object.assign({
            url: `https://polygon-mainnet.g.alchemy.com/v2/${env.ALCHEMY_POLYGON_MAINNET_API_KEY}`
        }, DefaultNetworkConfig),
        'bsc-testnet': Object.assign({
            url: `https://bsc.getblock.io/mainnet/?api_key=${env.GETBLOCK_BSC_TESTNET_API_KEY}`
        }, DefaultNetworkConfig),
        'bsc-mainnet': Object.assign({
            url: `https://bsc.getblock.io/mainnet/?api_key=${env.GETBLOCK_BSC_MAINNET_API_KEY}`
        }, DefaultNetworkConfig)
    },
    etherscan: {
        apiKey:  {
            sepolia: env.ETHERSCAN_API_KEY,
            mainnet: env.ETHERSCAN_API_KEY,
            polygonMumbai: env.POLYGONSCAN_API_KEY,
            polygon: env.POLYGONSCAN_API_KEY,
            bscTestnet: env.BSCSCAN_API_KEY,
            bsc: env.BSCSCAN_API_KEY
        }
    }
};


export default config;
