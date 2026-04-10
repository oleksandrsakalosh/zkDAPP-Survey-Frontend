const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { ageBuildDir, ageInputPath, ensureDirectory } = require('./common');
const { ageCircuit } = require('../config');

function resolveWitnessPaths(inputPath = ageInputPath) {
  return {
    witnessPath: path.join(ageBuildDir, ageCircuit.witnessFile),
    wasmPath: path.join(ageBuildDir, ageCircuit.wasmDirectory, ageCircuit.wasmFile),
    inputPath,
    witnessCalculatorPath: path.join(ageBuildDir, ageCircuit.wasmDirectory, ageCircuit.witnessCalculatorFile),
  };
}

async function generateWitness(inputPath = ageInputPath) {
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
  const inputPath = process.argv[2] || ageInputPath;
  generateWitness(inputPath).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { generateWitness, resolveWitnessPaths };
