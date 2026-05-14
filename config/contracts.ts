export const SEPOLIA_CHAIN_ID = 11155111;

export const SURVEY_MANAGER_CONTRACT_ADDRESS =
  process.env.EXPO_PUBLIC_SURVEY_MANAGER_ADDRESS?.trim() ||
  "0x22a2905bb3542b460a0067927cd5fc494bbf81d7";

export const SURVEY_MANAGER_RPC_URL =
  process.env.EXPO_PUBLIC_SURVEY_MANAGER_RPC_URL?.trim() ||
  process.env.EXPO_PUBLIC_REGISTRY_RPC_URL?.trim() ||
  "https://ethereum-sepolia-rpc.publicnode.com";

export const SURVEY_MANAGER_DEPLOYMENT_BLOCK = Number(
  process.env.EXPO_PUBLIC_SURVEY_MANAGER_DEPLOYMENT_BLOCK ?? 10815562
);

export const SURVEY_MANAGER_ABI = [
  "event ElectionCreated(uint256 indexed electionId,address indexed creator,uint256 indexed tokenId,string metadataURI,bytes32 metadataHash,bytes32 eligibilityHash,uint256 maxVoters,uint256 startDate,uint256 endDate)",
  "event VoterRegistered(uint256 indexed electionId,address indexed voter,uint256 indexed tokenId)",
  "event ElectionStarted(uint256 indexed electionId,string vocdoniElectionId,bytes32 vocdoniSpecHash)",
  "event ProofVerified(address indexed submitter,uint256 indexed electionId,bool result)",
  "function createElection(string metadataURI,bytes32 metadataHash,bytes32 eligibilityHash,uint256 maxVoters,uint256 startDate,uint256 endDate) returns (uint256 electionId)",
  "function registerForElection(uint256 electionId,uint256[2] pi_a,uint256[2][2] pi_b,uint256[2] pi_c,uint256[6] pubInputs)",
  "function startElection(uint256 electionId,string vocdoniElectionId,bytes32 vocdoniSpecHash)",
  "function getElection(uint256 electionId) view returns ((uint256 id,address creator,uint256 tokenId,string metadataURI,bytes32 metadataHash,bytes32 eligibilityHash,uint256 maxVoters,uint256 startDate,uint256 endDate,uint256 registeredVoters,uint8 status,string vocdoniElectionId,bytes32 vocdoniSpecHash,uint256 createdAt,uint256 startedAt))",
  "function getCreatorElections(address creator) view returns (uint256[])",
  "function getVoterElections(address voter) view returns (uint256[])",
  "function isRegistered(uint256 electionId,address voter) view returns (bool)",
  "function balanceOf(address account,uint256 id) view returns (uint256)",
  "function verifyProofView(uint256[2] pi_a,uint256[2][2] pi_b,uint256[2] pi_c,uint256[6] pubInputs) view returns (bool)",
  "function nextElectionId() view returns (uint256)",
] as const;
