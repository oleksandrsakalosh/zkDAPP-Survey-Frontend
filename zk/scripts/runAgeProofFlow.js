const path = require('path');
const fs = require('fs');
const snarkjs = require('snarkjs');
const { buildAgeInputToFile } = require('./buildAgeInput');
const { generateWitness } = require('./generateWitness');
const { generateProof } = require('./generateProof');
const { verifyProof } = require('./verifyProof');
const { ageBuildDir, getTimestampedInputPath } = require('./common');
const { ageCircuit } = require('../config');

async function readAgeProofArtifacts() {
  const proofPath = path.join(ageBuildDir, ageCircuit.proofFile);
  const publicSignalsPath = path.join(ageBuildDir, ageCircuit.publicSignalsFile);
  const proof = JSON.parse(await fs.promises.readFile(proofPath, 'utf8'));
  const publicSignals = JSON.parse(await fs.promises.readFile(publicSignalsPath, 'utf8'));
  const rawCalldata = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
  const parsed = JSON.parse(`[${rawCalldata}]`);

  return {
    proof,
    publicSignals,
    calldata: {
      pi_a: parsed[0],
      pi_b: parsed[1],
      pi_c: parsed[2],
      pubInputs: parsed[3],
    },
  };
}

async function generateAgeProofArtifacts({ currentDate, dobValue, minAge }) {
  const outputPath = getTimestampedInputPath();

  const { input } = buildAgeInputToFile(
    { currentDate, dobValue, minAge },
    outputPath,
  );

  await generateWitness(outputPath);
  await generateProof();
  const artifacts = await readAgeProofArtifacts();

  return {
    ok: true,
    inputPath: path.relative(process.cwd(), outputPath),
    input,
    ...artifacts,
  };
}

async function verifyGeneratedAgeProof() {
  const isValid = await verifyProof();

  return {
    ok: isValid,
  };
}

async function runAgeProofFlow({ currentDate, dobValue, minAge }) {
  const generated = await generateAgeProofArtifacts({ currentDate, dobValue, minAge });
  const verified = await verifyGeneratedAgeProof();

  return {
    ...generated,
    ok: verified.ok,
  };
}

if (require.main === module) {
  const currentDate = process.argv[2];
  const dobValue = process.argv[3];
  const minAge = process.argv[4];

  runAgeProofFlow({ currentDate, dobValue, minAge })
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}

module.exports = {
  runAgeProofFlow,
  generateAgeProofArtifacts,
  verifyGeneratedAgeProof,
  readAgeProofArtifacts,
};
