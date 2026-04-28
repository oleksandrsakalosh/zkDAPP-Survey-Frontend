const path = require('path');
const { buildEligibilityInputToFile } = require('./buildAgeInput');
const { generateWitness } = require('./generateWitness');
const { generateProof } = require('./generateProof');
const { verifyProof } = require('./verifyProof');
const { getSurveyInputPath, getTimestampYyyyMmDd } = require('./common');

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
  const artifacts = await readAgeProofArtifacts();

  return {
    ok: true,
    inputPath: path.relative(process.cwd(), outputPath),
    input: writtenInput,
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
};
