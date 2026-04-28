# zkDAPP Survey Frontend

Mobile frontend for a decentralized voting/survey system.  
This app is built with Expo + React Native and currently includes a tab-based structure for:
- `home`
- `explore`
- `mySurveys`
- `profile`

The current flow uses:
- Ethereum Sepolia smart contract for survey registration, eligibility-token minting, and lifecycle state
- Lighthouse/IPFS for survey metadata
- local or remote Census3 for ERC1155 token census creation
- Vocdoni SDK for election creation and voting
- local proof service for the current Groth16 age proof test flow

## Tech Stack

- Expo SDK 54
- React 19 + React Native 0.81
- Expo Router (file-based navigation)
- TypeScript

## Prerequisites

- Node.js 20 LTS (recommended)
- npm 10+
- Android Studio (with Android SDK and NDK installed — NDK is required to compile native ZK modules)
- Android Emulator or physical device
- Docker, if running Census3 locally
- IDE: VS Code (recommended)
- Sepolia ETH in the app wallet for contract transactions
- Lighthouse API key for IPFS metadata upload

## Quick Setup

### 1. Install Dependencies

```bash
npm ci
```

> **Note:** Use `npm ci` (not `npm install`) to install exactly from the lockfile. Running `npm install` followed by `npm audit fix` will break the dependency tree.

### 2. Configure Android SDK Path

Create `android/local.properties` with your Android SDK location:

```properties
sdk.dir=C:\\Users\\<YourUsername>\\AppData\\Local\\Android\\Sdk
```

**To find your SDK path:** Open Android Studio → Settings → Appearance & Behavior → System Settings → Android SDK

### 3. Configure Environment Variables

Create a local `.env` file or set these variables in the terminal before starting Expo.

```env
EXPO_PUBLIC_SURVEY_MANAGER_ADDRESS=0xA7619540B6DCF91A16C3Efc73Be76Bb3eeB66e22
EXPO_PUBLIC_SURVEY_MANAGER_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
EXPO_PUBLIC_SURVEY_MANAGER_DEPLOYMENT_BLOCK=10722443

EXPO_PUBLIC_LIGHTHOUSE_API_KEY=<your-lighthouse-api-key>
EXPO_PUBLIC_IPFS_GATEWAY_URL=https://conservative-lungfish-gj815.lighthouseweb3.xyz/ipfs

EXPO_PUBLIC_CENSUS3_API_URL=http://<your-device-reachable-host>:7788/api
EXPO_PUBLIC_CENSUS3_SYNC_ATTEMPTS=30
EXPO_PUBLIC_CENSUS3_SYNC_RETRY_MS=3000

EXPO_PUBLIC_PROOF_SERVICE_URL=http://<your-device-reachable-host>:8787
```

PowerShell example for local web testing:

```powershell
$env:EXPO_PUBLIC_SURVEY_MANAGER_RPC_URL="https://ethereum-sepolia-rpc.publicnode.com"
$env:EXPO_PUBLIC_CENSUS3_API_URL="http://127.0.0.1:7788/api"
$env:EXPO_PUBLIC_PROOF_SERVICE_URL="http://127.0.0.1:8787"
$env:EXPO_PUBLIC_LIGHTHOUSE_API_KEY="<your-lighthouse-api-key>"
```

For a physical phone, do not use `127.0.0.1` or `localhost` for Census3/proof service. Use a LAN or Tailscale address reachable from the phone, for example:

```powershell
$env:EXPO_PUBLIC_CENSUS3_API_URL="http://100.86.31.64:7788/api"
$env:EXPO_PUBLIC_PROOF_SERVICE_URL="http://100.86.31.64:8787"
```

### 4. Run Census3

Use the project fork of Census3:

https://github.com/zkDAPP-Survey/census3

This fork includes the ERC1155 proof-generation fixes needed by this app:
- ERC1155 token type support
- local Merkle tree persistence for proof lookup
- address normalization for proof requests
- `startBlock` handling on token registration
- proof-enabled strategy census generation

Clone and run it separately:

```bash
git clone https://github.com/zkDAPP-Survey/census3.git
cd census3
```

Follow that repository’s Docker/run instructions, then expose the API to the app:

```env
EXPO_PUBLIC_CENSUS3_API_URL=http://<your-device-reachable-host>:7788/api
```

Check that it is reachable:

```bash
curl http://<host>:7788/api/info
curl http://<host>:7788/api/tokens/types
```


The app will register ERC1155 survey tokens automatically when the creator starts a survey, using:

