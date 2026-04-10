const path = require('path');

const zkRoot = path.join('zk');

const checks = {
  age: {
    key: 'age',
    label: 'Age Check',
    description: 'Prove age threshold based on birth date disclosure.',
    circuitName: 'age-check',
    circuitFile: path.join(zkRoot, 'circuits', 'age-check.circom'),
    buildDir: path.join(zkRoot, 'build', 'age'),
    ptauDir: path.join(zkRoot, 'ptau'),
    inputDir: path.join(zkRoot, 'inputs'),
    inputFile: path.join(zkRoot, 'inputs', 'age-input.json'),
    r1csFile: 'age-check.r1cs',
    zkeyFile: 'age-check.zkey',
    verificationKeyFile: 'verification_key.json',
    proofFile: 'proof.json',
    publicSignalsFile: 'public.json',
    witnessFile: 'witness.wtns',
    wasmDirectory: 'age-check_js',
    wasmFile: 'age-check.wasm',
    witnessCalculatorFile: 'generate_witness.js',
    inputs: [
      {
        key: 'currentDate',
        source: 'computed',
        format: 'yyyymmdd',
        computedBy: 'utcPlus2CurrentDate',
      },
      {
        key: 'dobValue',
        source: 'sd-jwt',
        format: 'yyyymmdd',
        sdJwtAttributeKeys: ['birth_date', 'date_of_birth', 'dob', 'dobValue'],
      },
      {
        key: 'minAge',
        source: 'user',
        format: 'nonNegativeInteger',
        label: 'Minimum age',
      },
    ],
  },
};

const circuits = checks;
const ageCircuit = checks.age;

function getCircuitConfig(circuitKey = 'age') {
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
  ageCircuit,
  getCircuitConfig,
};
