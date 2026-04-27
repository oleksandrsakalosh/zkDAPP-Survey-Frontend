const path = require('path');

const zkRoot = path.join('zk');

const checks = {
  eligibility: {
    key: 'eligibility',
    label: 'Eligibility Check',
    description: 'Prove eligibility with SD-JWT disclosures.',
    circuitName: 'eligibility',
    circuitFile: path.join(zkRoot, 'circuits', 'eligibility.circom'),
    buildDir: path.join(zkRoot, 'build', 'v1'),
    ptauDir: path.join(zkRoot, 'ptau'),
    inputDir: path.join(zkRoot, 'inputs'),
    inputFile: path.join(zkRoot, 'inputs', 'eligibility-input.json'),
    r1csFile: 'eligibility.r1cs',
    zkeyFile: 'eligibility.zkey',
    verificationKeyFile: 'verification_key.json',
    proofFile: 'proof.json',
    publicSignalsFile: 'public.json',
    witnessFile: 'witness.wtns',
    wasmDirectory: 'eligibility_js',
    wasmFile: 'eligibility.wasm',
    witnessCalculatorFile: 'generate_witness.js',
  },
};

const circuits = checks;
const eligibilityCircuit = checks.eligibility;
const ageCircuit = eligibilityCircuit;

function getCircuitConfig(circuitKey = 'eligibility') {
  const circuitConfig = checks[circuitKey];
  if (!circuitConfig) {
    throw new Error(`Unknown circuit key: ${circuitKey}`);
  }
  return circuitConfig;
}

module.exports = {
  zkRoot,
  checks,
  circuits,
  eligibilityCircuit,
  ageCircuit,
  getCircuitConfig,
};
