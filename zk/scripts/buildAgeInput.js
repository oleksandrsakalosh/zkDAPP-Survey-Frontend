const { ageInputPath, resolveAgeCircuitInput, writeJson } = require('./common');

function buildAgeInput(source = {}) {
  return resolveAgeCircuitInput(source);
}

function buildAgeInputToFile(source = {}, outputPath = ageInputPath) {
  const input = buildAgeInput(source);
  writeJson(outputPath, input);
  return { outputPath, input };
}

if (require.main === module) {
  const source = {
    currentDate: process.argv[2],
    dobValue: process.argv[3],
    minAge: process.argv[4],
  };
  const outputPath = process.argv[5] || ageInputPath;

  const { outputPath: writtenPath } = buildAgeInputToFile(source, outputPath);
  console.log(`Wrote ${writtenPath}`);
}

module.exports = { buildAgeInput, buildAgeInputToFile };
