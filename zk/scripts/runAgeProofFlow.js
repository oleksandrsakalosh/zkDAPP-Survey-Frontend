const path = require('path');
const { buildAgeInputToFile } = require('./buildAgeInput');
const { generateWitness } = require('./generateWitness');
const { generateProof } = require('./generateProof');
const { verifyProof } = require('./verifyProof');
const { getTimestampedInputPath } = require('./common');

async function generateAgeProofArtifacts({ currentDate, dobValue, minAge }) {
  const outputPath = getTimestampedInputPath();

  const { input } = buildAgeInputToFile(
    { currentDate, dobValue, minAge },
    outputPath,
  );

  await generateWitness(outputPath);
  await generateProof();

  return {
    ok: true,
    inputPath: path.relative(process.cwd(), outputPath),
    input,
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
};
