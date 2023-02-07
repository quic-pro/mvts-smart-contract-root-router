# Changelog

## [1.0.1](https://github.com/quic-pro/mvts-smart-contract-root-router/releases/tag/1.0.1) (2023-02-07)

### Changed

- feat: replace response code with enum

### Docs

- docs: fix changelog

### Chores

- chore: bump version to 1.0.1

### Tests

- test: fix typescript errors
- test: add setCodeSubscription method test

## [1.0.0](https://github.com/quic-pro/mvts-smart-contract-root-router/releases/tag/1.0.0) (2023-02-07)

### Changed

- Added return of response codes
- Expanded interface for data management
- Optimisation
- Holding the number after the end of the subscription
- Holding logic changed
- Added method getAvailableForBuyNumbers
- Rename method isFree to isAvailable, fixed method getNextNode, refactory method checkPayment
- Added check for holding in methods customer number management
- Optimization
- Changed router initialization method to prevent invalid data entry
- New method getAddressNumbers
- Name refactoring
- Added ERC721
- Codes as NFTs
- Renamed isHolded to isHeld
- Renamed method isAvailable to hasOwner
- Added logic base url
- Optimized isAvailableForBuy method and added token burning before mint.
- Renaming methods
- JS to TS
- Deployment script changed
- Renamed newAddress parameter to newAdr
- Added code verification logic
- feat: add the ability to flexibly set the hold end time
- feat!: add a new method for working with code status
- feat!: change data structures
- feat: add modifiers
- feat: allow contract owner to manage inactive codes data
- perf: optimize subscription renewal

### Fixed

- Fixed isCustomerNumberOwner
- Bugfix
- Fixed method isFree
- Bugfix methods isAvailable and isHolded. Added method getTimestamp. Fixed chainId for goerli.
- Renamed method setNumberFreezeDuration to setCodeFreezeDuration. Fixed methods getOwnerCodes and _exists.
- Bugfix
- Fixed minor bugs
- Fixed error checking the owner and operator of the token and tests refactoring.
- fix(management): add arguments validation when change subscription
- fix: fix typo in error message about incorrect new hold end time
- fix: add code validation in getCodeStatus method
- fix: change the order of modifiers in code management methods

### Refactors

- Refectory utils
- Refactoring TTL and sip domain
- Refactoring
- Refactoring
- Refactoring getNextNode method
- refactor!: rename the parameter storing hold duration
- refactor: remove redundant routing checks
- refactor: use built-in checks for overflow
- refactor: remove isVerified method
- refactor: change error messages

### Docs

- Update .env.example
- Updated solidity version in contracts, truffle config and README.md
- docs: add changelog

### Chores

- add TODO
- Added todos
- Remove TODO: Add set to hold after expiration
- Added todo
- Added hardhat-gas-reporter and hardhat-storage-layout plugins
- Create .gitattributes
- chore: update dependencies
- chore: bump version to 1.0.0

### Tests

- Setup tests
- Fixed test
- Added tests for some functions. Changed access to the pool to private.
- Added tests for smart contract management methods
- Added tests for public utils
- Test refactoring
- Test refactoring
- Test refactoring
- Refactoring smart contract management tests
- Tests refactoring
- test: remove the tests of the removed methods and fix others
- test: refactoring of routing method tests
- test: refactoring of public utils tests
- test: refactoring of smart contract management method tests
- test: fix getCodeData method test: if the code has an owner
- test: refactoring of smart code management method tests

### Styles

- Refactoring TTL and sip domain
- Fixed codestyle
- style: change struct initialization style
- style: remove indent before return type
- style: move public utils
- style: decrease padding between blocks
- style: fix indentation in struct initialization

## [0.2.0](https://github.com/quic-pro/mvts-smart-contract-root-router/releases/tag/0.2.0) (2022-11-01)

### Changed

- Added safe math

### Refactors

- small refactore

## [0.1.0](https://github.com/quic-pro/mvts-smart-contract-root-router/releases/tag/0.1.0) (2022-11-01)

### Changed

- First code upload

### Chores

- Initial commit
