const fs = require('fs');
const path = require('path');
const snarkjs = require('snarkjs');
const { eligibilityBuildDir } = require('./common');
const { eligibilityCircuit } = require('../config');

async function verifyProof() {
  const verificationKeyPath = path.join(eligibilityBuildDir, eligibilityCircuit.verificationKeyFile);
  const proofPath = path.join(eligibilityBuildDir, eligibilityCircuit.proofFile);
  const publicSignalsPath = path.join(eligibilityBuildDir, eligibilityCircuit.publicSignalsFile);

  if (!fs.existsSync(verificationKeyPath)) {
    throw new Error(`Missing verification key: ${verificationKeyPath}`);
  }
  if (!fs.existsSync(proofPath)) {
    throw new Error(`Missing proof file: ${proofPath}`);
  }
  if (!fs.existsSync(publicSignalsPath)) {
    throw new Error(`Missing public signals file: ${publicSignalsPath}`);
  }

  const verificationKey = JSON.parse(await fs.promises.readFile(verificationKeyPath, 'utf8'));
  const proof = JSON.parse(await fs.promises.readFile(proofPath, 'utf8'));
  const publicSignals = JSON.parse(await fs.promises.readFile(publicSignalsPath, 'utf8'));

  const isValid = await snarkjs.groth16.verify(verificationKey, publicSignals, proof);
  console.log(isValid ? 'Proof verified successfully.' : 'Proof verification failed.');
  return isValid;
}

if (require.main === module) {
  verifyProof().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { verifyProof };
