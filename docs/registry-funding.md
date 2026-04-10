To register surveys on-chain, the same device wallet used by the app must hold a small amount of Sepolia ETH for gas.

Why:
- Vocdoni DEV account creation/funding is separate from Ethereum Sepolia.
- `registerSurvey(...)` is an Ethereum transaction, so the wallet must pay Sepolia gas.

Current deployed contract:
- Address: `0x30111f3D2715B2513DeB8e235542870cF2Be5301`

RPC:
- `https://ethereum-sepolia-rpc.publicnode.com`

What to fund:
- The device wallet shown in the app / error message.
- A small faucet amount of Sepolia ETH is enough for many registry writes.
