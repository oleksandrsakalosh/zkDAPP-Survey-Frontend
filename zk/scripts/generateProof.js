const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { ageBuildDir, ensureDirectory } = require('./common');
const { resolveWitnessPaths } = require('./generateWitness');
const { ageCircuit } = require('../config');

async function generateProof() {
  const proofPath = path.join(ageBuildDir, ageCircuit.proofFile);
  const publicSignalsPath = path.join(ageBuildDir, ageCircuit.publicSignalsFile);
  const zkeyPath = path.join(ageBuildDir, ageCircuit.zkeyFile);
  const { witnessPath } = resolveWitnessPaths();

  if (!fs.existsSync(zkeyPath)) {
    throw new Error(`Missing zkey file: ${zkeyPath}`);
  }
  if (!fs.existsSync(witnessPath)) {
    throw new Error(`Missing witness file: ${witnessPath}`);
  }

  ensureDirectory(proofPath);

  const primaryRun = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['snarkjs', 'groth16', 'prove', zkeyPath, witnessPath, proofPath, publicSignalsPath],
    { stdio: 'pipe', encoding: 'utf8' },
  );

  const primaryFailed = primaryRun.error || primaryRun.status !== 0;
  if (primaryFailed) {
    const localSnarkCli = path.join(process.cwd(), 'node_modules', 'snarkjs', 'build', 'cli.cjs');
    const fallbackRun = spawnSync(
      process.execPath,
      [localSnarkCli, 'groth16', 'prove', zkeyPath, witnessPath, proofPath, publicSignalsPath],
      { stdio: 'pipe', encoding: 'utf8' },
    );

    if (fallbackRun.error || fallbackRun.status !== 0) {
      throw new Error(
        (fallbackRun.error && fallbackRun.error.message)
          || fallbackRun.stderr
          || fallbackRun.stdout
          || (primaryRun.error && primaryRun.error.message)
          || primaryRun.stderr
          || primaryRun.stdout
          || 'Failed to generate proof.',
      );
    }
  }

  console.log(`Wrote ${proofPath}`);
  console.log(`Wrote ${publicSignalsPath}`);
}

if (require.main === module) {
  generateProof().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { generateProof };
