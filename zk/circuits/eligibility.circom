pragma circom 2.1.6;

include "../../node_modules/circomlib/circuits/eddsaposeidon.circom";
include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/comparators.circom";
include "./templates/findHashInLeaves.circom";
include "./templates/merkleTreeVerifier.circom";
include "./templates/matchAnyOf.circom";

template MainCheck() {
    
    // === INPUTS ===

    signal input pubKey[2];         // public key (issuer) (from zkp.publicKey)
    signal input signatureR8[2];    // signature (from zkp.signature)
    signal input signatureS;
    signal input merkleRoot;        // signed merkle root (from zkp.merkleRoot)

    signal input leaves[10];

    // = Attribute disclosures =
    signal input dobSalt;
    signal input dobKey;            // "birth_date" (strToBigInt)
    signal input dobValue; 

    signal input expSalt;
    signal input expKey;
    signal input expValue;

    signal input countrySalt;
    signal input countryKey;
    signal input countryValue;
    
    signal input regionSalt;
    signal input regionKey;
    signal input regionValue;
    
    signal input districtSalt;
    signal input districtKey;
    signal input districtValue;

    // = Requirements (public) =
    signal input currentDate;       // verified on-chain
    signal input minAge;

    signal input requiredCountry;
    signal input allowedRegions[5];
    signal input allowedDistricts[5];

    // = Enable/disable flags (public) =
    signal input enableAgeCheck;    // 1 = check age, 0 = skip
    signal input enableCountryCheck;
    signal input enableRegionCheck;
    signal input enableDistrictCheck;


    // === ELIGIBILITY CHECKS===

    // === Age check
    component ageCheck = GreaterEqThan(32);
    ageCheck.in[0] <== currentDate - dobValue;
    ageCheck.in[1] <== minAge * 10000;
    signal ageValid <== enableAgeCheck * ageCheck.out + (1 - enableAgeCheck);
    ageValid === 1;

    // === Expiry check
    component expCheck = LessEqThan(32);
    expCheck.in[0] <== currentDate;
    expCheck.in[1] <== expValue;
    expCheck.out === 1;

    // === Country check
    component countryMatch = IsEqual();
    countryMatch.in[0] <== countryValue;
    countryMatch.in[1] <== requiredCountry;
    signal countryValid <== enableCountryCheck * countryMatch.out + (1 - enableCountryCheck);
    countryValid === 1;

    // === Region check
    component regionMatcher = MatchAnyOf(5);
    regionMatcher.disclosedValue <== regionValue;
    regionMatcher.allowedValues <== allowedRegions;
    signal regionValid <== enableRegionCheck * regionMatcher.matched + (1 - enableRegionCheck);
    regionValid === 1;


    // === District check 
    component districtMatcher = MatchAnyOf(5);
    districtMatcher.disclosedValue <== districtValue;
    districtMatcher.allowedValues <== allowedDistricts;
    signal districtValid <== enableDistrictCheck * districtMatcher.matched + (1 - enableDistrictCheck);
    districtValid === 1;


    // === MANDATORY CHECKS ===

    // 1. Verify issuer signature (over merkleRoot)
    component sigVerifier = EdDSAPoseidonVerifier();
    sigVerifier.Ax <== pubKey[0];
    sigVerifier.Ay <== pubKey[1];
    sigVerifier.S <== signatureS;
    sigVerifier.R8x <== signatureR8[0];
    sigVerifier.R8y <== signatureR8[1];
    sigVerifier.M <== merkleRoot;
    sigVerifier.enabled <== 1;

    // 2. Reconstruct merkle tree
    component merkleVerifier = MerkleTreeVerifier();
    merkleVerifier.leaves <== leaves;
    merkleVerifier.expectedRoot <== merkleRoot;


    // == HASH CHECKS ==

    // === Age check
    component dobHasher = Poseidon(3);
    dobHasher.inputs[0] <== dobSalt;
    dobHasher.inputs[1] <== dobKey;
    dobHasher.inputs[2] <== dobValue;

    component dobHashInLeaves = HashInLeaves(10);
    dobHashInLeaves.computedHash <== dobHasher.out;
    dobHashInLeaves.leaves <== leaves;
    signal dobHashValid <== enableAgeCheck * dobHashInLeaves.found + (1 - enableAgeCheck);
    dobHashValid === 1;

    // === Expiry check
    component expHasher = Poseidon(3);
    expHasher.inputs[0] <== expSalt;
    expHasher.inputs[1] <== expKey;
    expHasher.inputs[2] <== expValue;

    component expHashInLeaves = HashInLeaves(10);
    expHashInLeaves.computedHash <== expHasher.out;
    expHashInLeaves.leaves <== leaves;
    expHashInLeaves.found === 1;

    // === Country check
    component countryHasher = Poseidon(3);
    countryHasher.inputs[0] <== countrySalt;
    countryHasher.inputs[1] <== countryKey;
    countryHasher.inputs[2] <== countryValue;

    component countryHashInLeaves = HashInLeaves(10);
    countryHashInLeaves.computedHash <== countryHasher.out;
    countryHashInLeaves.leaves <== leaves;
    signal countryHashValid <== enableCountryCheck * countryHashInLeaves.found + (1 - enableCountryCheck);
    countryHashValid === 1;

    // === Region check
    component regionHasher = Poseidon(3);
    regionHasher.inputs[0] <== regionSalt;
    regionHasher.inputs[1] <== regionKey;
    regionHasher.inputs[2] <== regionValue;
    
    component regionHashInLeaves = HashInLeaves(10);
    regionHashInLeaves.computedHash <== regionHasher.out;
    regionHashInLeaves.leaves <== leaves;
    signal regionHashValid <== enableRegionCheck * regionHashInLeaves.found + (1 - enableRegionCheck);
    regionHashValid === 1;

    // === District check
    component districtHasher = Poseidon(3);
    districtHasher.inputs[0] <== districtSalt;
    districtHasher.inputs[1] <== districtKey;
    districtHasher.inputs[2] <== districtValue;
    
    component districtHashInLeaves = HashInLeaves(10);
    districtHashInLeaves.computedHash <== districtHasher.out;
    districtHashInLeaves.leaves <== leaves;
    signal districtHashValid <== enableDistrictCheck * districtHashInLeaves.found + (1 - enableDistrictCheck);
    districtHashValid === 1;
}

