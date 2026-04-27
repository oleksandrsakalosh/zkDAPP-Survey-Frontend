const { eligibilityInputPath, writeJson } = require('./common');

function buildEligibilityInput(source = {}) {
  return { ...source };
}

function buildEligibilityInputToFile(source = {}, outputPath = eligibilityInputPath) {
  const input = buildEligibilityInput(source);
  writeJson(outputPath, input);
  return { outputPath, input };
}

if (require.main === module) {
  const source = process.argv[2] ? JSON.parse(process.argv[2]) : {};
  const outputPath = process.argv[3] || eligibilityInputPath;

  const { outputPath: writtenPath } = buildEligibilityInputToFile(source, outputPath);
  console.log(`Wrote ${writtenPath}`);
}

module.exports = {
  buildEligibilityInput,
  buildEligibilityInputToFile,
  buildAgeInput: buildEligibilityInput,
  buildAgeInputToFile: buildEligibilityInputToFile,
};
