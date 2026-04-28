const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { eligibilityBuildDir, eligibilityInputPath, ensureDirectory } = require('./common');
const { eligibilityCircuit } = require('../config');

function resolveWitnessPaths(inputPath = eligibilityInputPath) {
  return {
    witnessPath: path.join(eligibilityBuildDir, eligibilityCircuit.witnessFile),
    wasmPath: path.join(eligibilityBuildDir, eligibilityCircuit.wasmDirectory, eligibilityCircuit.wasmFile),
    inputPath,
    witnessCalculatorPath: path.join(eligibilityBuildDir, eligibilityCircuit.wasmDirectory, eligibilityCircuit.witnessCalculatorFile),
  };
}

async function generateWitness(inputPath = eligibilityInputPath) {
  const { witnessPath, wasmPath, witnessCalculatorPath } = resolveWitnessPaths(inputPath);

  if (!fs.existsSync(wasmPath)) {
    throw new Error(`Missing wasm file: ${wasmPath}`);
  }
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Missing input file: ${inputPath}`);
  }
  if (!fs.existsSync(witnessCalculatorPath)) {
    throw new Error(`Missing witness calculator: ${witnessCalculatorPath}`);
  }

  ensureDirectory(witnessPath);

  const run = spawnSync(
    process.execPath,
    [witnessCalculatorPath, wasmPath, inputPath, witnessPath],
    { stdio: 'pipe', encoding: 'utf8' },
  );

  if (run.status !== 0) {
    throw new Error(run.stderr || run.stdout || 'Failed to generate witness.');
  }

  console.log(`Wrote ${witnessPath}`);
}

if (require.main === module) {
  const inputPath = process.argv[2] || eligibilityInputPath;
  generateWitness(inputPath).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { generateWitness, resolveWitnessPaths };
