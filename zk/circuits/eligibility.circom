pragma circom 2.1.6;

include "../../node_modules/circomlib/circuits/eddsaposeidon.circom";
include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/comparators.circom";
include "./templates/findHashInLeaves.circom";
include "./templates/merkleTreeVerifier.circom";

template MainCheck() {
    
    // === INPUTS ===

    signal input pubKey[2];         // public key (issuer) (from zkp.publicKey)
    signal input signatureR8[2];    // signature (from zkp.signature)
    signal input signatureS;
    signal input merkleRoot;        // signed merkle root (from zkp.merkleRoot)

    signal input leaves[8];
    signal input numLeaves;

    // = Attribute disclosures =
    signal input dobSalt;
    signal input dobKey;            // "birth_date" (strToBigInt)
    signal input dobValue; 

    signal input expSalt;
    signal input expKey;
    signal input expValue;

    // = Requirements (public) =
    signal input currentDate;       // verified on-chain
    signal input minAge;

    // = Enable/disable flags (public) =
    signal input enableAgeCheck;    // 1 = check age, 0 = skip


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
    merkleVerifier.numLeaves <== numLeaves;
    merkleVerifier.expectedRoot <== merkleRoot;


    // == HASH CHECKS ==

    // === Age check
    component dobHasher = Poseidon(3);
    dobHasher.inputs[0] <== dobSalt;
    dobHasher.inputs[1] <== dobKey;
    dobHasher.inputs[2] <== dobValue;

    component dobHashInLeaves = HashInLeaves(8);
    dobHashInLeaves.computedHash <== dobHasher.out;
    dobHashInLeaves.leaves <== leaves;
    signal dobHashValid <== enableAgeCheck * dobHashInLeaves.found + (1 - enableAgeCheck);
    dobHashValid === 1;

    // === Expiry check
    component expHasher = Poseidon(3);
    expHasher.inputs[0] <== expSalt;
    expHasher.inputs[1] <== expKey;
    expHasher.inputs[2] <== expValue;

    component expHashInLeaves = HashInLeaves(8);
    expHashInLeaves.computedHash <== expHasher.out;
    expHashInLeaves.leaves <== leaves;
    expHashInLeaves.found === 1;
}

component main {public [
    pubKey, 
    merkleRoot, 
    currentDate, 
    minAge,
    enableAgeCheck
]} = MainCheck();


/* INPUT = {
    "pubKey": [
        "20819777127488100708022598367786075971449507556999841353307206018836784896341", 
        "14004583041878220981011147487899050448009418260081102041065039551201105990467"
        ],
    "signatureR8": [
        "5995360802070366241812812864979530611513382133006449066617720300837061823357", 
        "2203655033909077539179184739301560741145241057979937897816103612658463814751"
        ],
    "signatureS": "1270517699732476589524071021497433259780990121416805424341003255058355857641",
    "merkleRoot": "5619118809198186717025939132568580030341618483406948384977746823794628293080",
    "dobValue": "19990101",
    "currentDate": "20260427",
    "minAge": "20",
    "enableAgeCheck": "1",
    "dobSalt": "3009555253",
    "dobKey": "464737070780541271372901",
    "expSalt": "3140829282",
    "expKey": "122670265392627131481158757",
    "expValue": "20300505",
    "leaves": [
        "1750715785215183251078992993785381113287245862753112597004785050312478526212", 
        "17730642392086886239562659265258605233228412548994667344458633753322474676377",
        "18650170846649886357182385396113531609409262814024578456551615297653523677958",
        "7940696320742643234005310170879451933655917977167062823570099739025673413676",
        "19264448190612129652959067143651551938468048492647880296170747155059878779999",
        "18815136004398032932931322566365588553644710752425662801104941539483710128212",
        "2742950999648639021911747645035182407839208401894415429211122491019047566974",
        "0"
        ],
    "numLeaves": "7"
} */