# mvts-smart-contract-root-router

Smart contract for decentralized phone numbering plan.

***

### Install Dependencies

`yarn install`

***

### Template .env

```text
PRIVATE_KEY=<string, required>
INFURA_ETH_SEPOLIA_API_KEY=<string, optional>
INFURA_ETH_MAINNET_API_KEY=<string, optional>
ALCHEMY_POLYGON_MUMBAI_API_KEY=<string, optional>
ALCHEMY_POLYGON_MAINNET_API_KEY=<string, optional>
GETBLOCK_BSC_TESTNET_API_KEY=<string, optional>
GETBLOCK_BSC_MAINNET_API_KEY=<string, optional>
ETHERSCAN_API_KEY=<string, optional>
POLYGONSCAN_API_KEY=<string, optional>
BSCSCAN_API_KEY=<string, optional>
```

***

### Test contracts

`yarn test`

***

### Deploy contract in testnet

Ethereum (Sepolia): `yarn deploy:eth-sepolia`

Polygon (Mumbai): `yarn deploy:polygon-mumbai`

Binance Smart Chain: `yarn deploy:bsc-testnet`

***

### Verify contract in testnet

Ethereum (Sepolia): `yarn verify:eth-sepolia`

Polygon (Mumbai): `yarn verify:polygon-mumbai`

Binance Smart Chain: `yarn verify:bsc-testnet`

***

### Deploy contract in mainnet

Ethereum: `yarn deploy:eth-mainnet`

Polygon: `yarn deploy:polygon-mainnet`

Binance Smart Chain: `yarn deploy:bsc-mainnet`

***

### Verify contract in mainnet

Ethereum: `yarn verify:eth-mainnet`

Polygon: `yarn verify:polygon-mainnet`

Binance Smart Chain: `yarn verify:bsc-mainnet`
