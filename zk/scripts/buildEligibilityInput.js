const { eligibilityInputPath, writeJson } = require('./common');

function asString(value, fallback = '0') {
  const s = String(value ?? '').trim();
  return s !== '' ? s : fallback;
}

function asFlag(value) {
  const s = String(value ?? '').trim();
  if (!s || s === '0' || s.toLowerCase() === 'false') return '0';
  return '1';
}

function asPaddedArray(value, size) {
  const arr = Array.isArray(value) ? value : [];
  const padded = arr.slice(0, size).map((v) => asString(v));
  while (padded.length < size) padded.push('0');
  return padded;
}

function buildEligibilityInput(source = {}) {
  return {
    // ── Issuer identity (from SD-JWT zkp metadata) ───────────────────────────
    pubKey: [asString(source.pubKey?.[0]), asString(source.pubKey?.[1])],
    signatureR8: [asString(source.signatureR8?.[0]), asString(source.signatureR8?.[1])],
    signatureS: asString(source.signatureS),
    merkleRoot: asString(source.merkleRoot),
    leaves: asPaddedArray(source.leaves, 10),

    // ── Age / date-of-birth disclosure ───────────────────────────────────────
    dobSalt: asString(source.dobSalt),
    dobKey: asString(source.dobKey),
    dobValue: asString(source.dobValue),

    // ── Expiry disclosure (always required by circuit) ───────────────────────
    expSalt: asString(source.expSalt),
    expKey: asString(source.expKey),
    expValue: asString(source.expValue),

    // ── Country disclosure (from SD-JWT; checked only when enableCountryCheck=1)
    countrySalt: asString(source.countrySalt),
    countryKey: asString(source.countryKey),
    countryValue: asString(source.countryValue),

    // ── Region disclosure (from SD-JWT; checked only when enableRegionCheck=1)
    regionSalt: asString(source.regionSalt),
    regionKey: asString(source.regionKey),
    regionValue: asString(source.regionValue),

    // ── District disclosure (from SD-JWT; checked only when enableDistrictCheck=1)
    districtSalt: asString(source.districtSalt),
    districtKey: asString(source.districtKey),
    districtValue: asString(source.districtValue),

    // ── Public requirement inputs ────────────────────────────────────────────
    currentDate: asString(source.currentDate),
    minAge: asString(source.minAge, '0'),
    enableAgeCheck: asFlag(source.enableAgeCheck),

    // Country check: requiredCountry is the encoded country code the voter must have
    requiredCountry: asString(source.requiredCountry, '0'),
    enableCountryCheck: asFlag(source.enableCountryCheck),

    // Region check: up to 5 allowed encoded region values
    allowedRegions: asPaddedArray(source.allowedRegions, 5),
    enableRegionCheck: asFlag(source.enableRegionCheck),

    // District check: up to 5 allowed encoded district values
    allowedDistricts: asPaddedArray(source.allowedDistricts, 5),
    enableDistrictCheck: asFlag(source.enableDistrictCheck),
  };
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
};