```bash
curl -X POST http://<host>:7788/api/tokens \
  --json '{"ID":"0xA7619540B6DCF91A16C3Efc73Be76Bb3eeB66e22","type":"erc1155","chainID":11155111,"externalID":"<tokenId>","startBlock":<surveyCreatedBlock>}'
```

Important: 
- Use our fork, not upstream Census3, because the voting flow depends on proof lookup for ERC1155 token censuses.
- Census3 must index all ERC1155 `TransferSingle` mint logs before the creator starts the Vocdoni election. If the contract has 2 registered voters but Census3 only shows 1 holder, wait or rescan the token from the survey creation/deployment block before starting.

### 5. Run Proof Service

Start proof service in a separate terminal:

```bash
npm run proof:service
```

The app currently uses this service for the Groth16 age proof registration flow. It exposes:

```text
POST /proof/age/generate
POST /proof/age/verify
```

### 6. Run The Project

Build and run on Android emulator/device:

```bash
npm run android
```

> **Note:** `npx expo start` / Expo Go will not work — the app uses native modules (mopro ZK proofs, react-native-fs) that require a full native build.

Run web target:

```bash
npm run web
```

## Running with Valera Wallet

To test credential sharing with Valera wallet, you'll need both apps running on the same Android emulator. 

**Quick steps:**
1. Set up and run zkDAPP Survey Frontend (steps above)
2. Set up Valera wallet - see [Valera README](../valera/README.md#quick-setup) for setup instructions
3. Both apps will communicate via deep links on the same emulator

## Current End-to-End Flow

1. Creator opens `Create Survey`.
2. App uploads metadata to Lighthouse/IPFS.
3. App calls `createElection(...)` on Sepolia `ElectionManager`.
4. Voter opens `Explore -> Explore & register`.
5. Voter requests an SD-JWT credential from the Valera wallet and generates an eligibility proof on-device using mopro.
6. App checks `verifyProofView(...)`, then calls `registerForElection(...)`.
7. Contract verifies proof and mints non-transferable ERC1155 tokenId for that election.
8. Creator opens `My Surveys -> Pending start`.
9. App asks Census3 to index the ERC1155 token and waits until holder count matches contract `registeredVoters`.
10. App creates a Vocdoni election using the ERC1155/Census3 token census.
11. App calls `startElection(...)` on the contract with Vocdoni election id and spec hash.
12. Voters open `Explore -> Registered` and vote through Vocdoni SDK.

## ZK Proof Generation

Eligibility proof generation runs fully on-device using [mopro](https://zkmopro.org). No backend or proof service is required for the eligibility flow.

## Troubleshooting

### Phone Cannot Reach Census3

Use a LAN/Tailscale IP in `EXPO_PUBLIC_CENSUS3_API_URL`. `localhost` points to the phone itself, not your computer.

### Census3 Holder Count Is Lower Than Contract Registered Voters

Do not start the Vocdoni election yet. Census3 has not indexed every ERC1155 mint. Rescan/register the token with a `startBlock` at or before the survey creation block.

### Vote Proof Not Found

If a wallet owns the ERC1155 token but Vocdoni cannot produce a proof, the fixed Census3 snapshot attached to the Vocdoni election likely does not include that wallet. Create/start a new Vocdoni election only after Census3 holder count matches contract `registeredVoters`.

### Web Testing

For web, use browser-reachable URLs:

```powershell
$env:EXPO_PUBLIC_CENSUS3_API_URL="http://127.0.0.1:7788/api"
```

The web app stores its device wallet in `localStorage`, while Android uses `SecureStore`. These are different wallets unless you manually import/copy keys.


## Useful Scripts

- `npm run start` - start Expo dev server (Metro only, no native build)
- `npm run android` - build and run on Android emulator/device
- `npm run ios` - run on iOS simulator/device
- `npm run web` - run web target
- `npm run lint` - run lint checks
- `npm run assets` - re-link assets (zkey files) to Android without a full rebuild

## Project Structure

```text
app/
  _layout.tsx
  (tabs)/
    _layout.tsx
    home.tsx
    explore.tsx
    mySurveys.tsx
    profile.tsx
  create-survey/
  register/
  voting/
services/
  contractService.ts
  vocdoniService.ts
config/
  contracts.ts
  vocdoni.ts
  ipfs.ts
zk/
  scripts/proofService.js
```

## Notes

- Routing is handled with Expo Router based on files under `app/`.
- App metadata and native config live in `app.json`.


## Developer Team

- Anna Sikalenko
- Karolina Skrypova
- Oleh Fedunchyk
- Oleksandr Sakalosh
- Viktoriia Femiak
- Yehor Lykhachov
