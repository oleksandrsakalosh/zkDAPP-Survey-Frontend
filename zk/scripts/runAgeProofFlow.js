const path = require('path');
const fs = require('fs');
const snarkjs = require('snarkjs');
const { buildEligibilityInputToFile } = require('./buildAgeInput');
const { generateWitness } = require('./generateWitness');
const { generateProof } = require('./generateProof');
const { verifyProof } = require('./verifyProof');
const { eligibilityBuildDir, getSurveyInputPath, getTimestampYyyyMmDd } = require('./common');
const { eligibilityCircuit } = require('../config');

async function readEligibilityProofArtifacts() {
  const proofPath = path.join(eligibilityBuildDir, eligibilityCircuit.proofFile);
  const publicSignalsPath = path.join(eligibilityBuildDir, eligibilityCircuit.publicSignalsFile);
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

async function generateEligibilityProofArtifacts({ input, surveyId }) {
  const currentDate = String(input?.currentDate ?? getTimestampYyyyMmDd()).trim();
  const outputPath = getSurveyInputPath(surveyId, currentDate);
  const { surveyId: _ignoredSurveyId, ...circuitInput } = input || {};

  const { input: writtenInput } = buildEligibilityInputToFile(
    circuitInput,
    outputPath,
  );

  await generateWitness(outputPath);
  await generateProof();
  const artifacts = await readEligibilityProofArtifacts();

  return {
    ok: true,
    inputPath: path.relative(process.cwd(), outputPath),
    input: writtenInput,
    ...artifacts,
  };
}

async function verifyGeneratedEligibilityProof() {
  const isValid = await verifyProof();

  return {
    ok: isValid,
  };
}

async function runEligibilityProofFlow({ input, surveyId }) {
  const generated = await generateEligibilityProofArtifacts({ input, surveyId });
  const verified = await verifyGeneratedEligibilityProof();

  return {
    ...generated,
    ok: verified.ok,
  };
}

if (require.main === module) {
  const input = process.argv[2] ? JSON.parse(process.argv[2]) : {};
  const surveyId = process.argv[3];

  runEligibilityProofFlow({ input, surveyId })
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}

module.exports = {
  runEligibilityProofFlow,
  generateEligibilityProofArtifacts,
  verifyGeneratedEligibilityProof,
  runAgeProofFlow: runEligibilityProofFlow,
  generateAgeProofArtifacts: generateEligibilityProofArtifacts,
  verifyGeneratedAgeProof: verifyGeneratedEligibilityProof,
  readEligibilityProofArtifacts,
};