component main {public [
    pubKey, 
    merkleRoot, 
    currentDate, 
    minAge,
    enableAgeCheck,
    requiredCountry,
    enableCountryCheck,
    allowedRegions,
    enableRegionCheck,
    allowedDistricts,
    enableDistrictCheck

]} = MainCheck();


/* INPUT = {
    "pubKey": [
        "20819777127488100708022598367786075971449507556999841353307206018836784896341", 
        "14004583041878220981011147487899050448009418260081102041065039551201105990467"
        ],
    "signatureR8":   [
        "4607707142539924677576829828687272507018493067819599105440757198427656393634",
        "20137000682881364481650893614337697166787930480924426070079520468082806583804"
      ],
    "signatureS": "2230484703645449467724691791809274653909034905049095886489572238154396189811",
    "merkleRoot": "8161619990786128153215174694101380716338582200247621543323527496095677885183",
    "dobValue": "0",
    "currentDate": "20260507",
    "minAge": "0",
    "enableAgeCheck": "0",
    "dobSalt": "0",
    "dobKey": "0",
    "expSalt": "1692001170",
    "expKey": "122670265392627131481158757",
    "expValue": "20300505",
    "leaves": [
      "11464170690518982879143044305411778616735160829838878338452113211197051441413",
      "18902202818330702731442491450555970296118919620307631184685586529474627459991",
      "634364826890246444676161235546813465304999297316137322495724985228308286591",
      "9507375595234464385405560614742655293506975136559231413320303752655967966295",
      "2581796188849390040889462198357467329875304534960842852347095219444489743555",
      "5268629651594286292702377094467431369139749967758253018308589054024309946264",
      "6659840090562286167826448556204526522928216487449059340582632776140998285327",
      "11799354992172553032178739447139972556241860133978353151345874908957015427444",
      "10578445365761664276179525837274288422442043320094562721085834583290849193490",
      "2946285278122429701131454198713258828130621471604635036293317808446152102237"
    ],
    "requiredCountry": "21323",
    "enableCountryCheck": "1",
    "allowedRegions": [
        "378966184785361306377934625699680629223907811690",
        "0",
        "0",
        "0",
        "0"
    ],
    "enableRegionCheck": "1",
    "allowedDistricts": [
        "344667737213923724289161807518065505",
        "20940694574001515",
        "20940694574001515",
        "20940694574001515",
        "0"
    ],
    "enableDistrictCheck": "1",
    "countrySalt": "3056353236",
    "countryKey": "30773761292701632005028144229",
    "countryValue": "21323",
    "regionSalt": "2897907761",
    "regionKey": "125779852226414",
    "regionValue": "378966184785361306377934625699680629223907811690",
    "districtSalt": "1204018349",
    "districtKey": "7235441220320322420",
    "districtValue": "344667737213923724289161807518065505"
} */