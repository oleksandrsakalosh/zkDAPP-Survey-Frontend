const fs = require('fs');
const path = require('path');
const { getCircuitConfig, zkRoot } = require('../config');

const projectRoot = process.cwd();
const eligibilityCircuit = getCircuitConfig('eligibility');
const eligibilityBuildDir = path.join(projectRoot, eligibilityCircuit.buildDir);
const eligibilityInputPath = path.join(projectRoot, eligibilityCircuit.inputFile);

function ensureDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  ensureDirectory(filePath);
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function normalizeYyyyMmDd(value, fieldName) {
  const asString = String(value ?? '').trim();
  if (!asString) {
    throw new Error(`${fieldName} is required.`);
  }
  if (!/^\d{8}$/.test(asString)) {
    throw new Error(`${fieldName} must be in yyyymmdd format.`);
  }
  return Number(asString);
}

function normalizeNonNegativeInteger(value, fieldName = 'value') {
  const asString = String(value ?? '').trim();
  if (!asString) {
    throw new Error(`${fieldName} is required.`);
  }
  const parsed = Number(asString);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a non-negative integer.`);
  }
  return parsed;
}

function getCurrentDateYyyyMmDdUtcPlus2(now = new Date()) {
  const plusTwoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const year = plusTwoHours.getUTCFullYear();
  const month = String(plusTwoHours.getUTCMonth() + 1).padStart(2, '0');
  const day = String(plusTwoHours.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function resolveAgeParsedDobValue(parsedSdJwt) {
  const candidateSources = [
    parsedSdJwt?.attributes,
    parsedSdJwt?.claimValues,
    parsedSdJwt,
  ].filter(Boolean);

  const candidateKeys = ['dobValue', 'dob', 'birth_date', 'date_of_birth'];

  for (const source of candidateSources) {
    for (const key of candidateKeys) {
      const value = source[key];
      if (value != null && String(value).trim() !== '') {
        return String(value).trim();
      }
    }
  }

  throw new Error('Unable to resolve dobValue from parsed SD-JWT.');
}

function resolveAgeCircuitInput({ parsedSdJwt, currentDate, dobValue, minAge } = {}) {
  return {
    currentDate: normalizeYyyyMmDd(
      currentDate ?? getCurrentDateYyyyMmDdUtcPlus2(),
      'currentDate',
    ),
    dobValue: normalizeYyyyMmDd(
      dobValue ?? resolveAgeParsedDobValue(parsedSdJwt),
      'dobValue',
    ),
    minAge: normalizeNonNegativeInteger(minAge, 'minAge'),
  };
}

function getTimestampYyyyMmDd(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function getSurveyInputPath(surveyId = 'manual', stampOrNow = new Date()) {
  const safeSurveyId = String(surveyId || 'manual').trim().replace(/[^a-zA-Z0-9._-]/g, '-');
  const fileStamp = typeof stampOrNow === 'string' ? stampOrNow : getTimestampYyyyMmDd(stampOrNow);
  const fileName = `${safeSurveyId}-${fileStamp}.json`;
  return path.join(projectRoot, eligibilityCircuit.inputDir, fileName);
}

module.exports = {
  projectRoot,
  zkRoot,
  eligibilityCircuit,
  ageCircuit: eligibilityCircuit,
  eligibilityBuildDir,
  eligibilityInputPath,
  ageBuildDir: eligibilityBuildDir,
  ageInputPath: eligibilityInputPath,
  ensureDirectory,
  readJson,
  writeJson,
  normalizeYyyyMmDd,
  normalizeNonNegativeInteger,
  getCurrentDateYyyyMmDdUtcPlus2,
  getTimestampYyyyMmDd,
  getSurveyInputPath,
  resolveAgeParsedDobValue,
  resolveAgeCircuitInput,
};
